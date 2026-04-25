import { describe, expect, it } from "vitest";

import {
  SHARE_TOKEN_TTL_DAYS,
  computeShareTokenExpiry,
  generateShareToken,
  isShareTokenExpired,
} from "../share-token";

describe("generateShareToken", () => {
  it("returns a 32-character URL-safe string", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique values across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      seen.add(generateShareToken());
    }
    expect(seen.size).toBe(50);
  });
});

describe("computeShareTokenExpiry", () => {
  it("returns now + 7 UTC days", () => {
    const now = new Date(Date.UTC(2026, 3, 25, 12, 0, 0));
    const exp = computeShareTokenExpiry(now);
    const diffMs = exp.getTime() - now.getTime();
    expect(diffMs).toBe(SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("does not mutate the input date", () => {
    const now = new Date(Date.UTC(2026, 3, 25, 12, 0, 0));
    const before = now.getTime();
    computeShareTokenExpiry(now);
    expect(now.getTime()).toBe(before);
  });
});

describe("isShareTokenExpired", () => {
  it("reports true for null", () => {
    expect(isShareTokenExpired(null)).toBe(true);
  });

  it("reports true when expiresAt has passed", () => {
    const now = new Date(Date.UTC(2026, 3, 25, 12, 0, 0));
    const past = new Date(now.getTime() - 1);
    expect(isShareTokenExpired(past, now)).toBe(true);
  });

  it("reports false when expiresAt is in the future", () => {
    const now = new Date(Date.UTC(2026, 3, 25, 12, 0, 0));
    const future = new Date(now.getTime() + 1_000);
    expect(isShareTokenExpired(future, now)).toBe(false);
  });

  it("reports true exactly at the expiry boundary", () => {
    const now = new Date(Date.UTC(2026, 3, 25, 12, 0, 0));
    expect(isShareTokenExpired(now, now)).toBe(true);
  });
});
