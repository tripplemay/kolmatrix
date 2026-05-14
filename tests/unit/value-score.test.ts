import { describe, expect, it } from "vitest";

import {
  authenticityModifier,
  computeKolValueScore,
  engagementScoreFromRate,
} from "@/lib/kol/value-score";

describe("engagementScoreFromRate (BL-066-F007 / ADR-014 v2 ladder)", () => {
  it("returns placeholder=12 when rate is null/undefined/NaN (sits ABOVE <5% real)", () => {
    // v2 semantic: 'we don't know' is neutral; only confirmed-low gets penalised.
    expect(engagementScoreFromRate(null)).toBe(12);
    expect(engagementScoreFromRate(undefined)).toBe(12);
    expect(engagementScoreFromRate(NaN)).toBe(12);
  });

  it("maps <5% real (confirmed below-the-bar) to 8", () => {
    expect(engagementScoreFromRate(0)).toBe(8);
    expect(engagementScoreFromRate(0.5)).toBe(8);
    expect(engagementScoreFromRate(2)).toBe(8);
    expect(engagementScoreFromRate(4.2)).toBe(8);
    expect(engagementScoreFromRate(4.99)).toBe(8);
  });

  it("maps 5-8% to 12 (working floor)", () => {
    expect(engagementScoreFromRate(5)).toBe(12);
    expect(engagementScoreFromRate(6.5)).toBe(12);
    expect(engagementScoreFromRate(7.99)).toBe(12);
  });

  it("maps 8-12% to 16 (top-tier mid)", () => {
    expect(engagementScoreFromRate(8)).toBe(16);
    expect(engagementScoreFromRate(10)).toBe(16);
    expect(engagementScoreFromRate(11.99)).toBe(16);
  });

  it("maps 12-16% to 20 (top-tier high)", () => {
    expect(engagementScoreFromRate(12)).toBe(20);
    expect(engagementScoreFromRate(13)).toBe(20);
    expect(engagementScoreFromRate(15.99)).toBe(20);
  });

  it("maps >=16% to 25 (viral cap — replaces BL-023 v1's 20-ceiling)", () => {
    expect(engagementScoreFromRate(16)).toBe(25);
    expect(engagementScoreFromRate(20)).toBe(25);
    expect(engagementScoreFromRate(50)).toBe(25);
  });
});

describe("authenticityModifier (BL-023-F002, unchanged in v2)", () => {
  it("returns 1.0 (neutral) for null/undefined/NaN", () => {
    expect(authenticityModifier(null)).toBe(1.0);
    expect(authenticityModifier(undefined)).toBe(1.0);
    expect(authenticityModifier(NaN)).toBe(1.0);
  });

  it("rewards >=80 with a 5% boost", () => {
    expect(authenticityModifier(80)).toBe(1.05);
    expect(authenticityModifier(95)).toBe(1.05);
    expect(authenticityModifier(100)).toBe(1.05);
  });

  it("treats 60-79 as neutral", () => {
    expect(authenticityModifier(60)).toBe(1.0);
    expect(authenticityModifier(70)).toBe(1.0);
    expect(authenticityModifier(79)).toBe(1.0);
  });

  it("penalises <60 by 15% (suspected bot/buy)", () => {
    expect(authenticityModifier(0)).toBe(0.85);
    expect(authenticityModifier(45)).toBe(0.85);
    expect(authenticityModifier(59)).toBe(0.85);
  });
});

