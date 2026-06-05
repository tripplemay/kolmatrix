/**
 * BL-084-F002 · LLM rerank service for the AI Match Panel.
 *
 * `rerankWithReason` takes the cosine-recall top-N KOL candidates from
 * `runSmartMatch` (F001) plus the campaign's business meta and asks an
 * aigcgateway action (claude-haiku-4.5, same family as BL-068 refine) to
 * reorder them by campaign fit AND attach a short (~15-word) match
 * reason per KOL.
 *
 * Contract (spec §F002 + §5 不变量):
 *   - Output is a strict permutation of the input (no hallucinated /
 *     dropped / duplicated kolIds, length preserved).
 *   - Each reason is a non-empty string ≤ 120 chars.
 *   - ANY failure mode (action not configured / timeout / quota /
 *     unparsable JSON / schema mismatch / permutation invalid) degrades
 *     gracefully to the input cosine order with NO reasons and emits a
 *     `llm_rerank.fallback` event — the caller (F004) always gets a
 *     usable ranked list so the AI Panel never hard-fails.
 *
 * The function never throws — it owns its degradation so F004 can treat
 * it as total.
 */
import { z } from "zod";

import { wrapUserInput } from "@/lib/ai/xml-escape";
import { runAigcAction } from "@/lib/aigc/run-action";
import type { SmartMatchKolHit } from "@/lib/discovery/smart-match";

/** Campaign business meta fed to the rerank prompt (spec §F002 signature). */
export interface RerankCampaignMeta {
  name: string;
  /** Target market region codes / names, e.g. ["US", "JP"]. */
  markets: string[];
  targetAudience: string | null;
  /** Campaign budget in cents/USD (display-only context for the model). */
  budget: number | null;
}

export interface RerankResult {
  /** Reordered candidates. Equals input order on any fallback. */
  rank: SmartMatchKolHit[];
  /** kolId → match reason. Empty Map on any fallback. */
  matchReasons: Map<string, string>;
  /** True when the LLM rerank failed and we fell back to cosine order. */
  fallback: boolean;
}

export interface RerankOpts {
  /** Required for the aigcgateway per-tenant cost cap + fallback telemetry. */
  tenantId: string;
  /** User that triggered the match (telemetry actor). */
  actorId?: string;
  /** Test seam: stub fetch passed through to runAigcAction. */
  fetchImpl?: typeof fetch;
  /** Test seam: override the aigc action call (default: runAigcAction). */
  runAction?: typeof runAigcAction;
  /**
   * Test seam / hook: observe a fallback instead of emitting the event.
   * Default emits `llm_rerank.fallback` via logEvent.
   */
  onFallback?: (reason: RerankFallbackReason) => void;
}

export type RerankFallbackReason =
  | "action_not_configured"
  | "timeout"
  | "quota_exceeded"
  | "unparsable"
  | "schema_mismatch"
  | "length_mismatch"
  | "permutation_invalid"
  | "unknown_error";

/** Max match-reason length (spec §F002: 非空 ≤ 120 chars). */
export const MAX_REASON_LEN = 120;

/**
 * Telemetry event name for any rerank degradation. Dot-namespaced to
 * match the codebase event convention (= spec's 'llm-rerank.fallback').
 */
export const RERANK_FALLBACK_EVENT = "llm_rerank.fallback";

const RerankItemSchema = z.object({
  kolId: z.string().min(1),
  rank: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(MAX_REASON_LEN),
});

const RerankResponseSchema = z.object({
  ranked: z.array(RerankItemSchema),
});

/**
 * Reorder + annotate the candidate pool. Never throws — see module doc.
 */
