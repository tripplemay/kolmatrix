import { describe, expect, it } from "vitest";

import { KOL_PLATFORMS, KolPlatformSchema, normalizePlatform } from "@/lib/kol/platform";

describe("normalizePlatform", () => {
  it("maps seed-style 'Youtube' to canonical 'youtube'", () => {
    expect(normalizePlatform("Youtube")).toBe("youtube");
  });

  it("handles common aliases and hostnames", () => {
    expect(normalizePlatform("youtube.com")).toBe("youtube");
    expect(normalizePlatform("YT")).toBe("youtube");
    expect(normalizePlatform("Insta")).toBe("instagram");
    expect(normalizePlatform("twitch.tv")).toBe("twitch");
    expect(normalizePlatform("X")).toBe("twitter");
  });

  it("returns null for unknown / empty input", () => {
    expect(normalizePlatform("")).toBeNull();
    expect(normalizePlatform(undefined)).toBeNull();
    expect(normalizePlatform("facebook")).toBeNull();
  });
});

describe("KolPlatformSchema", () => {
  it("accepts every canonical platform", () => {
    for (const p of KOL_PLATFORMS) {
      expect(() => KolPlatformSchema.parse(p)).not.toThrow();
    }
  });

  it("rejects non-canonical input", () => {
    expect(() => KolPlatformSchema.parse("Youtube")).toThrow();
    expect(() => KolPlatformSchema.parse("facebook")).toThrow();
  });
});
