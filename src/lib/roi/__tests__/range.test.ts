import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROI_RANGE,
  isRoiRange,
  rangeDays,
  rangeStart,
  type RoiRange,
} from "../range";

describe("isRoiRange", () => {
  it("accepts the 4 valid range keys", () => {
    expect(isRoiRange("7d")).toBe(true);
    expect(isRoiRange("30d")).toBe(true);
    expect(isRoiRange("90d")).toBe(true);
    expect(isRoiRange("allTime")).toBe(true);
  });

  it("rejects unknown / falsy / wrong-cased values", () => {
    expect(isRoiRange("all")).toBe(false);
    expect(isRoiRange("180d")).toBe(false);
    expect(isRoiRange("alltime")).toBe(false);
    expect(isRoiRange(null)).toBe(false);
    expect(isRoiRange(undefined)).toBe(false);
    expect(isRoiRange(30)).toBe(false);
  });
});

describe("DEFAULT_ROI_RANGE", () => {
  it("is 30d to preserve the BM2-F009 legacy single-active toggle behavior", () => {
    expect(DEFAULT_ROI_RANGE).toBe("30d");
  });
});

describe("rangeDays", () => {
  it("maps each range to its bucket count (allTime caps at 365)", () => {
    expect(rangeDays("7d")).toBe(7);
    expect(rangeDays("30d")).toBe(30);
    expect(rangeDays("90d")).toBe(90);
    expect(rangeDays("allTime")).toBe(365);
  });
});

describe("rangeStart", () => {
  const NOW = new Date("2026-05-05T12:00:00.000Z");
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("returns NOW − N days for finite ranges", () => {
    expect(rangeStart("7d", NOW)).toEqual(new Date(NOW.getTime() - 7 * DAY_MS));
    expect(rangeStart("30d", NOW)).toEqual(new Date(NOW.getTime() - 30 * DAY_MS));
    expect(rangeStart("90d", NOW)).toEqual(new Date(NOW.getTime() - 90 * DAY_MS));
  });

  it("returns null for allTime so callers can skip the createdAt clause", () => {
    expect(rangeStart("allTime", NOW)).toBeNull();
  });

  it.each<RoiRange>(["7d", "30d", "90d"])(
    "is monotonically older for older ranges (%s)",
    (range) => {
      const cutoff = rangeStart(range, NOW)!;
      expect(cutoff.getTime()).toBeLessThan(NOW.getTime());
    }
  );
});
