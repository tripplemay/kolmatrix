import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEEKLY_REPORT_RANGE,
  isWeeklyReportRange,
  rangeBounds,
  rangePeriodDays,
} from "../range";

describe("isWeeklyReportRange", () => {
  it("accepts the 2 valid range keys", () => {
    expect(isWeeklyReportRange("lastWeek")).toBe(true);
    expect(isWeeklyReportRange("lastMonth")).toBe(true);
  });

  it("rejects unknown / falsy values", () => {
    expect(isWeeklyReportRange("week")).toBe(false);
    expect(isWeeklyReportRange("28d")).toBe(false);
    expect(isWeeklyReportRange(null)).toBe(false);
    expect(isWeeklyReportRange(undefined)).toBe(false);
  });
});

describe("DEFAULT_WEEKLY_REPORT_RANGE", () => {
  it("is lastWeek to preserve the BM2-F010 default behavior", () => {
    expect(DEFAULT_WEEKLY_REPORT_RANGE).toBe("lastWeek");
  });
});

describe("rangePeriodDays", () => {
  it("lastWeek = 7, lastMonth = 28 (4 ISO weeks)", () => {
    expect(rangePeriodDays("lastWeek")).toBe(7);
    expect(rangePeriodDays("lastMonth")).toBe(28);
  });
});

describe("rangeBounds", () => {
  // Anchor a deterministic Wednesday in May 2026 — ISO Monday = 2026-05-04.
  const NOW = new Date("2026-05-06T08:30:00.000Z");
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("lastWeek spans the current ISO week (Mon → Sun)", () => {
    const { weekStart, weekEnd } = rangeBounds("lastWeek", NOW);
    expect(weekStart.toISOString().slice(0, 10)).toBe("2026-05-04");
    expect(weekEnd.toISOString().slice(0, 10)).toBe("2026-05-10");
    expect(
      Math.round((weekEnd.getTime() - weekStart.getTime()) / DAY_MS) + 1
    ).toBe(7);
  });

  it("lastMonth spans 4 ISO weeks ending current Sunday", () => {
    const { weekStart, weekEnd } = rangeBounds("lastMonth", NOW);
    expect(weekStart.toISOString().slice(0, 10)).toBe("2026-04-13");
    expect(weekEnd.toISOString().slice(0, 10)).toBe("2026-05-10");
    expect(
      Math.round((weekEnd.getTime() - weekStart.getTime()) / DAY_MS) + 1
    ).toBe(28);
  });

  it("Monday boundary still resolves to Monday (no off-by-one)", () => {
    const monday = new Date("2026-05-04T00:00:00.000Z");
    expect(rangeBounds("lastWeek", monday).weekStart.toISOString().slice(0, 10))
      .toBe("2026-05-04");
    expect(rangeBounds("lastMonth", monday).weekStart.toISOString().slice(0, 10))
      .toBe("2026-04-13");
  });

  it("Sunday boundary still anchors to that ISO week's Monday", () => {
    const sunday = new Date("2026-05-10T23:00:00.000Z");
    expect(rangeBounds("lastWeek", sunday).weekStart.toISOString().slice(0, 10))
      .toBe("2026-05-04");
    expect(rangeBounds("lastMonth", sunday).weekEnd.toISOString().slice(0, 10))
      .toBe("2026-05-10");
  });
});
