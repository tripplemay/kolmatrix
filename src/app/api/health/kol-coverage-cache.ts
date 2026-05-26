/**
 * BL-075-F006 · 5-minute in-memory cache for the KOL coverage snapshot
 * surfaced on `GET /api/health`.
 *
 * Lives in its own module rather than inside `route.ts` because
 * Next.js's per-route type validator rejects any export other than
 * the standard HTTP method handlers + `runtime` / `dynamic`. Putting
 * the cache + test-only reset here keeps `route.ts` validator-clean
 * while still letting the unit tests pin / reset cache state.
 */

export interface KolCoverageSnapshot {
  country_fill_rate: number;
  language_fill_rate: number;
  total_active_kols: number;
  last_updated: string;
}

export const KOL_COVERAGE_CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { data: KolCoverageSnapshot; expiresAt: number } | null = null;

export function readKolCoverageCache(now: number = Date.now()): KolCoverageSnapshot | null {
  if (!cache) return null;
  if (cache.expiresAt <= now) return null;
  return cache.data;
}

export function writeKolCoverageCache(
  data: KolCoverageSnapshot,
  now: number = Date.now(),
): void {
  cache = { data, expiresAt: now + KOL_COVERAGE_CACHE_TTL_MS };
}

export function resetKolCoverageCache(): void {
  cache = null;
}
