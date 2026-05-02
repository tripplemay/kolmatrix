/**
 * BIx-mvp-polish-pass F004-P3 · `publishedAfter` slice rotation.
 *
 * The main daily matrix (14 region × 6 keyword) hammers default
 * relevance-ranked search.list output, which heavily skews to
 * established channels. To surface "newly emerging" creators that the
 * default ranking buries, the cron also runs a small extra phase that
 * passes `publishedAfter` to search.list — narrowing results to videos
 * uploaded inside one of four sliding windows.
 *
 * Spec §F004 #5: 4 windows (90 / 180 / 365 / 730 days), rotated by
 * `dayOfYear % 4`. Combined with the 6 core regions defined here the
 * phase costs 6 × 100u = 600u/day on top of the main 8,400u matrix.
 *
 * The slice count (i.e. how many of the 6 core regions actually run)
 * is configurable from `kol-sync-daily.ts` via env var
 * `KOL_SYNC_PUBLISHED_AFTER_SLICES` (default 6, fallback 4 when quota
 * is tight). Slice 0 disables the phase entirely.
 */

/** Sliding windows in days, in cycle order. Day 0 of cycle → 90d
 *  (newest cohort); day 3 → 730d (oldest cohort).  */
export const PUBLISHED_AFTER_WINDOWS_DAYS = [90, 180, 365, 730] as const;

/** The original B6 6-region set — densest gaming-creator markets. The
 *  publishedAfter phase deliberately stays narrow here rather than
 *  walking the full 14-region matrix, since the goal is to surface
 *  emerging channels in established markets where the relevance-rank
 *  bias is strongest. */
export const PUBLISHED_AFTER_CORE_REGIONS = ["CN", "HK", "TW", "US", "JP", "KR"] as const;

/**
 * Pick today's lookback window in days. Pure / deterministic — same
 * date always maps to the same window, so a cron miss only delays the
 * cycle by one day rather than corrupting it.
 */
export function pickPublishedAfterDays(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  const idx =
    ((dayOfYear % PUBLISHED_AFTER_WINDOWS_DAYS.length) + PUBLISHED_AFTER_WINDOWS_DAYS.length) %
    PUBLISHED_AFTER_WINDOWS_DAYS.length;
  return PUBLISHED_AFTER_WINDOWS_DAYS[idx]!;
}

/**
 * RFC-3339 ISO string for `date - days`. YouTube's search.list
 * `publishedAfter` accepts this exact format.
 */
export function publishedAfterIso(date: Date, days: number): string {
  return new Date(date.getTime() - days * 86_400_000).toISOString();
}
