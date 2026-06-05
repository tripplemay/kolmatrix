/**
 * BL-084-F005 · Cache invalidation for the AI Match Panel suggestion
 * cache (written by F004 getCampaignSuggestions).
 *
 * The cache key embeds the product's embeddingTextHash
 * (`campaign-ai-suggestions-{tenant}-{campaign}-{hash}`), which a
 * mutating action does not have on hand. We therefore SCAN + DEL by the
 * `...-{tenant}-{campaign}-*` prefix so any hash variant is cleared in one
 * shot. Errors are swallowed — a cache that fails to clear only means a
 * stale read until the 24h TTL elapses, never a failed user action.
 */
import { getRedis } from "@/lib/redis";

export function campaignSuggestionsCachePrefix(
  tenantId: string,
  campaignId: string,
): string {
  return `campaign-ai-suggestions-${tenantId}-${campaignId}-*`;
}

export async function invalidateCampaignSuggestionsCache(
  tenantId: string,
  campaignId: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const match = campaignSuggestionsCachePrefix(tenantId, campaignId);
    const stream = redis.scanStream({ match, count: 100 });
    const keys: string[] = [];
    for await (const batch of stream as AsyncIterable<string[]>) {
      keys.push(...batch);
    }
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error(
      "[suggestions-cache] invalidate failed for",
      `${tenantId}/${campaignId}:`,
      err,
    );
  }
}
