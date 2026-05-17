/**
 * BL-068-F004 · Shared localStorage helpers for the conversational
 * refine cache. Extracted from `AiRecommendationPanel.tsx` so the
 * /match `?campaignId` route can read / write the same key + shape
 * for cross-page state portability (per spec §5 不变量 #7).
 *
 * Key + shape contract (per spec §F003 acceptance):
 *   - key:     `refine-{tenantId}-{campaignId}`
 *   - shape:   { orderedKolIds, feedback, rawQuery, createdAt: ISO8601 }
 *   - TTL:     24h strict from createdAt (per §5 不变量 #3)
 *
 * The fresh-pool cache used by AiRecommendationPanel (key
 * `campaign-recommendations-{tenantId}-{campaignId}`, shape with
 * fetchedAt:number) stays in that file — it is local to that
 * component and has no /match consumer.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

export interface RefineCacheShape {
  orderedKolIds: string[];
  feedback: string;
  rawQuery: string;
  /** ISO8601 timestamp (Date#toISOString). TTL computed via Date.parse. */
  createdAt: string;
}

export function refineCacheKey(tenantId: string, campaignId: string): string {
  return `refine-${tenantId}-${campaignId}`;
}

export function readRefineCache(key: string): RefineCacheShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RefineCacheShape;
    if (!Array.isArray(parsed.orderedKolIds)) return null;
    if (typeof parsed.createdAt !== "string") return null;
    const createdAtMs = Date.parse(parsed.createdAt);
    if (!Number.isFinite(createdAtMs)) return null;
    if (Date.now() - createdAtMs > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRefineCache(
  key: string,
  value: RefineCacheShape,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort — quota errors are silently ignored (BL-021 fix-1 pattern)
  }
}

export function clearRefineCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}