describe("computeKolValueScore — structural invariants (v2)", () => {
  it("reaches total=100 at 1M followers + 12% engagement + 3 cats (RAW_MAX 95 design)", () => {
    // followerScore = log10(1M)*10 = 60
    // engagementScore = 20 (12% in 12-16 bucket)
    // categoryScore = min(15, 3*8) = 15
    // raw = 95; normalize = 95*1.0*100/95 = 100 exact
    const result = computeKolValueScore({
      followerCount: 1_000_000,
      categories: ["moba", "rpg", "fps"],
      engagementRate: 12,
    });
    expect(result.total).toBe(100);
    expect(result.rawBreakdown.follower).toBe(60);
    expect(result.rawBreakdown.engagement).toBe(20);
    expect(result.rawBreakdown.category).toBe(15);
    expect(result.authenticityModifier).toBe(1.0);
  });

  it("clamps total to <=100 even when sub-sum max (120) × 1.05 boost would overflow", () => {
    // 100M / 16%+ / 3+ cats with high authenticity:
    // follower 80 + engagement 25 + category 15 = 120 (sub-sum max)
    // 120 * 1.05 * 100 / 95 ≈ 132.6 → clamp 100
    const boosted = computeKolValueScore({
      followerCount: 100_000_000,
      categories: ["moba", "rpg", "fps"],
      engagementRate: 20,
      engagementAuthenticity: 90, // 1.05x boost
    });
    expect(boosted.total).toBe(100);
    expect(boosted.rawBreakdown.follower).toBe(80);
    expect(boosted.rawBreakdown.engagement).toBe(25);
    expect(boosted.rawBreakdown.category).toBe(15);
    expect(boosted.authenticityModifier).toBe(1.05);
  });

  it("ranks larger follower counts higher while below the new cap (reached at 100M)", () => {
    const low = computeKolValueScore({ followerCount: 200, categories: ["casual"] });
    const mid = computeKolValueScore({ followerCount: 800, categories: ["casual"] });
    const high = computeKolValueScore({ followerCount: 2_000, categories: ["casual"] });
    const ultra = computeKolValueScore({ followerCount: 200_000, categories: ["casual"] });
    expect(low.total).toBeLessThan(mid.total);
    expect(mid.total).toBeLessThan(high.total);
    expect(high.total).toBeLessThan(ultra.total);
  });

  it("clamps follower contribution at 80 once followers exceed ~100M (BL-048 fix)", () => {
    const justAtCap = computeKolValueScore({ followerCount: 100_000_000, categories: [] });
    const massive = computeKolValueScore({ followerCount: 10_000_000_000, categories: [] });
    expect(justAtCap.rawBreakdown.follower).toBe(80);
    expect(massive.rawBreakdown.follower).toBe(80);
    expect(justAtCap.total).toBe(massive.total);
  });

  it("floors follower input at 100 so tiny channels do not log-negative", () => {
    const tiny = computeKolValueScore({ followerCount: 0, categories: [] });
    // log10(100)=2 → *10 = 20
    expect(tiny.rawBreakdown.follower).toBe(20);
    // engagement placeholder=12 + follower 20 + category 0 = 32
    // round(32*1.0*100/95) = round(33.68) = 34
    expect(tiny.total).toBe(34);
  });

  it("caps category bonus at 2+ categories (slope 8/cat, cap 15)", () => {
    const two = computeKolValueScore({ followerCount: 10_000, categories: ["a", "b"] });
    const five = computeKolValueScore({
      followerCount: 10_000,
      categories: ["a", "b", "c", "d", "e"],
    });
    // 2*8=16 cap 15; 5*8=40 cap 15
    expect(two.rawBreakdown.category).toBe(15);
    expect(five.rawBreakdown.category).toBe(15);
    expect(two.total).toBe(five.total);
  });

  it("differentiates 1-cat (=8) from 2+ cats (=15) since slope is preserved", () => {
    const one = computeKolValueScore({ followerCount: 10_000, categories: ["a"] });
    const two = computeKolValueScore({ followerCount: 10_000, categories: ["a", "b"] });
    expect(one.rawBreakdown.category).toBe(8);
    expect(two.rawBreakdown.category).toBe(15);
    expect(one.total).toBeLessThan(two.total);
  });

  it("returns an integer total in the inclusive 0-100 range for plausible input", () => {
    for (const followerCount of [0, 1_000, 10_000, 100_000, 1_000_000, 50_000_000]) {
      for (const catCount of [0, 1, 2, 3, 5]) {
        for (const rate of [null, 0.5, 4.2, 12.5]) {
          for (const auth of [null, 50, 70, 90]) {
            const { total } = computeKolValueScore({
              followerCount,
              categories: Array.from({ length: catCount }, (_, i) => `cat${i}`),
              engagementRate: rate,
              engagementAuthenticity: auth,
            });
            expect(Number.isInteger(total)).toBe(true);
            expect(total).toBeGreaterThanOrEqual(0);
            expect(total).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });
});

describe("computeKolValueScore — v2 engagement signal", () => {
  it("uses real engagement_rate when present (4.2% → 8, <5% real bucket)", () => {
    const result = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: 4.2,
    });
    // followerScore = min(80, log10(100_000)*10) = min(80, 50) = 50
    // engagementScore = 8 (<5% real bucket)
    // categoryScore = min(15, 2*8) = 15
    // raw = 73; modifier = 1.0; total = round(73*100/95) = round(76.84) = 77
    expect(result.rawBreakdown.engagement).toBe(8);
    expect(result.total).toBe(77);
  });

  it("treats null engagement (unknown) as ABOVE confirmed <5% but BELOW confirmed-high", () => {
    // v2 semantic: known-high > unknown(placeholder) > known-low
    const knownLow = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: 4.2, // <5% → 8
    });
    const unknown = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: null, // placeholder → 12
    });
    const knownHigh = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: 10, // 8-12% → 16
    });
    expect(knownLow.rawBreakdown.engagement).toBe(8);
    expect(unknown.rawBreakdown.engagement).toBe(12);
    expect(knownHigh.rawBreakdown.engagement).toBe(16);
    expect(knownLow.total).toBeLessThan(unknown.total);
    expect(unknown.total).toBeLessThan(knownHigh.total);
  });

  it("authenticity penalty drops total below the neutral-modifier baseline", () => {
    const neutral = computeKolValueScore({
      followerCount: 50_000,
      categories: ["fps"],
      engagementRate: 4.0, // <5% → 8
      engagementAuthenticity: null,
    });
    const flagged = computeKolValueScore({
      followerCount: 50_000,
      categories: ["fps"],
      engagementRate: 4.0,
      engagementAuthenticity: 30, // <60 → 0.85x penalty
    });
    expect(flagged.total).toBeLessThan(neutral.total);
    expect(flagged.authenticityModifier).toBe(0.85);
  });
});

