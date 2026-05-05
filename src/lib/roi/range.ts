/**
 * BL-024-F002 — `/roi` time-range toggle (mirrors BIx F001 `/crm` pattern).
 *
 * - `7d` / `30d` / `90d` resolve to `NOW - N day` cutoffs applied to
 *   completed campaigns' `closedAt` (preserves the BM2-F008 "trend
 *   over closed campaigns" semantics — switching the toggle changes
 *   how far back we look, not which timestamp is the axis).
 * - `allTime` = no cutoff (current legacy default outside the 30D window).
 * - Active campaigns are always counted in summary regardless of cutoff.
 *
 * `rangeDays` returns the bucket count for `loadRoiTrend`; `allTime`
 * caps at 365 daily buckets so the trend chart stays bounded.
 */
export type RoiRange = "7d" | "30d" | "90d" | "allTime";

export const DEFAULT_ROI_RANGE: RoiRange = "30d";

export function isRoiRange(value: unknown): value is RoiRange {
  return (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "allTime"
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function rangeStart(
  range: RoiRange,
  now: Date = new Date()
): Date | null {
  if (range === "allTime") return null;
  const days = rangeDays(range);
  return new Date(now.getTime() - days * DAY_MS);
}

export function rangeDays(range: RoiRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 365;
}
