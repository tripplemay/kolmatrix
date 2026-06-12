/**
 * BL-034 F005 fix-round 1 · per-tenant daily AI cost cap.
 * BL-113 F001 · cap改sum真实costUsd + 排除后台source=system
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
 * BL-113 A+B: cap sums real costUsd from payload (not count×$0.01)
 * and excludes backend AI calls marked source='system'.
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
/** Fallback default for recordAiUsage callers that don't supply costUsd. */
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
 * `AiDailyCostExceededError` when the sum of real costUsd reaches the
 * configured limit. Fail-open when the cap is disabled (env=0).
 *
 * BL-113 A+B: sums real costUsd from payload (fixes count×$0.01 overestimate)
 * and excludes events with source='system' (backend calls don't count against
 * the user-facing per-tenant quota).
 */
export async function assertDailyCostBudget(tenantId: string): Promise<void> {
  const limit = resolveLimitUsd();
  if (limit === 0) return; // DISABLE escape hatch (fail-open)

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Raw SQL needed for SUM over JSONB payload field.
  // NULL/invalid costUsd treated as 0 via CASE WHEN regex guard.
  // source='system' events excluded so backend AI (enrichment/prewarm)
  // does not eat the user-facing daily quota.
  const rows = await withTenant(tenantId, (tx) =>
    tx.$queryRaw<[{ costUsdToday: string }]>`
      SELECT COALESCE(SUM(
        CASE
          WHEN payload->>'costUsd' ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (payload->>'costUsd')::numeric
          ELSE 0
        END
      ), 0)::text AS "costUsdToday"
      FROM event_log
      WHERE type = 'ai.usage'
        AND tenant_id = ${tenantId}::uuid
        AND created_at >= ${todayStart}
        AND COALESCE(payload->>'source', 'user') <> 'system'
    `,
  );

  const costUsdToday = Number(rows[0]?.costUsdToday ?? 0);
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

/**
 * BL-067-F002 (per F001 audit §1:A) · Non-throwing boolean wrapper around
 * `assertDailyCostBudget` for BL-067 callers (F004 dialog server action +
 * F005 pre-warm worker) that need silent fallback to C2 (per spec §5
 * 不变量 #4 #5) instead of try/catch on the AiDailyCostExceededError throw.
 *
 * Reuses the same count(event_log) query path — no duplicate logic. Existing
 * BL-034 callers (customize.ts / topic-cloud.ts) continue using
 * `assertDailyCostBudget` for back-compat (per F001 audit §1:A constraint).
 */
export async function checkLlmCostBudget(
  tenantId: string,
): Promise<{ allowed: boolean }> {
  try {
    await assertDailyCostBudget(tenantId);
    return { allowed: true };
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) return { allowed: false };
    throw err;
  }
}

// Internal exports for unit tests that need to introspect the constants
// without re-deriving them.
export const __internal = {
  DEFAULT_LIMIT_USD,
  resolveLimitUsd,
};
