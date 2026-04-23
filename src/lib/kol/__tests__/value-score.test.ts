import { describe, expect, it } from "vitest";

import { computeKolValueScore } from "@/lib/kol/value-score";

describe("computeKolValueScore", () => {
  it("normalizes raw max (50 + 15 + 20 = 85) to 100", () => {
    // 1,000,000 followers → log10 = 6 → *15 = 90 → capped at 50
    // 3 categories → 24 → capped at 20
    const result = computeKolValueScore({
      followerCount: 1_000_000,
      categories: ["moba", "rpg", "fps"],
    });
    expect(result.total).toBe(100);
    expect(result.rawBreakdown.follower).toBe(50);
    expect(result.rawBreakdown.engagement).toBe(15);
    expect(result.rawBreakdown.category).toBe(20);
  });

  it("ranks larger follower counts higher while below the cap (~2,154 followers)", () => {
    // log10(followers) * 15 hits the 50 cap at ~2,154 followers. Use three
    // values below the cap so every input sees a strictly increasing score.
    const low = computeKolValueScore({ followerCount: 200, categories: ["casual"] });
    const mid = computeKolValueScore({ followerCount: 800, categories: ["casual"] });
    const high = computeKolValueScore({ followerCount: 2_000, categories: ["casual"] });
    expect(low.total).toBeLessThan(mid.total);
    expect(mid.total).toBeLessThan(high.total);
  });

  it("clamps follower contribution once followers exceed the cap", () => {
    const justAboveCap = computeKolValueScore({ followerCount: 3_000, categories: [] });
    const massive = computeKolValueScore({ followerCount: 10_000_000, categories: [] });
    // Both should cap follower score at 50; with empty categories the two
    // results are identical because nothing else changes.
    expect(justAboveCap.rawBreakdown.follower).toBe(50);
    expect(massive.rawBreakdown.follower).toBe(50);
    expect(justAboveCap.total).toBe(massive.total);
  });

  it("floors follower input at 100 so tiny channels do not log-negative", () => {
    const tiny = computeKolValueScore({ followerCount: 0, categories: [] });
    // log10(100)=2 → *15 = 30
    expect(tiny.rawBreakdown.follower).toBe(30);
    // engagement 15 + follower 30 + category 0 = 45; normalized round(45*100/85) = 53
    expect(tiny.total).toBe(53);
  });

  it("caps category bonus at 3+ categories", () => {
    const three = computeKolValueScore({ followerCount: 10_000, categories: ["a", "b", "c"] });
    const five = computeKolValueScore({ followerCount: 10_000, categories: ["a", "b", "c", "d", "e"] });
    expect(three.rawBreakdown.category).toBe(20);
    expect(five.rawBreakdown.category).toBe(20);
    expect(three.total).toBe(five.total);
  });

  it("returns an integer total in the inclusive 0-100 range for plausible input", () => {
    for (const followerCount of [0, 1_000, 10_000, 100_000, 1_000_000, 50_000_000]) {
      for (const catCount of [0, 1, 2, 3, 5]) {
        const { total } = computeKolValueScore({
          followerCount,
          categories: Array.from({ length: catCount }, (_, i) => `cat${i}`),
        });
        expect(Number.isInteger(total)).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(total).toBeLessThanOrEqual(100);
      }
    }
  });
});
