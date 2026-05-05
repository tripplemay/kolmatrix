/**
 * BL-024-F003 — `/weekly-report` time-range toggle.
 *
 * - `lastWeek`  → current ISO week (Mon-Sun, 7 days)
 * - `lastMonth` → trailing 28 days (4 ISO weeks ending current Sunday)
 *
 * 28-day rather than calendar-month per spec D4 — uniform week
 * multiples avoid leap-year / timezone drift and stay easy to mock
 * in tests.
 */
import { isoWeekStartUtc } from "./dates";

export type WeeklyReportRange = "lastWeek" | "lastMonth";

export const DEFAULT_WEEKLY_REPORT_RANGE: WeeklyReportRange = "lastWeek";

export function isWeeklyReportRange(value: unknown): value is WeeklyReportRange {
  return value === "lastWeek" || value === "lastMonth";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function rangePeriodDays(range: WeeklyReportRange): number {
  return range === "lastMonth" ? 28 : 7;
}

/**
 * Resolve the period start/end (UTC, day-aligned) for a given range.
 *
 * - `lastWeek`  → start = Monday 00:00 of the week containing `now`,
 *                end   = +6d (Sunday). Matches BM2-F010 default.
 * - `lastMonth` → start = `lastWeek` start − 21d (Monday 4 weeks ago),
 *                end   = `lastWeek` end (Sunday of current week).
 */
export function rangeBounds(
  range: WeeklyReportRange,
  now: Date = new Date()
): { weekStart: Date; weekEnd: Date } {
  const weekStartCurrent = isoWeekStartUtc(now);
  if (range === "lastWeek") {
    return {
      weekStart: weekStartCurrent,
      weekEnd: new Date(weekStartCurrent.getTime() + 6 * DAY_MS),
    };
  }
  // lastMonth: 4 ISO weeks ending current Sunday
  return {
    weekStart: new Date(weekStartCurrent.getTime() - 21 * DAY_MS),
    weekEnd: new Date(weekStartCurrent.getTime() + 6 * DAY_MS),
  };
}
