import { describe, expect, it } from "vitest";

import { similarityToScore, MAX_SCORE, MIN_SCORE } from "@/lib/discovery/smart-match";

describe("similarityToScore", () => {
  it("maps 1 (perfect cosine match) to 100", () => {
    expect(similarityToScore(1)).toBe(MAX_SCORE);
  });

  it("maps -1 (perfect anti-match) to 0", () => {
    expect(similarityToScore(-1)).toBe(MIN_SCORE);
  });

  it("maps 0 (orthogonal) to 50", () => {
    expect(similarityToScore(0)).toBe(50);
  });

  it("clamps similarity > 1 to 100 (defensive against numeric drift)", () => {
    expect(similarityToScore(1.000001)).toBe(MAX_SCORE);
  });

  it("clamps similarity < -1 to 0", () => {
    expect(similarityToScore(-1.5)).toBe(MIN_SCORE);
  });

  it("rounds to nearest integer (UI ring shows whole numbers)", () => {
    // similarity = 0.5 → (0.5+1)/2 * 100 = 75
    expect(similarityToScore(0.5)).toBe(75);
    // similarity = 0.3334 → 66.67 → 67
    expect(similarityToScore(0.3334)).toBe(67);
  });

  it("monotonically increases with similarity", () => {
    const scores = [-1, -0.5, 0, 0.3, 0.5, 0.8, 1].map(similarityToScore);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});
