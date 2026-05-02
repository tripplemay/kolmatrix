/**
 * BIx-mvp-polish-pass F004-P3 unit tests · tiered refresh picker.
 */
import { describe, expect, it } from "vitest";

import {
  pickBucketSlice,
  pickTieredRefreshIds,
  TIER1_CYCLE_DAYS,
  TIER1_TOP_N,
  TIER2_CYCLE_DAYS,
  TIER2_TOP_N,
} from "@/lib/kol-sync/refresh-selector";

const range = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}_${String(i).padStart(3, "0")}`);

describe("pickBucketSlice", () => {
  it("partitions an even list into N disjoint slices", () => {
    const ids = range("X", 9);
    const slices = [0, 1, 2].map((d) => pickBucketSlice(ids, d, 3));
    // Each slice has 3 ids, no overlap, covers the whole list.
    const flat = slices.flat();
    expect(flat).toHaveLength(9);
    expect(new Set(flat).size).toBe(9);
    for (const s of slices) expect(s).toHaveLength(3);
  });

  it("partitions an uneven list without dropping rows over a full cycle", () => {
    const ids = range("Y", 50);
    const buckets: string[] = [];
    for (let d = 0; d < TIER1_CYCLE_DAYS; d += 1) {
      buckets.push(...pickBucketSlice(ids, d, TIER1_CYCLE_DAYS));
    }
    expect(buckets).toHaveLength(50);
    expect(new Set(buckets).size).toBe(50);
  });

  it("returns [] for empty input or non-positive cycleDays", () => {
    expect(pickBucketSlice([], 0, 3)).toEqual([]);
    expect(pickBucketSlice(["A"], 0, 0)).toEqual([]);
  });

  it("handles negative dayOfYear (no JS modulo surprise)", () => {
    const ids = range("Z", 6);
    expect(pickBucketSlice(ids, -1, 3)).toEqual(pickBucketSlice(ids, 2, 3));
  });
});

describe("pickTieredRefreshIds", () => {
  // Pin to dayOfYear=1 so test asserts are deterministic.
  const day1 = new Date(Date.UTC(2026, 0, 1));

  it("includes flagged first and bucketed slices of each tier", () => {
    const tier1 = range("T1", TIER1_TOP_N);
    const tier2 = range("T2", TIER2_TOP_N - TIER1_TOP_N);
    const tier3 = range("T3", 1000);
    const flagged = ["FLAG_A", "FLAG_B"];

    const out = pickTieredRefreshIds({
      tier1,
      tier2,
      tier3,
      flagged,
      date: day1,
      maxTotal: 500, // big enough to fit everything for the assert
    });

    // Flagged comes first.
    expect(out.slice(0, 2)).toEqual(["FLAG_A", "FLAG_B"]);
    // Then tier 1 / 2 / 3 slices for dayOfYear=1.
    const tier1Slice = pickBucketSlice(tier1, 1, TIER1_CYCLE_DAYS);
    const tier2Slice = pickBucketSlice(tier2, 1, TIER2_CYCLE_DAYS);
    expect(out.slice(2, 2 + tier1Slice.length)).toEqual([...tier1Slice]);
    expect(out.slice(2 + tier1Slice.length, 2 + tier1Slice.length + tier2Slice.length)).toEqual([
      ...tier2Slice,
    ]);
  });

  it("dedupes ids that appear in multiple tiers (e.g. flagged top-50 channel)", () => {
    const out = pickTieredRefreshIds({
      tier1: ["X", "Y", "Z"],
      tier2: [],
      tier3: [],
      flagged: ["X"],
      date: day1,
      maxTotal: 50,
    });
    // X appears once at flagged position; the tier1 bucket containing
    // X drops it from the second occurrence.
    expect(out.indexOf("X")).toBe(0);
    expect(out.filter((id) => id === "X")).toHaveLength(1);
  });

  it("truncates to maxTotal, prioritising flagged + tier1 over the long-tail", () => {
    const tier1 = range("T1", 50);
    const tier2 = range("T2", 450);
    const tier3 = range("T3", 1000);
    const flagged = range("FLAG", 5);

    const out = pickTieredRefreshIds({
      tier1,
      tier2,
      tier3,
      flagged,
      date: day1,
      maxTotal: 30,
    });
    expect(out).toHaveLength(30);
    // First 5 are flagged, rest dip into tier1 (highest priority).
    expect(out.slice(0, 5)).toEqual(flagged);
    expect(out.every((id) => !id.startsWith("T3_"))).toBe(true);
  });

  it("a full Tier 1 cycle covers the whole top-50 exactly once", () => {
    const tier1 = range("T1", 50);
    const seen = new Set<string>();
    for (let d = 0; d < TIER1_CYCLE_DAYS; d += 1) {
      const out = pickTieredRefreshIds({
        tier1,
        tier2: [],
        tier3: [],
        flagged: [],
        date: new Date(Date.UTC(2026, 0, d + 1)),
        maxTotal: 200,
      });
      for (const id of out) seen.add(id);
    }
    expect(seen.size).toBe(50);
  });
});
