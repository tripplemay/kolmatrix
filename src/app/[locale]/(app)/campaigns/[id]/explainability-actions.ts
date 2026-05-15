"use server";

/**
 * BL-067-F003+F004 · Server actions for the explainability layer.
 *
 * F003 introduces `readShortExplanationsBatchAction` — called from the
 * AiRecommendationPanel client on mount (after smart-match returns top 30)
 * to bulk-fetch any pre-warmed short explanations from the cache. Returns
 * a per-kolId map of `string | null` so the client can render hit/miss
 * uniformly without per-card round-trips.
 *
 * F004 will add `requestDetailedExplanationAction` for the `?` icon click
 * flow (5-segment dialog, on-demand LLM call with cost-cap gate + audit).
 */
import { auth } from "@/auth";
import { runAigcAction, AiDailyCostExceededError } from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { checkLlmCostBudget } from "@/lib/ai/cost-cap";
import { logAudit } from "@/lib/audit/log";
import { withTenant } from "@/lib/db";
import {
  type DetailedExplanationSegments,
  readDetailedExplanation,
  readShortExplanation,
  writeDetailedExplanation,
} from "@/lib/explainability/cache";
import { computeKolValueScore } from "@/lib/kol/value-score";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = new Set(["en", "zh", "ja", "ko", "es"]);
const MAX_KOL_IDS = 60; // headroom over the 30 top-K + safety against payload bombs

export type ExplainabilityActionError =
  | "unauthorized"
  | "validation_failed"
  | "rate_limit_exceeded"
  | "kol_not_found"
  | "campaign_not_found"
  | "internal_error";

const LOCALES_ALL = ["en", "zh", "ja", "ko", "es"] as const;

export interface ReadShortExplanationsBatchInput {
  campaignId: string;
  kolIds: string[];
  locale: string;
}

export type ReadShortExplanationsBatchResult =
  | { ok: true; results: Record<string, string | null> }
  | { ok: false; error: ExplainabilityActionError };

/**
 * Batch-read pre-warmed short explanations for (campaign, kolIds, locale).
 *
 * On cache hit, the entry is the explanation text. On miss / expired /
 * malformed payload, the entry is `null` so the client renders the C2
 * fallback ("matched on cosine similarity ..."). Per spec §5 不变量 #4,
 * misses never raise a user-facing toast — silent C2 fallback only.
 *
 * RLS is enforced inside `readShortExplanation` via `withTenant`. The
 * caller need not pass tenantId; it is taken from the session.
 */
export async function readShortExplanationsBatchAction(
  input: ReadShortExplanationsBatchInput,
): Promise<ReadShortExplanationsBatchResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { ok: false, error: "unauthorized" };
  }

  if (!UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!LOCALES.has(input.locale)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!Array.isArray(input.kolIds) || input.kolIds.length === 0) {
    return { ok: true, results: {} };
  }
  if (input.kolIds.length > MAX_KOL_IDS) {
    return { ok: false, error: "validation_failed" };
  }
  for (const id of input.kolIds) {
    if (!UUID_RE.test(id)) {
      return { ok: false, error: "validation_failed" };
    }
  }

  const reads = await Promise.all(
    input.kolIds.map(async (kolId) => {
      const text = await readShortExplanation(
        tenantId,
        input.campaignId,
        kolId,
        input.locale,
      );
      return [kolId, text] as const;
    }),
  );

  const results: Record<string, string | null> = {};
  for (const [kolId, text] of reads) {
    results[kolId] = text;
  }
  return { ok: true, results };
}

// ---------------------------------------------------------------------------
// BL-067-F004 · requestDetailedExplanationAction — user `?` icon path
// ---------------------------------------------------------------------------

export interface RequestDetailedExplanationInput {
  campaignId: string;
  kolId: string;
  locale: string;
}

export interface RequestDetailedExplanationResult {
  /** 5-segment LLM payload for the requested locale, or null on miss + cap. */
  segments: DetailedExplanationSegments | null;
  /**
   * Set when the cap is exhausted (per spec §5 不变量 #5 — dialog path
   * surfaces capExhaustedToast). The pre-warm path (F005) consumes the
   * same cap signal but never sets this flag — silent fallback only.
   */
  fallbackToC2: boolean;
  /** Trace id for cross-system audit lookup on the LLM-call branch. */
  traceId?: string | null;
}

export type RequestDetailedExplanationActionResult =
  | { ok: true; data: RequestDetailedExplanationResult }
  | { ok: false; error: ExplainabilityActionError; retryAfter?: number };

