"use server";

/**
 * BL-084-F004 · Server action — getCampaignSuggestions(campaignId).
 *
 * Orchestrates the AI Match Panel's "推荐池" column:
 *   1. auth + UUID validation + per-tenant AI rate limit (≤10/min, BL-068 quota)
 *   2. Load campaign (name / markets / budget / productId) via RLS
 *   3. Load product (targetAudience + embeddingTextHash) — embeddingTextHash
 *      is the cache-key suffix so a product/brief edit auto-invalidates
 *   4. 24h Redis cache lookup (skip on force=true)
 *   5. Miss → runSmartMatch (F001, cosine recall top-30) → exclude KOLs
 *      already decided in kol_campaign (accepted/skipped/swap_pool) →
 *      rerankWithReason (F002, LLM reorder + match reasons) → merge
 *   6. Cache the result 24h, return
 *
 * Degradation: the LLM rerank self-heals to cosine order (rerankFallback
 * flag surfaced for the UI). Redis errors are swallowed — a cache outage
 * degrades to "always recompute", never a hard failure.
 *
 * Constants / error classes / types live in
 * ./get-campaign-suggestions.shared (a "use server" file may only export
 * async functions).
 */
import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import {
  runSmartMatch,
  SmartMatchError,
  type SmartMatchKolHit,
} from "@/lib/discovery/smart-match";
import {
  rerankWithReason,
  type RerankCampaignMeta,
} from "@/lib/match/llm-rerank";
import { rateLimitAi } from "@/lib/rate-limit-ai";
import { getRedis } from "@/lib/redis";

import {
  campaignSuggestionsCacheKey,
  DECIDED_STATUSES,
  SUGGESTIONS_CACHE_TTL_SEC,
  SUGGESTIONS_TOP_K,
  type CachedSuggestionsPayload,
  type CampaignSuggestion,
  type GetCampaignSuggestionsInput,
  type GetCampaignSuggestionsResult,
} from "./get-campaign-suggestions.shared";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCampaignSuggestions(
  input: GetCampaignSuggestionsInput,
): Promise<GetCampaignSuggestionsResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return { ok: false, error: "unauthorized" };
  }
  if (!UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "validation_failed" };
  }

  // Per-tenant AI rate limit (shared 10/min quota, BL-068 parity).
  const rl = await rateLimitAi(tenantId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  // Load campaign + product meta (RLS-scoped).
  let campaign:
    | {
        name: string;
        markets: string[];
        budgetAmount: { toNumber: () => number } | null;
        productId: string | null;
      }
    | null;
  try {
    campaign = await withTenant(tenantId, (tx) =>
      tx.campaign.findFirst({
        where: { id: input.campaignId, deletedAt: null },
        select: {
          name: true,
          markets: true,
          budgetAmount: true,
          productId: true,
        },
      }),
    );
  } catch (err) {
    console.error("[getCampaignSuggestions] campaign fetch failed:", err);
    return { ok: false, error: "internal_error" };
  }

  if (!campaign) {
    return { ok: false, error: "campaign_not_found" };
  }
  if (!campaign.productId) {
    // No product → no embedding proxy → cannot recommend.
    return { ok: false, error: "product_missing" };
  }
  const productId = campaign.productId;

  let product:
    | { targetAudience: string; embeddingTextHash: string | null }
    | null;
  try {
    product = await withTenant(tenantId, (tx) =>
      tx.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { targetAudience: true, embeddingTextHash: true },
      }),
    );
  } catch (err) {
    console.error("[getCampaignSuggestions] product fetch failed:", err);
    return { ok: false, error: "internal_error" };
  }
  if (!product) {
    return { ok: false, error: "product_missing" };
  }

  const key = campaignSuggestionsCacheKey(
    tenantId,
    input.campaignId,
    product.embeddingTextHash,
  );

  // 1. Cache lookup (unless force refresh).
  if (!input.force) {
    const cached = await readCache(key);
    if (cached) {
      return {
        ok: true,
        data: {
          suggestions: cached.suggestions,
          fromCache: true,
          rerankFallback: cached.rerankFallback,
          generatedAt: cached.generatedAt,
        },
      };
    }
  }

  // 2. Cosine recall (F001).
  let cosineHits: SmartMatchKolHit[];
  try {
    const matchResult = await runSmartMatch({
      tenantId,
      productId,
      topK: SUGGESTIONS_TOP_K,
      campaignId: input.campaignId,
      actorId: userId,
    });
    cosineHits = matchResult.results;
  } catch (err) {
    if (err instanceof SmartMatchError) {
      if (err.code === "product_not_found") {
        return { ok: false, error: "product_missing" };
      }
      console.error("[getCampaignSuggestions] smart-match error:", err.code);
      return { ok: false, error: "internal_error" };
    }
    console.error("[getCampaignSuggestions] smart-match unexpected:", err);
    return { ok: false, error: "internal_error" };
  }

  // 3. Exclude KOLs already decided for this campaign (per F005 contract).
  let decidedIds: Set<string>;
  try {
    decidedIds = await loadDecidedKolIds(tenantId, input.campaignId);
  } catch (err) {
    console.error("[getCampaignSuggestions] decided fetch failed:", err);
    return { ok: false, error: "internal_error" };
  }
  const candidates = cosineHits.filter((h) => !decidedIds.has(h.id));

  // 4. LLM rerank + reasons (F002, self-healing fallback).
  const campaignMeta: RerankCampaignMeta = {
    name: campaign.name,
    markets: campaign.markets,
    targetAudience: product.targetAudience,
    budget: campaign.budgetAmount ? campaign.budgetAmount.toNumber() : null,
  };
  const { rank, matchReasons, fallback } = await rerankWithReason(
    candidates,
    campaignMeta,
    { tenantId, actorId: userId },
  );

  const suggestions: CampaignSuggestion[] = rank.map((hit) => ({
    ...hit,
    matchReason: matchReasons.get(hit.id) ?? null,
  }));

  const generatedAt = new Date().toISOString();

  // 5. Cache 24h (swallow Redis errors).
  await writeCache(key, {
    suggestions,
    rerankFallback: fallback,
    generatedAt,
  });

  return {
    ok: true,
    data: { suggestions, fromCache: false, rerankFallback: fallback, generatedAt },
  };
}

async function loadDecidedKolIds(
  tenantId: string,
  campaignId: string,
): Promise<Set<string>> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.kolCampaign.findMany({
      where: {
        campaignId,
        suggestionStatus: { in: [...DECIDED_STATUSES] },
      },
      select: { kolId: true },
    }),
  );
  return new Set(rows.map((r: { kolId: string }) => r.kolId));
}

async function readCache(key: string): Promise<CachedSuggestionsPayload | null> {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSuggestionsPayload;
    if (!Array.isArray(parsed.suggestions)) return null;
    return parsed;
  } catch (err) {
    console.error("[getCampaignSuggestions] cache read failed:", err);
    return null;
  }
}

async function writeCache(
  key: string,
  payload: CachedSuggestionsPayload,
): Promise<void> {
  try {
    await getRedis().set(
      key,
      JSON.stringify(payload),
      "EX",
      SUGGESTIONS_CACHE_TTL_SEC,
    );
  } catch (err) {
    console.error("[getCampaignSuggestions] cache write failed:", err);
  }
}
