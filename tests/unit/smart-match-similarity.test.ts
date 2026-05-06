import { describe, expect, it } from "vitest";

import { similarityToScore, MAX_SCORE, MIN_SCORE } from "@/lib/discovery/smart-match";

// BL-023-F004: similarityToScore was rewritten to map non-negative
// cosine similarity directly to [0, 100] (was previously the
// (sim+1)/2 midpoint mapping, which put sim=0 at 50).
describe("similarityToScore (BL-023-F004 direct mapping)", () => {
  it("maps 1 (perfect cosine match) to 100", () => {
    expect(similarityToScore(1)).toBe(MAX_SCORE);
  });

  it("maps 0 (orthogonal / no match) to 0", () => {
    expect(similarityToScore(0)).toBe(MIN_SCORE);
  });

  it("maps -1 (opposite vector, also 'no match') to 0", () => {
    // Negative cosine collapses to 0 — pgvector cosine on KOL/product
    // embeddings effectively never goes negative, but the mapping is
    // defensive against numeric drift on the boundary.
    expect(similarityToScore(-1)).toBe(MIN_SCORE);
  });

  it("clamps similarity > 1 to 100 (defensive against numeric drift)", () => {
    expect(similarityToScore(1.000001)).toBe(MAX_SCORE);
  });

  it("clamps similarity < -1 to 0", () => {
    expect(similarityToScore(-1.5)).toBe(MIN_SCORE);
  });

  it("rounds to nearest integer (UI ring shows whole numbers)", () => {
    // Direct mapping: sim → round(sim * 100)
    expect(similarityToScore(0.5)).toBe(50); // was 75 under (sim+1)/2
    expect(similarityToScore(0.4)).toBe(40); // was 70 under (sim+1)/2
    expect(similarityToScore(0.85)).toBe(85); // was 92.5 → 93 under (sim+1)/2
    expect(similarityToScore(0.3334)).toBe(33);
  });

  it("BL-044 semantic-search cosine band [0.37, 0.46] now lands at [37, 46]", () => {
    // Reflects the BL-044 spec §1.2 measurement: the "moderately
    // relevant" cosine band that used to read as 68-73 (compressed,
    // misleadingly high) now reads as 37-46 (honest mid-range).
    expect(similarityToScore(0.37)).toBe(37);
    expect(similarityToScore(0.46)).toBe(46);
  });

  it("monotonically increases with similarity (across both old & new test points)", () => {
    const scores = [-1, -0.5, 0, 0.3, 0.5, 0.8, 1].map(similarityToScore);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});
