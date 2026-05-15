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
import { readShortExplanation } from "@/lib/explainability/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = new Set(["en", "zh", "ja", "ko", "es"]);
const MAX_KOL_IDS = 60; // headroom over the 30 top-K + safety against payload bombs

export type ExplainabilityActionError =
  | "unauthorized"
  | "validation_failed";

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