export async function rerankWithReason(
  candidates: SmartMatchKolHit[],
  campaignMeta: RerankCampaignMeta,
  opts: RerankOpts,
): Promise<RerankResult> {
  // Empty pool → nothing to rerank, no LLM cost.
  if (candidates.length === 0) {
    return { rank: [], matchReasons: new Map(), fallback: false };
  }

  const actionId = process.env.AIGCGATEWAY_MATCH_RERANK_ACTION_ID;
  if (!actionId) {
    await emitFallback(opts, "action_not_configured");
    return cosineFallback(candidates);
  }

  const runAction = opts.runAction ?? runAigcAction;

  // Compact candidate projection — only fields the model needs to rank.
  // wrapUserInput guards against prompt injection via KOL handles /
  // categories (ai-action-contract.md §4).
  const candidatesJson = JSON.stringify(
    candidates.map((c) => ({
      kolId: c.id,
      handle: c.handle,
      platform: c.platform,
      followerCount: c.followerCount,
      countryCode: c.countryCode,
      categories: c.categories,
      matchScore: c.matchScore,
    })),
  );

  const variables: Record<string, string> = {
    campaign_name: wrapUserInput("USER_CAMPAIGN_NAME", campaignMeta.name),
    campaign_markets: wrapUserInput(
      "USER_CAMPAIGN_MARKETS",
      campaignMeta.markets.join(", "),
    ),
    campaign_target_audience: wrapUserInput(
      "USER_CAMPAIGN_TARGET_AUDIENCE",
      campaignMeta.targetAudience ?? "",
    ),
    campaign_budget: String(campaignMeta.budget ?? ""),
    candidates_json: wrapUserInput("USER_CANDIDATES_JSON", candidatesJson),
  };

  let output: z.infer<typeof RerankResponseSchema>;
  try {
    const res = await runAction<unknown>({
      actionId,
      variables,
      tenantId: opts.tenantId,
      actionLabel: "match_llm_rerank",
      timeoutMs: 30_000,
      fetchImpl: opts.fetchImpl,
    });
    const validated = RerankResponseSchema.safeParse(res.output);
    if (!validated.success) {
      await emitFallback(opts, "schema_mismatch");
      return cosineFallback(candidates);
    }
    output = validated.data;
  } catch (err) {
    await emitFallback(opts, classifyError(err));
    return cosineFallback(candidates);
  }

  // Length guard before permutation walk.
  if (output.ranked.length !== candidates.length) {
    await emitFallback(opts, "length_mismatch");
    return cosineFallback(candidates);
  }

  // Permutation validation: every ranked kolId must map to a distinct
  // input candidate. No hallucinated / duplicated ids.
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const ranked: SmartMatchKolHit[] = [];
  const matchReasons = new Map<string, string>();

  const ordered = [...output.ranked].sort((a, b) => a.rank - b.rank);
  for (const item of ordered) {
    const hit = byId.get(item.kolId);
    if (!hit || seen.has(item.kolId)) {
      await emitFallback(opts, "permutation_invalid");
      return cosineFallback(candidates);
    }
    seen.add(item.kolId);
    ranked.push(hit);
    matchReasons.set(item.kolId, item.reason.trim());
  }

  // Defensive: every input id must be covered (length match + distinct +
  // all-resolved already implies this, but keep the invariant explicit).
  if (ranked.length !== candidates.length) {
    await emitFallback(opts, "permutation_invalid");
    return cosineFallback(candidates);
  }

  return { rank: ranked, matchReasons, fallback: false };
}

/** Return the input cosine order unchanged with no reasons. */
function cosineFallback(candidates: SmartMatchKolHit[]): RerankResult {
  return { rank: candidates, matchReasons: new Map(), fallback: true };
}

/** Map a thrown error to a structured fallback reason. */
function classifyError(err: unknown): RerankFallbackReason {
  if (!(err instanceof Error)) return "unknown_error";
  switch (err.name) {
    case "AigcActionTimeoutError":
      return "timeout";
    case "AiDailyCostExceededError":
      return "quota_exceeded";
    case "AigcActionParseError":
      return "unparsable";
    case "AigcActionHttpError":
    case "AigcActionConfigError":
    default:
      return "unknown_error";
  }
}

/**
 * Emit the `llm_rerank.fallback` telemetry (or invoke the test hook).
 * Fire-and-forget; logEvent swallows its own failures. Lazy-imports
 * logEvent to keep db.ts off this module's load path.
 */
async function emitFallback(
  opts: RerankOpts,
  reason: RerankFallbackReason,
): Promise<void> {
  if (opts.onFallback) {
    opts.onFallback(reason);
    return;
  }
  try {
    const { logEvent } = await import("@/lib/events/log");
    await logEvent({
      type: RERANK_FALLBACK_EVENT,
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      payload: { reason },
    });
  } catch (err) {
    console.error("[llm-rerank] fallback log failed:", err);
  }
}
