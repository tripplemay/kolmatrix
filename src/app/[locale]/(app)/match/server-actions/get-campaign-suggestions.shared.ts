/**
 * BL-084-F004 · Shared constants / error classes / types for the
 * getCampaignSuggestions server action.
 *
 * Lives in a NON-"use server" module because a "use server" file may
 * only export async functions (Next.js compile-time constraint —
 * generator.md §14). Constants, error classes, and types therefore can
 * not live alongside the action; they are imported by it and by the F006
 * UI / tests from here.
 */
import type { SmartMatchKolHit } from "@/lib/discovery/smart-match";

/** Cosine recall + rerank target. */
export const SUGGESTIONS_TOP_K = 30;

/** Cache TTL — 24h (spec §F004). */
export const SUGGESTIONS_CACHE_TTL_SEC = 24 * 60 * 60;

/** kol_campaign statuses that remove a KOL from the suggestion column. */
export const DECIDED_STATUSES = ["accepted", "skipped", "swap_pool"] as const;

export class CampaignNotFoundError extends Error {
  constructor(public readonly campaignId: string) {
    super(`campaign not found: ${campaignId}`);
    this.name = "CampaignNotFoundError";
  }
}

/**
 * Reserved structured error for a hard LLM-rerank failure. The current
 * rerankWithReason self-heals to cosine order (surfaced via
 * `rerankFallback`), so this is not thrown today — kept so callers /
 * future strict modes have a typed handle.
 */
export class LlmRerankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRerankError";
  }
}

export interface CampaignSuggestion extends SmartMatchKolHit {
  /** ≤15-word LLM match reason, or null on rerank fallback. */
  matchReason: string | null;
}

export interface CampaignSuggestionsData {
  suggestions: CampaignSuggestion[];
  /** True when served from the 24h Redis cache. */
  fromCache: boolean;
  /** True when the LLM rerank degraded to cosine order (no reasons). */
  rerankFallback: boolean;
  /** ISO8601 generation timestamp (for the "last generated XXh ago" hint). */
  generatedAt: string;
}

export type GetCampaignSuggestionsError =
  | "unauthorized"
  | "validation_failed"
  | "rate_limit_exceeded"
  | "campaign_not_found"
  | "product_missing"
  | "internal_error";

export type GetCampaignSuggestionsResult =
  | { ok: true; data: CampaignSuggestionsData }
  | { ok: false; error: GetCampaignSuggestionsError; retryAfter?: number };

export interface GetCampaignSuggestionsInput {
  campaignId: string;
  /** Manual refresh (F006) — bypass cache + regenerate + recache. */
  force?: boolean;
}

export interface CachedSuggestionsPayload {
  suggestions: CampaignSuggestion[];
  rerankFallback: boolean;
  generatedAt: string;
}

export function campaignSuggestionsCacheKey(
  tenantId: string,
  campaignId: string,
  embeddingTextHash: string | null,
): string {
  return `campaign-ai-suggestions-${tenantId}-${campaignId}-${embeddingTextHash ?? "noembed"}`;
}
