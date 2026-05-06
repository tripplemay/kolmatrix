import { describe, expect, it } from "vitest";

import {
  authenticityModifier,
  computeKolValueScore,
  engagementScoreFromRate,
} from "@/lib/kol/value-score";

describe("engagementScoreFromRate (BL-023-F001)", () => {
  it("returns placeholder=12 when rate is null/undefined/NaN", () => {
    expect(engagementScoreFromRate(null)).toBe(12);
    expect(engagementScoreFromRate(undefined)).toBe(12);
    expect(engagementScoreFromRate(NaN)).toBe(12);
  });

  it("maps the 5-segment ladder (<1 / 1-3 / 3-6 / 6-10 / >=10)", () => {
    // <1%
    expect(engagementScoreFromRate(0)).toBe(5);
    expect(engagementScoreFromRate(0.5)).toBe(5);
    expect(engagementScoreFromRate(0.99)).toBe(5);
    // 1-3%
    expect(engagementScoreFromRate(1)).toBe(10);
    expect(engagementScoreFromRate(2.5)).toBe(10);
    // 3-6%
    expect(engagementScoreFromRate(3)).toBe(15);
    expect(engagementScoreFromRate(4.2)).toBe(15);
    expect(engagementScoreFromRate(5.99)).toBe(15);
    // 6-10%
    expect(engagementScoreFromRate(6)).toBe(18);
    expect(engagementScoreFromRate(8)).toBe(18);
    expect(engagementScoreFromRate(9.99)).toBe(18);
    // >=10%
    expect(engagementScoreFromRate(10)).toBe(20);
    expect(engagementScoreFromRate(12.5)).toBe(20);
    expect(engagementScoreFromRate(50)).toBe(20);
  });
});

describe("authenticityModifier (BL-023-F002)", () => {
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

describe("computeKolValueScore — structural invariants", () => {
  it("normalizes raw max (50 + 20 + 20 = 90) to 100", () => {
    // 1,000,000 followers → log10=6 → *15 → capped at 50
    // engagementRate 12% → engagement segment = 20 (max)
    // 3 categories → 24 → capped at 20
    const result = computeKolValueScore({
      followerCount: 1_000_000,
      categories: ["moba", "rpg", "fps"],
      engagementRate: 12,
    });
    expect(result.total).toBe(100);
    expect(result.rawBreakdown.follower).toBe(50);
    expect(result.rawBreakdown.engagement).toBe(20);
    expect(result.rawBreakdown.category).toBe(20);
    expect(result.authenticityModifier).toBe(1.0);
  });

  it("clamps total to <=100 even when authenticity=1.05 boost would overflow", () => {
    const boosted = computeKolValueScore({
      followerCount: 1_000_000,
      categories: ["moba", "rpg", "fps"],
      engagementRate: 12,
      engagementAuthenticity: 90, // 1.05x boost
    });
    expect(boosted.total).toBe(100);
    expect(boosted.authenticityModifier).toBe(1.05);
  });

  it("ranks larger follower counts higher while below the cap (~2,154 followers)", () => {
    const low = computeKolValueScore({ followerCount: 200, categories: ["casual"] });
    const mid = computeKolValueScore({ followerCount: 800, categories: ["casual"] });
    const high = computeKolValueScore({ followerCount: 2_000, categories: ["casual"] });
    expect(low.total).toBeLessThan(mid.total);
    expect(mid.total).toBeLessThan(high.total);
  });

  it("clamps follower contribution once followers exceed the cap", () => {
    const justAboveCap = computeKolValueScore({ followerCount: 3_000, categories: [] });
    const massive = computeKolValueScore({ followerCount: 10_000_000, categories: [] });
    expect(justAboveCap.rawBreakdown.follower).toBe(50);
    expect(massive.rawBreakdown.follower).toBe(50);
    expect(justAboveCap.total).toBe(massive.total);
  });

  it("floors follower input at 100 so tiny channels do not log-negative", () => {
    const tiny = computeKolValueScore({ followerCount: 0, categories: [] });
    // log10(100)=2 → *15 = 30
    expect(tiny.rawBreakdown.follower).toBe(30);
    // engagement placeholder=12 + follower 30 + category 0 = 42; round(42*1.0*100/90) = 47
    expect(tiny.total).toBe(47);
  });

  it("caps category bonus at 3+ categories", () => {
    const three = computeKolValueScore({ followerCount: 10_000, categories: ["a", "b", "c"] });
    const five = computeKolValueScore({
      followerCount: 10_000,
      categories: ["a", "b", "c", "d", "e"],
    });
    expect(three.rawBreakdown.category).toBe(20);
    expect(five.rawBreakdown.category).toBe(20);
    expect(three.total).toBe(five.total);
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

describe("computeKolValueScore — BL-023 engagement signal", () => {
  it("uses real engagement_rate when present (4.2% → segment 15)", () => {
    const result = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: 4.2,
    });
    // followerScore = min(50, log10(100_000)*15) = min(50, 75) = 50
    // engagementScore = 15 (3-6% bucket)
    // categoryScore = min(20, 2*8) = 16
    // raw = 81; modifier = 1.0; total = round(81*100/90) = 90
    expect(result.rawBreakdown.engagement).toBe(15);
    expect(result.total).toBe(90);
  });

  it("falls back to placeholder=12 when engagement_rate is null", () => {
    const real = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: 4.2,
    });
    const unknown = computeKolValueScore({
      followerCount: 100_000,
      categories: ["moba", "fps"],
      engagementRate: null,
    });
    expect(unknown.rawBreakdown.engagement).toBe(12);
    expect(unknown.total).toBeLessThan(real.total);
  });

  it("regression: prior fixed engagement=15 → new placeholder=12 stays within ±15 of prior totals", () => {
    // Before BL-023: total = round((follower + 15 + category) * 100 / 85)
    // After  BL-023 (null engagement): total = round((follower + 12 + category) * 100 / 90)
    // Spec acceptance: |delta| ≤ 15 across plausible inputs.
    for (const followerCount of [500, 10_000, 100_000, 1_000_000]) {
      for (const catCount of [0, 1, 2, 3]) {
        const followers = Math.max(followerCount, 100);
        const followerScore = Math.min(50, Math.log10(followers) * 15);
        const categoryScore = Math.min(20, catCount * 8);
        const before = Math.round(((followerScore + 15 + categoryScore) * 100) / 85);
        const after = computeKolValueScore({
          followerCount,
          categories: Array.from({ length: catCount }, (_, i) => `cat${i}`),
          engagementRate: null,
        }).total;
        expect(Math.abs(after - before)).toBeLessThanOrEqual(15);
      }
    }
  });

  it("authenticity penalty drops total below the neutral-modifier baseline", () => {
    const neutral = computeKolValueScore({
      followerCount: 50_000,
      categories: ["fps"],
      engagementRate: 4.0,
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
