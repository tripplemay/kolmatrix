/**
 * BL-067-F001 · Unified `POST /actions/run` SDK wrapper.
 *
 * Per pre-impl audit §6:A (Planner ack 2026-05-15 commit 9a78c2d) —
 * consolidates the duplicate inline POST patterns in
 * `src/lib/email/customize.ts` + `src/lib/kol-detail/topic-cloud.ts`
 * into a single typed entry point so BL-067 + BL-068 + future
 * aigcgateway-action callers don't keep cloning ~80 LOC of timeout /
 * retry / cost-cap / meter / fence-parse boilerplate.
 *
 * Flow:
 *   1. `assertDailyCostBudget(tenantId)` — re-throws AiDailyCostExceededError
 *      so the caller can map to a domain error or do silent fallback
 *   2. POST `{baseUrl}/actions/run` with Bearer auth + JSON body
 *      `{ action_id, variables, stream: false }` via `fetchWithRetry`
 *      (BL-035-F010 — single retry on 5xx/429/transport with jitter)
 *   3. `parseFencedJson<T>(body.output)` — strips Claude's ```json fences
 *   4. `recordAiUsage(tenantId, actionLabel, costUsd, extras)` — meter
 *      the call so the next `assertDailyCostBudget` sees it
 *   5. Return `{ output, usage, traceId }` typed
 *
 * Variables contract: **Record<string, string>** flat (aigcgateway action
 * template variables are string-only). Callers MUST `JSON.stringify` any
 * structured input fields and `wrapUserInput(...)` any user-controlled
 * text per `framework/harness/ai-action-contract.md §4`.
 *
 * Existing callers in customize.ts / topic-cloud.ts are NOT migrated in
 * this commit (audit §6:A constraint — back-compat preserved). They can
 * be folded onto this SDK in a later batch as a proposed-learning
 * sediment candidate.
 */
import "dotenv/config";

import {
  AiDailyCostExceededError,
  assertDailyCostBudget,
  recordAiUsage,
} from "@/lib/ai/cost-cap";
import { parseFencedJson } from "@/lib/ai/json-extract";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

export class AigcActionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AigcActionConfigError";
  }
}

export class AigcActionHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AigcActionHttpError";
  }
}

export class AigcActionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AigcActionParseError";
  }
}

export class AigcActionTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`aigcgateway request timed out after ${timeoutMs}ms`);
    this.name = "AigcActionTimeoutError";
  }
}

export interface AigcActionUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface AigcActionResult<T> {
  output: T;
  usage: AigcActionUsage;
  traceId: string | null;
}

export interface RunAigcActionOpts {
  /** aigcgateway action id (e.g. env var AIGCGATEWAY_*_ACTION_ID). */
  actionId: string;
  /** Flat string variables matching the action's declared template variable names. */
  variables: Record<string, string>;
  /** Required for per-tenant daily cost cap pre-check + post-meter. */
  tenantId: string;
  /**
   * Short stable label written into `event_log.payload.action` for the
   * cost-cap counter. Use snake_case like
   * "ai_recommendation_explain_short" so the audit dashboard groups by it.
   */
  actionLabel: string;
  /** Per-call timeout. Default: 30_000ms (matches customize.ts existing). */
  timeoutMs?: number;
  /**
   * BL-093: per-call max output tokens, forwarded to aigcgateway `/actions/run`
   * (which passes it to the upstream `max_tokens`). Without it the upstream
   * reserves the model's full output cap (haiku-4.5 = 64000) for the affordability
   * pre-check, so a low gateway balance rejects the whole request (0.3s/$0/error)
   * across every haiku-4.5 action. Defaults to DEFAULT_MAX_TOKENS; high-output
   * actions (EXPLAIN_DETAILED) pass a larger value. Must be ≥ the action's real
   * max output so output isn't truncated.
   */
  maxTokens?: number;
  /**
   * BL-113 F002: cost bucket for the metered call. 'system' marks backend
   * AI (enrichment/prewarm/cron) so assertDailyCostBudget excludes it from
   * the user-facing per-tenant quota. Default 'user' (all frontend calls).
   */
  costBucket?: "system" | "user";
  /** Internal: stub fetch for tests. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * BL-093: sane default max_tokens for every action that doesn't override it.
 * 8192 ≫ the real output of all short actions (≤~800 tok) yet ≪ the 64000 model
 * cap, so the gateway affordability pre-check passes even at low balance. The one
 * high-output action (EXPLAIN_DETAILED, ~4.9K observed) passes 16000 explicitly.
 */
const DEFAULT_MAX_TOKENS = 8192;

interface RawActionResponse {
  output?: string;
  traceId?: string;
  trace_id?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost_usd?: number;
  };
}

