/**
 * BL-067-F005 · Pre-warm worker for /campaigns/[id] short explanations.
 *
 * Per F001 audit §4:B (Planner ack), this batch uses the existing
 * `InMemoryJobQueue` rather than a BullMQ swap-in. The B5-sprint TODO to
 * swap in a Redis-backed queue is preserved as a proposed-learning
 * candidate; the dogfood-period monitor (§F005 acceptance final bullet)
 * decides whether to graduate to BullMQ in a fix-round or a later batch.
 *
 * Per-job flow (handler registered as `recommendation-explain-prewarm`):
 *   1. Fetch campaign + product once (shared across all kolIds in the
 *      batch — avoids 30 separate findUnique RTs).
 *   2. For each kolId:
 *      a. checkLlmCostBudget(tenantId). Cap hit → silent break (per spec
 *         §5 不变量 #4 — no toast, user sees C2 fallback on next mount).
 *      b. readShortExplanation × 5 locales. All hit → skip (cache fresh).
 *      c. Fetch KOL row, compute valueScore breakdown (audit §3:A inline).
 *      d. runAigcAction(short) — has its own 5xx/429 + transport retry
 *         (BL-035-F010 fetchWithRetry). On AiDailyCostExceededError mid
 *         flight → silent break. On parse / network failure post-retry →
 *         skip this kolId only (per spec §5 不变量 #9, no extra retry).
 *      e. writeShortExplanation × 5 locales (write-through).
 *      f. audit_log `ai_recommendation.explain_short_generated`.
 *
 * Idempotency: server action sets jobId/idempotencyKey
 * `prewarm-{tenantId}-{campaignId}` so re-mount within the same process
 * is a noop. Process restart → idempotency map clears → next mount
 * naturally re-enqueues (self-heal).
 */
import {
  AiDailyCostExceededError,
  runAigcAction,
} from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { checkLlmCostBudget } from "@/lib/ai/cost-cap";
import { logAudit } from "@/lib/audit/log";
import { withTenant } from "@/lib/db";
import {
  readShortExplanation,
  writeShortExplanation,
} from "@/lib/explainability/cache";
import { jobQueue, type JobContext, type JobPayload } from "@/lib/jobs/queue";
import { computeKolValueScore } from "@/lib/kol/value-score";

const LOCALES_ALL = ["en", "zh", "ja", "ko", "es"] as const;

export const EXPLAIN_PREWARM_JOB = "recommendation-explain-prewarm";

export interface ExplainPrewarmPayload extends JobPayload {
  tenantId: string;
  campaignId: string;
  kolIds: string[];
}

/**
 * Validate the LLM short-explanation response. Expected shape:
 *   { en: string, zh: string, ja: string, ko: string, es: string }
 * Returns null on any deviation so the worker can skip this KOL without
 * persisting partial / malformed data.
 */
export function parseShortPayload(
  output: unknown,
): Record<(typeof LOCALES_ALL)[number], string> | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const obj = output as Record<string, unknown>;
  const result = {} as Record<(typeof LOCALES_ALL)[number], string>;
  for (const loc of LOCALES_ALL) {
    const v = obj[loc];
    if (typeof v !== "string" || v.length === 0) return null;
    result[loc] = v;
  }
  return result;
}

/**
 * Core worker logic — split out so unit tests can call it directly
 * without registering against the global queue singleton.
 */