describe("computeKolValueScore — BL-048 fix regression (mega vs nano differentiation)", () => {
  // The original BL-048 backlog grievance: prod top-15 valueScore=100
  // included both @gameseduuu (12.6M followers, 13% engagement, 5 cats)
  // and @morrov8721 (2.08K followers, 12% engagement, 5 cats). Under the
  // BL-023 v1 formula they tied at 100; under v2 they must differ by
  // ≥20 total — per Planner verdict #7 (audit §6).

  it("@gameseduuu (12.6M / 13% / 5 cats) outscores @morrov8721 (2.08K / 12% / 5 cats) by >=20", () => {
    const mega = computeKolValueScore({
      followerCount: 12_600_000,
      categories: ["a", "b", "c", "d", "e"],
      engagementRate: 13,
    });
    const nano = computeKolValueScore({
      followerCount: 2_080,
      categories: ["a", "b", "c", "d", "e"],
      engagementRate: 12,
    });
    expect(mega.total).toBeGreaterThanOrEqual(nano.total + 20);
    // Concrete expected values (mega caps to 100 from clamp; nano lands ~72):
    expect(mega.total).toBe(100);
    expect(nano.total).toBe(72);
  });

  it("mid-tier 100K / 10% / 3 cats lands in 80s, not tied with mega", () => {
    // follower = 50; engagement = 16 (8-12% bucket); category = 15
    // raw = 81; total = round(81*100/95) = round(85.26) = 85
    const mid = computeKolValueScore({
      followerCount: 100_000,
      categories: ["a", "b", "c"],
      engagementRate: 10,
    });
    expect(mid.rawBreakdown.follower).toBe(50);
    expect(mid.rawBreakdown.engagement).toBe(16);
    expect(mid.rawBreakdown.category).toBe(15);
    expect(mid.total).toBe(85);
  });

  it("ladder boundary cases match v2 spec exactly", () => {
    const at5 = computeKolValueScore({
      followerCount: 100_000,
      categories: ["a"],
      engagementRate: 5,
    });
    const at8 = computeKolValueScore({
      followerCount: 100_000,
      categories: ["a"],
      engagementRate: 8,
    });
    const at12 = computeKolValueScore({
      followerCount: 100_000,
      categories: ["a"],
      engagementRate: 12,
    });
    const at16 = computeKolValueScore({
      followerCount: 100_000,
      categories: ["a"],
      engagementRate: 16,
    });
    expect(at5.rawBreakdown.engagement).toBe(12);
    expect(at8.rawBreakdown.engagement).toBe(16);
    expect(at12.rawBreakdown.engagement).toBe(20);
    expect(at16.rawBreakdown.engagement).toBe(25);
  });
});
