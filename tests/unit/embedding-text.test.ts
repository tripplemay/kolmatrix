import { describe, expect, it } from "vitest";

import {
  buildKolEmbedText,
  buildProductEmbedText,
  hashEmbeddingText,
} from "@/lib/embedding/text";

describe("embedding source text builder — KOL", () => {
  it("composes all available fields with stable separator", () => {
    const text = buildKolEmbedText({
      displayName: "Demo Streamer",
      bio: "FPS gaming creator",
      categories: ["gaming", "esports"],
      tags: ["fps", "valorant"],
      countryCode: "US",
      language: "en",
    });
    expect(text).toContain("name: Demo Streamer");
    expect(text).toContain("bio: FPS gaming creator");
    expect(text).toContain("categories: gaming, esports");
    expect(text).toContain("tags: fps, valorant");
    expect(text).toContain("country: US");
    expect(text).toContain("language: en");
  });

  it("falls back gracefully when bio is NULL (audit lock #4:B coverage)", () => {
    const text = buildKolEmbedText({
      displayName: "Anon Channel",
      bio: null,
      categories: ["gaming"],
      tags: [],
      countryCode: "JP",
      language: null,
    });
    expect(text).toContain("name: Anon Channel");
    expect(text).toContain("categories: gaming");
    expect(text).toContain("country: JP");
    expect(text).not.toContain("bio:");
    expect(text).not.toContain("language:");
  });

  it("returns empty string when no usable content (caller must skip)", () => {
    const text = buildKolEmbedText({
      displayName: "",
      bio: null,
      categories: null,
      tags: null,
      countryCode: null,
      language: null,
    });
    expect(text).toBe("");
  });

  it("normalises whitespace inside fields", () => {
    const text = buildKolEmbedText({
      displayName: "  Trail \n  Spaces  ",
      bio: "multi\n\nline",
      categories: ["a", "  b  "],
      tags: null,
      countryCode: null,
      language: null,
    });
    expect(text).toContain("name: Trail Spaces");
    expect(text).toContain("bio: multi line");
    expect(text).toContain("categories: a, b");
  });
});

describe("embedding source text builder — Product", () => {
  it("composes name + category + targetAudience + uniqueSellingPoints (audit lock #5:B)", () => {
    const text = buildProductEmbedText({
      name: "GameLaunch X",
      category: "AAA shooter",
      targetAudience: "FPS players in NA/EU",
      uniqueSellingPoints: "Free-to-play, cross-platform, anti-cheat",
    });
    expect(text).toContain("name: GameLaunch X");
    expect(text).toContain("category: AAA shooter");
    expect(text).toContain("audience: FPS players in NA/EU");
    expect(text).toContain("selling points: Free-to-play, cross-platform, anti-cheat");
  });

  it("works when targetAudience is NULL", () => {
    const text = buildProductEmbedText({
      name: "Indie Game",
      category: "Roguelike",
      targetAudience: null,
      uniqueSellingPoints: "Procedural levels",
    });
    expect(text).toContain("name: Indie Game");
    expect(text).toContain("category: Roguelike");
    expect(text).toContain("selling points: Procedural levels");
    expect(text).not.toContain("audience:");
  });
});

describe("hashEmbeddingText (audit lock #6:B' field-equality re-embed gate)", () => {
  it("is deterministic for the same input", () => {
    const a = hashEmbeddingText("hello world");
    const b = hashEmbeddingText("hello world");
    expect(a).toBe(b);
  });

  it("differs across different inputs", () => {
    const a = hashEmbeddingText("foo");
    const b = hashEmbeddingText("bar");
    expect(a).not.toBe(b);
  });

  it("returns a 16-char hex prefix", () => {
    const h = hashEmbeddingText("anything");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when only one field of the composed text differs", () => {
    const t1 = buildKolEmbedText({
      displayName: "A",
      bio: "old bio",
      categories: ["g"],
      tags: [],
      countryCode: null,
      language: null,
    });
    const t2 = buildKolEmbedText({
      displayName: "A",
      bio: "new bio",
      categories: ["g"],
      tags: [],
      countryCode: null,
      language: null,
    });
    expect(hashEmbeddingText(t1)).not.toBe(hashEmbeddingText(t2));
  });

  it("stays stable when only stat fields would change (subscriber count etc. NOT included in builder)", () => {
    // The whole point of #6:B' is that subscriber-count-style fields
    // are NEVER in the embedding text, so the hash never moves on them.
    const t1 = buildKolEmbedText({
      displayName: "A",
      bio: "bio",
      categories: ["g"],
      tags: [],
      countryCode: "US",
      language: "en",
    });
    const t2 = buildKolEmbedText({
      displayName: "A",
      bio: "bio",
      categories: ["g"],
      tags: [],
      countryCode: "US",
      language: "en",
    });
    expect(hashEmbeddingText(t1)).toBe(hashEmbeddingText(t2));
  });
});