export async function processExplainPrewarm(
  payload: ExplainPrewarmPayload,
  _ctx: JobContext,
): Promise<void> {
  const { tenantId, campaignId, kolIds } = payload;

  if (!Array.isArray(kolIds) || kolIds.length === 0) {
    return;
  }

  const actionId = process.env.AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID;
  if (!actionId) {
    console.error(
      "[explain-prewarm] AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID not set; skipping batch tenant=%s campaign=%s",
      tenantId,
      campaignId,
    );
    return;
  }

  // Fetch campaign+product ONCE (immutable across kolIds in this batch).
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
    campaignRow = await withTenant(tenantId, (tx) =>
      tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          name: true,
          markets: true,
          product: { select: { name: true, category: true, targetAudience: true } },
        },
      }),
    );
  } catch (err) {
    console.error("[explain-prewarm] campaign fetch failed:", err);
    return;
  }
  if (!campaignRow) {
    console.warn("[explain-prewarm] campaign not found, skipping batch");
    return;
  }

  for (const kolId of kolIds) {
    // (a) per-iteration cost cap — break out on cap hit.
    const budget = await checkLlmCostBudget(tenantId);
    if (!budget.allowed) {
      // Silent — per spec §5 不变量 #4, pre-warm path does not surface
      // toast / log warnings. Remaining KOLs naturally fall back to C2.
      break;
    }

    // (b) Skip if all 5 locales already cached fresh.
    const cachedLocales = await Promise.all(
      LOCALES_ALL.map((loc) =>
        readShortExplanation(tenantId, campaignId, kolId, loc),
      ),
    );
    if (cachedLocales.every((c) => c != null)) {
      continue;
    }

    // (c) Fetch KOL row + compute breakdown.
    let kolRow: {
      handle: string;
      displayName: string;
      platform: string;
      followerCount: number;
      engagementRate: { toNumber: () => number } | null;
      categories: string[];
      engagementAuthenticity: number | null;
    } | null = null;
    try {
      kolRow = await withTenant(tenantId, (tx) =>
        tx.kol.findUnique({
          where: { id: kolId },
          select: {
            handle: true,
            displayName: true,
            platform: true,
            followerCount: true,
            engagementRate: true,
            categories: true,
            engagementAuthenticity: true,
          },
        }),
      );
    } catch (err) {
      console.error("[explain-prewarm] kol fetch failed kolId=%s:", kolId, err);
      continue;
    }
    if (!kolRow) continue;

    const engagementRateNumber =
      kolRow.engagementRate == null ? null : kolRow.engagementRate.toNumber();
    const breakdown = computeKolValueScore({
      followerCount: kolRow.followerCount,
      engagementRate: engagementRateNumber,
      categories: kolRow.categories,
      engagementAuthenticity: kolRow.engagementAuthenticity,
    }).breakdown;

    const kolPayload = {
      id: kolId,
      name: kolRow.displayName,
      handle: kolRow.handle,
      platform: kolRow.platform,
      followerCount: kolRow.followerCount,
      engagementRate: engagementRateNumber,
      categories: kolRow.categories,
    };
    const campaignPayload = {
      id: campaignId,
      name: campaignRow.name,
      markets: campaignRow.markets,
      productName: campaignRow.product?.name ?? "",
      productCategory: campaignRow.product?.category ?? "",
      targetAudience: campaignRow.product?.targetAudience ?? "",
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

    // (d) LLM call. runAigcAction already does 1 retry on 5xx/429 +
    // transport (BL-035-F010). We do NOT layer a second retry on top —
    // per spec §5 不变量 #9, JSON parse failures aren't retried and any
    // remaining persistent transport error is a single-KOL skip.
    let llmResult: Awaited<ReturnType<typeof runAigcAction<unknown>>>;
    try {
      llmResult = await runAigcAction({
        actionId,
        variables,
        tenantId,
        actionLabel: "ai_recommendation_explain_short",
        timeoutMs: 30_000,
      });
    } catch (err) {
      if (err instanceof AiDailyCostExceededError) {
        // Race condition: cap was OK at check but became exhausted
        // mid-flight. Break the whole loop — remaining KOLs would
        // also hit the cap and waste cycles.
        break;
      }
      console.error("[explain-prewarm] LLM call failed kolId=%s:", kolId, err);
      continue;
    }

    const parsed = parseShortPayload(llmResult.output);
    if (!parsed) {
      console.warn(
        "[explain-prewarm] LLM output failed shape check kolId=%s traceId=%s",
        kolId,
        llmResult.traceId,
      );
      continue;
    }

    // (e) Write-through 5 locales. Per-locale write failure is logged
    // but doesn't abort — partial cache is acceptable (next user mount
    // will re-trigger pre-warm for missing locales).
    await Promise.all(
      LOCALES_ALL.map(async (loc) => {
        try {
          await writeShortExplanation(
            tenantId,
            campaignId,
            kolId,
            loc,
            parsed[loc],
            {
              tokenUsage: llmResult.usage.totalTokens,
              costUsd: llmResult.usage.costUsd,
              traceId: llmResult.traceId,
            },
          );
        } catch (err) {
          console.error(
            "[explain-prewarm] writeShortExplanation failed kolId=%s locale=%s:",
            kolId,
            loc,
            err,
          );
        }
      }),
    );

    // (f) audit
    void logAudit({
      actorId: "__system__",
      action: "ai_recommendation.explain_short_generated",
      targetType: "kol_campaign",
      targetId: `${campaignId}:${kolId}`,
      tenantId,
      after: {
        kolId,
        locales: LOCALES_ALL.length,
        tokenUsage: llmResult.usage.totalTokens,
        costUsd: llmResult.usage.costUsd,
        traceId: llmResult.traceId,
      },
    });
  }
}

/**
 * Register the worker on the process-wide queue singleton. Called once
 * at module load via src/lib/jobs/handlers/register.ts.
 */
export function registerExplainPrewarmHandler(): void {
  jobQueue.register<ExplainPrewarmPayload>(
    EXPLAIN_PREWARM_JOB,
    processExplainPrewarm,
  );
}
