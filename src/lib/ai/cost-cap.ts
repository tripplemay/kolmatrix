/**
 * BL-034 F005 fix-round 1 · per-tenant daily AI cost cap (MVP).
 *
 * Defends the aigcgateway monthly budget against a single tenant burning
 * the per-day quota with bursty AI calls (audit CRIT-5 second prong —
 * the first being max_tokens caps already wired at the chat-completions
 * boundary). Pattern mirrors BL-020 F005's login rate-limiter:
 *   - `assertDailyCostBudget(tenantId)` is the gate — call it BEFORE the
 *     AI request fires and let `AiDailyCostExceededError` bubble.
 *   - `recordAiUsage(tenantId, action)` is the meter — call it AFTER a
 *     successful AI request so the next caller's gate sees the latest
 *     count.
 *   - `AI_DAILY_COST_USD_PER_TENANT_MAX=0` (or unset to 0 / negative) is
 *     the DISABLE escape hatch (fail-open) — same shape as
 *     BL-020 F005 `DISABLE_LOGIN_RATELIMIT`.
 *
 * MVP simplification (spec §F005 D5): we do not yet read the actual cost
 * the gateway returns — `event_log` carries it but aggregating JSON
 * payload across rows requires raw SQL. Use a flat
 * "count(today's ai.usage events) × $0.01" estimate instead. The 5 USD
 * default = 500 calls/day/tenant, which already covers all early
 * customers; BL-040+ will graduate to a dedicated `ai_usage` table with
 * actual costUsd numerics.
 */

import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

export class AiDailyCostExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly costUsdToday: number,
    public readonly limitUsd: number,
  ) {
    super(
      `tenant ${tenantId} hit daily AI cost cap: $${costUsdToday.toFixed(2)} >= $${limitUsd.toFixed(2)}`,
    );
    this.name = "AiDailyCostExceededError";
  }
}

const DEFAULT_LIMIT_USD = 5.0;
/** D5 MVP estimate per AI call (covers email customise + similar). */
const DEFAULT_COST_PER_CALL_USD = 0.01;

/**
 * Resolve the configured per-tenant daily cap. Returns 0 when the cap
 * is disabled (env unset, empty, non-numeric, or explicitly 0). Negative
 * values are treated as misconfigured and degrade to disabled to avoid
 * accidentally throwing on every call.
 */
function resolveLimitUsd(): number {
  const raw = process.env.AI_DAILY_COST_USD_PER_TENANT_MAX;
  if (raw === undefined || raw.trim() === "") return DEFAULT_LIMIT_USD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Assert that `tenantId` has not yet hit the daily AI cost cap. Throws
 * `AiDailyCostExceededError` when the running count would push spend to
 * or past the configured limit. Fail-open when the cap is disabled
 * (env=0).
 */
export async function assertDailyCostBudget(tenantId: string): Promise<void> {
  const limit = resolveLimitUsd();
  if (limit === 0) return; // DISABLE escape hatch (fail-open)

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const count = await withTenant(tenantId, (tx) =>
    tx.eventLog.count({
      where: {
        type: "ai.usage",
        tenantId,
        createdAt: { gte: todayStart },
      },
    }),
  );

  const costUsdToday = count * DEFAULT_COST_PER_CALL_USD;
  if (costUsdToday >= limit) {
    throw new AiDailyCostExceededError(tenantId, costUsdToday, limit);
  }
}

/**
 * Record one AI invocation in `event_log` so subsequent
 * `assertDailyCostBudget` calls observe it. `logEvent` already wraps the
 * write in `withTenant` (BL-034 F003 follow-through) so the row passes
 * the event_log RLS policy.
 *
 * BL-044 F004 (pre-impl audit #7:C) — added optional `extras` arg so
 * downstream features can attach richer monitoring fields (source,
 * queryText preview, cache-hit, result count, ...) without breaking
 * the cost-cap counter SSOT. The base shape stays:
 *   { tenantId, action, costUsd, modelTokens: null, ...extras }
 * so the existing `count(today's ai.usage events)` cost-cap estimator
 * keeps working unchanged. Existing callers that pass 0-3 args remain
 * fully compatible (extras defaults to undefined → no extra payload keys).
 */
export async function recordAiUsage(
  tenantId: string,
  action: string,
  costUsd: number = DEFAULT_COST_PER_CALL_USD,
  extras?: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    type: "ai.usage",
    tenantId,
    payload: {
      tenantId,
      action,
      costUsd,
      modelTokens: null,
      ...(extras ?? {}),
    },
  });
}

// Internal exports for unit tests that need to introspect the constants
// without re-deriving them.
export const __internal = {
  DEFAULT_LIMIT_USD,
  DEFAULT_COST_PER_CALL_USD,
  resolveLimitUsd,
};