/**
 * Server action behind the `?` icon DetailedExplanationDialog. Flow:
 *
 *   1. Session + UUID/locale validation
 *   2. rateLimitBatchSend (20/min/user, shared with outreach)
 *   3. readDetailedExplanation(locale) → HIT: audit `_served_from_cache`,
 *      return segments
 *   4. MISS → checkLlmCostBudget → not allowed: audit `_cap_exhausted`,
 *      return fallbackToC2=true
 *   5. allowed → fetch KOL + campaign (RLS), compute valueScore breakdown
 *      via computeKolValueScore (audit §3:A), runAigcAction(detailed) →
 *      writeDetailedExplanation × 5 locales (write-through so subsequent
 *      locale requests are cache hits) → audit `_generated`, return
 *      current locale segments
 *
 * Per spec §5 不变量 #9 — JSON parse failures are NOT retried; the worker
 * (F005) treats them as a permanent skip. F004 (dialog path) maps a parse
 * failure to internal_error so the UI shows the unavailable message rather
 * than masquerading as cap-exhausted.
 */
export async function requestDetailedExplanationAction(
  input: RequestDetailedExplanationInput,
): Promise<RequestDetailedExplanationActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return { ok: false, error: "unauthorized" };
  }

  if (!UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!UUID_RE.test(input.kolId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (!LOCALES.has(input.locale)) {
    return { ok: false, error: "validation_failed" };
  }

  // BL-067-F004: per-user rate limit, shared with outreach (20/min/user).
  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: rl.retryAfter,
    };
  }

  // (3) Cache lookup — hit short-circuits all LLM cost.
  const cached = await readDetailedExplanation(
    tenantId,
    input.campaignId,
    input.kolId,
    input.locale,
  );
  if (cached) {
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.explain_detailed_served_from_cache",
      targetType: "kol_campaign",
      targetId: `${input.campaignId}:${input.kolId}`,
      tenantId,
      after: { locale: input.locale, segmentCount: 5 },
    });
    return {
      ok: true,
      data: { segments: cached, fallbackToC2: false, traceId: null },
    };
  }

  // (4) Cost-cap gate — per spec §5 不变量 #1, reuse BL-034 F005 cap via
  // the F002 boolean wrapper. fallbackToC2 = true on cap exhaustion lets
  // the UI surface capExhaustedToast (per §5 不变量 #5).
  const budget = await checkLlmCostBudget(tenantId);
  if (!budget.allowed) {
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.explain_detailed_cap_exhausted",
      targetType: "kol_campaign",
      targetId: `${input.campaignId}:${input.kolId}`,
      tenantId,
      after: { locale: input.locale },
    });
    return {
      ok: true,
      data: { segments: null, fallbackToC2: true, traceId: null },
    };
  }

  // (5) LLM call path — fetch the source data via RLS, compute breakdown,
  // call aigcgateway, write 5 locales through.
  let kolRow: {
    handle: string;
    displayName: string;
    platform: string;
    followerCount: number;
    engagementRate: { toNumber: () => number } | null;
    categories: string[];
    engagementAuthenticity: number | null;
  } | null = null;
  let campaignRow: {
    name: string;
    markets: string[];
    product: {
      name: string;
      category: string;
      targetAudience: string;
    } | null;
  } | null = null;

  try {
    const fetched = await withTenant(tenantId, async (tx) => {
      const k = await tx.kol.findUnique({
        where: { id: input.kolId },
        select: {
          handle: true,
          displayName: true,
          platform: true,
          followerCount: true,
          engagementRate: true,
          categories: true,
          engagementAuthenticity: true,
        },
      });
      const c = await tx.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          name: true,
          markets: true,
          product: { select: { name: true, category: true, targetAudience: true } },
        },
      });
      return { k, c };
    });
    if (!fetched.k) return { ok: false, error: "kol_not_found" };
    if (!fetched.c) return { ok: false, error: "campaign_not_found" };
    // Double cast through unknown: Prisma's engagementRate is Decimal
    // (a class with many methods) while our local type narrows to
    // `{ toNumber: () => number } | null`. The shapes don't structurally
    // overlap enough for TS strict-mode to allow a direct cast — the
    // recommended workaround per the TS error message is to route
    // through `unknown` first. Functionally equivalent at runtime.
    kolRow = fetched.k as unknown as typeof kolRow;
    campaignRow = fetched.c as unknown as typeof campaignRow;
  } catch (err) {
    console.error("[requestDetailedExplanationAction] fetch error:", err);
    return { ok: false, error: "internal_error" };
  }

  // computeKolValueScore returns { score, breakdown: { follower, engagement, category } }.
  // Per F001 audit §3:A — F004 inline-imports the pure function, no smart-match round-trip.
  const engagementRateNumber =
    kolRow!.engagementRate == null ? null : kolRow!.engagementRate.toNumber();
  const breakdown = computeKolValueScore({
    followerCount: kolRow!.followerCount,
    engagementRate: engagementRateNumber,
    categories: kolRow!.categories,
    engagementAuthenticity: kolRow!.engagementAuthenticity,
  }).rawBreakdown;

  const kolPayload = {
    id: input.kolId,
    name: kolRow!.displayName,
    handle: kolRow!.handle,
    platform: kolRow!.platform,
    followerCount: kolRow!.followerCount,
    engagementRate: engagementRateNumber,
    categories: kolRow!.categories,
  };
  const campaignPayload = {
    id: input.campaignId,
    name: campaignRow!.name,
    markets: campaignRow!.markets,
    productName: campaignRow!.product?.name ?? "",
    productCategory: campaignRow!.product?.category ?? "",
    targetAudience: campaignRow!.product?.targetAudience ?? "",
  };
  const breakdownPayload = {
    followerScore: breakdown.follower,
    engagementScore: breakdown.engagement,
    categoryScore: breakdown.category,
    total: breakdown.follower + breakdown.engagement + breakdown.category,
  };

  const variables: Record<string, string> = {
    kol_json: wrapUserInput("USER_KOL_JSON", JSON.stringify(kolPayload)),
    campaign_json: wrapUserInput(
      "USER_CAMPAIGN_JSON",
      JSON.stringify(campaignPayload),
    ),
    value_score_breakdown_json: JSON.stringify(breakdownPayload),
    locales_json: JSON.stringify(LOCALES_ALL),
  };

  const actionId = process.env.AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID;
  if (!actionId) {
    console.error(
      "[requestDetailedExplanationAction] AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID not configured",
    );
    return { ok: false, error: "internal_error" };
  }

  let llmResult: Awaited<ReturnType<typeof runAigcAction<unknown>>>;
  try {
    llmResult = await runAigcAction({
      actionId,
      variables,
      tenantId,
      actionLabel: "ai_recommendation_explain_detailed",
      timeoutMs: 30_000,
    });
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) {
      // Race condition: cap was OK at check but the in-flight call met the
      // threshold. Surface as cap-exhausted so the dialog falls back to C2.
      void logAudit({
        actorId: userId,
        action: "ai_recommendation.explain_detailed_cap_exhausted",
        targetType: "kol_campaign",
        targetId: `${input.campaignId}:${input.kolId}`,
        tenantId,
        after: { locale: input.locale, raceCondition: true },
      });
      return {
        ok: true,
        data: { segments: null, fallbackToC2: true, traceId: null },
      };
    }
    console.error("[requestDetailedExplanationAction] LLM call failed:", err);
    return { ok: false, error: "internal_error" };
  }

  // Parse + validate the 5-locale × 5-segment payload shape.
  const parsed = parseDetailedPayload(llmResult.output);
  if (!parsed) {
    void logAudit({
      actorId: userId,
      action: "ai_recommendation.explain_detailed_parse_failed",
      targetType: "kol_campaign",
      targetId: `${input.campaignId}:${input.kolId}`,
      tenantId,
      after: { locale: input.locale, traceId: llmResult.traceId },
    });
    return { ok: false, error: "internal_error" };
  }

  // Write-through 5 locales (best-effort). Errors per locale are logged
  // but do not abort — partial cache is better than no cache.
  await Promise.all(
    LOCALES_ALL.map(async (loc) => {
      const seg = parsed[loc];
      if (!seg) return;
      try {
        await writeDetailedExplanation(
          tenantId,
          input.campaignId,
          input.kolId,
          loc,
          seg,
          {
            tokenUsage: llmResult.usage.totalTokens,
            costUsd: llmResult.usage.costUsd,
            traceId: llmResult.traceId,
          },
        );
      } catch (err) {
        console.error(
          "[requestDetailedExplanationAction] writeDetailedExplanation failed for locale=%s:",
          loc,
          err,
        );
      }
    }),
  );

  void logAudit({
    actorId: userId,
    action: "ai_recommendation.explain_detailed_generated",
    targetType: "kol_campaign",
    targetId: `${input.campaignId}:${input.kolId}`,
    tenantId,
    after: {
      locale: input.locale,
      tokenUsage: llmResult.usage.totalTokens,
      costUsd: llmResult.usage.costUsd,
      segmentCount: 5,
      traceId: llmResult.traceId,
    },
  });

  return {
    ok: true,
    data: {
      segments: parsed[input.locale] ?? null,
      fallbackToC2: false,
      traceId: llmResult.traceId,
    },
  };
}

/**
 * Shape-check the LLM response. Expects
 *   { en: { matchScore, categoryFit, recentActivity, audienceFit, brandHistory },
 *     zh: {...}, ja: {...}, ko: {...}, es: {...} }
 * Returns null on any structural mismatch so the caller can map to
 * `internal_error` without leaking partial data to the UI.
 */
function parseDetailedPayload(
  output: unknown,
): Record<string, DetailedExplanationSegments> | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const obj = output as Record<string, unknown>;
  const result: Record<string, DetailedExplanationSegments> = {};
  for (const loc of LOCALES_ALL) {
    const seg = obj[loc];
    if (!seg || typeof seg !== "object" || Array.isArray(seg)) return null;
    const s = seg as Record<string, unknown>;
    if (
      typeof s.matchScore !== "string" ||
      typeof s.categoryFit !== "string" ||
      typeof s.recentActivity !== "string" ||
      typeof s.audienceFit !== "string" ||
      typeof s.brandHistory !== "string"
    ) {
      return null;
    }
    result[loc] = {
      matchScore: s.matchScore,
      categoryFit: s.categoryFit,
      recentActivity: s.recentActivity,
      audienceFit: s.audienceFit,
      brandHistory: s.brandHistory,
    };
  }
  return result;
}