function readEnv(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.AIGCGATEWAY_BASE_URL;
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!baseUrl) {
    throw new AigcActionConfigError("AIGCGATEWAY_BASE_URL is not configured");
  }
  if (!apiKey) {
    throw new AigcActionConfigError("AIGCGATEWAY_API_KEY is not configured");
  }
  return { baseUrl, apiKey };
}

/**
 * Invoke an aigcgateway `/actions/run` action with cost-cap + meter +
 * typed JSON parse. Throws:
 *   - AiDailyCostExceededError when the per-tenant daily cap is hit
 *     (re-thrown unchanged so caller can `instanceof` check + silent fallback)
 *   - AigcActionConfigError when env is missing
 *   - AigcActionTimeoutError when AbortController fires
 *   - AigcActionHttpError on non-2xx after retry
 *   - AigcActionParseError on missing/malformed output JSON
 */
export async function runAigcAction<T>(opts: RunAigcActionOpts): Promise<AigcActionResult<T>> {
  const { baseUrl, apiKey } = readEnv();

  // Cost-cap pre-check — re-throw AiDailyCostExceededError so caller
  // can decide between silent fallback (BL-067 pre-warm path) vs
  // domain error mapping (BL-034 customize.ts pattern).
  await assertDailyCostBudget(opts.tenantId);

  const url = `${resolveAigcV1BaseUrl(baseUrl)}/actions/run`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action_id: opts.actionId,
          variables: opts.variables,
          stream: false,
          max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        }),
      },
      {
        timeoutMs,
        retries: 1,
        fetchImpl: opts.fetchImpl,
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AigcActionTimeoutError(timeoutMs);
    }
    throw err;
  }

  if (!res.ok) {
    // BL-035-F007 (AI-H2): do NOT echo response body to caller — may
    // contain user-controlled prompt fragments / PII. Log full body
    // server-side for ops, surface only status to caller.
    const text = await res.text().catch(() => "");
    console.error(
      "[runAigcAction] action=%s status=%d body=%s",
      opts.actionLabel,
      res.status,
      text,
    );
    throw new AigcActionHttpError(
      `aigcgateway responded ${res.status}`,
      res.status,
    );
  }

  const body = (await res.json()) as RawActionResponse;
  if (typeof body.output !== "string" || body.output.length === 0) {
    throw new AigcActionParseError("aigcgateway response missing `output` string");
  }

  let parsed: T;
  try {
    parsed = parseFencedJson<T>(body.output);
  } catch (err) {
    throw new AigcActionParseError(
      `aigcgateway output not parseable JSON: ${(err as Error).message}`,
    );
  }

  const usage: AigcActionUsage = {
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
    totalTokens: body.usage?.total_tokens ?? 0,
    costUsd: body.usage?.cost_usd ?? 0,
  };

  // Meter the successful call. recordAiUsage swallows DB errors so a
  // logEvent failure never propagates back to the caller's business
  // logic; the worst case is the next assertDailyCostBudget undercounts.
  // BL-113 F002: source='system' marks backend calls so assertDailyCostBudget
  // can exclude them from the user-facing per-tenant daily quota.
  await recordAiUsage(opts.tenantId, opts.actionLabel, usage.costUsd, {
    totalTokens: usage.totalTokens,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    traceId: body.traceId ?? body.trace_id ?? null,
    source: opts.costBucket ?? "user",
  });

  return {
    output: parsed,
    usage,
    traceId: body.traceId ?? body.trace_id ?? null,
  };
}

// Re-export so callers can `instanceof` check without depending on
// `@/lib/ai/cost-cap` directly.
export { AiDailyCostExceededError };

export const __TEST_ONLY__ = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_TOKENS,
};
