/**
 * BL-012-F008 · ApifyKolSyncAdapter mapper + adapter unit fixtures.
 *
 * Pure-mapper coverage (`mapApifyKolItemToRawKolData`) walks the three
 * shapes the spec calls out (full IG profile / TT with null scores /
 * YT missing isBusinessAccount + totals) plus the unusable cases that
 * have to surface as `null` so the caller can drop them. Adapter-level
 * error classification (401/429/timeout) is also pinned here — the
 * end-to-end discover/refresh paths get exercised by the F009
 * integration tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdapterAuthError,
  AdapterTransientError,
  ApifyKolSyncAdapter,
  mapApifyKolItemToRawKolData,
} from "@/lib/kol-sync/adapters/apify-kol";
import type { ApifyKolItem } from "@/lib/apify-kol/schemas";

const STUB_NOW = () => "2026-05-08T20:00:00.000Z";

function igProfile(overrides: Partial<ApifyKolItem> = {}): ApifyKolItem {
  return {
    id: "ig_99",
    platform: "instagram",
    platformUserId: "99",
    username: "ig_creator",
    displayName: "IG Creator",
    bio: "Gaming streamer · DM for collabs",
    avatarUrl: "https://cdn.example/ig/avatar.jpg",
    profileUrl: "https://instagram.com/ig_creator",
    followers: 350_000,
    following: 250,
    postsCount: 480,
    totalLikes: 5_000_000,
    totalViews: null,
    verified: true,
    isBusinessAccount: true,
    emails: ["press@creator.gg"],
    phones: [],
    socialHandles: { youtube: "@ig_creator_yt" },
    externalUrl: "https://creator.gg",
    externalUrls: [{ url: "https://creator.gg", title: "Store" }],
    aggregatorUrl: null,
    aggregatorEmails: [],
    aggregatorLinks: { youtube: "https://yt.example" },
    relevanceScore: 0.82,
    influenceScore: 0.71,
    qualityScore: 0.65,
    reachabilityScore: 0.55,
    matchedTags: ["gaming", "esports"],
    matchedKeywords: ["valorant"],
    tier: "mid",
    isSeed: false,
    lastScrapedAt: "2026-05-07T08:00:00.000Z",
    ...overrides,
  } as ApifyKolItem;
}

describe("BL-012-F008 mapApifyKolItemToRawKolData (pure)", () => {
  it("(a) projects a full IG profile end-to-end and preserves raw provenance", () => {
    const out = mapApifyKolItemToRawKolData(igProfile(), STUB_NOW);
    expect(out).toMatchObject({
      externalId: "ig_99",
      platform: "instagram",
      handle: "ig_creator",
      displayName: "IG Creator",
      description: "Gaming streamer · DM for collabs",
      country: null,
      language: null,
      thumbnailUrl: "https://cdn.example/ig/avatar.jpg",
      bannerUrl: null,
      subscriberCount: 350_000,
      topicCategories: ["gaming", "esports"],
      lastUploadAt: null,
      brandSafetyRating: null,
      scrapedAt: "2026-05-08T20:00:00.000Z",
    });
    // raw must round-trip the 4-dimension scores + emails so B5
    // enrichment can promote them later.
    expect(out?.raw).toMatchObject({
      relevanceScore: 0.82,
      influenceScore: 0.71,
      qualityScore: 0.65,
      reachabilityScore: 0.55,
      tier: "mid",
      emails: ["press@creator.gg"],
      isBusinessAccount: true,
      verified: true,
    });
  });

  it("(b) handles a TikTok profile with null scores + no email gracefully", () => {
    const tt = igProfile({
      id: "tt_1",
      platform: "tiktok",
      platformUserId: "1",
      username: "tt_dancer",
      displayName: null,
      avatarUrl: null,
      bio: null,
      followers: null,
      isBusinessAccount: null,
      emails: [],
      relevanceScore: null,
      influenceScore: null,
      qualityScore: null,
      reachabilityScore: null,
      matchedTags: null,
      lastScrapedAt: null,
    });
    const out = mapApifyKolItemToRawKolData(tt, STUB_NOW);
    expect(out).not.toBeNull();
    // Falls back to username when displayName is null/empty.
    expect(out?.displayName).toBe("tt_dancer");
    // Null followers → 0 so quality.ts can spam-skip rather than crash.
    expect(out?.subscriberCount).toBe(0);
    expect(out?.thumbnailUrl).toBeNull();
    expect(out?.description).toBeUndefined();
    // matchedTags=null collapses to an empty array (not null) — keeps
    // the downstream Prisma write predictable.
    expect(out?.topicCategories).toEqual([]);
    // raw still preserves the null scores for future enrichment.
    expect(out?.raw).toMatchObject({
      relevanceScore: null,
      influenceScore: null,
    });
  });

  it("(c) maps a YouTube profile missing isBusinessAccount + totalLikes / totalViews", () => {
    const yt = igProfile({
      id: 12_345, // fork emits number for some legacy rows — must coerce
      platform: "youtube",
      platformUserId: "UC_yt",
      username: "yt_streamer",
      displayName: "YT Streamer",
      followers: 1_200_000,
      // Strip the YT-irrelevant fields entirely (zod schema is
      // .optional() so undefined is allowed) — proves the mapper
      // tolerates the absence rather than only `null`.
      isBusinessAccount: undefined,
      totalLikes: undefined,
      totalViews: undefined,
      postsCount: 600,
    });
    const out = mapApifyKolItemToRawKolData(yt, STUB_NOW);
    expect(out).not.toBeNull();
    expect(out?.externalId).toBe("12345"); // number → string
    expect(out?.platform).toBe("youtube");
    expect(out?.displayName).toBe("YT Streamer");
    expect(out?.subscriberCount).toBe(1_200_000);
    // Optional fork fields stay carry-forward in `raw` so B5 enrichment
    // can promote them later. JSON serialization downstream drops the
    // undefined keys — Prisma's JsonValue handles that for us.
    expect(out?.raw).toMatchObject({ platform: "youtube", postsCount: 600 });
  });

  it("returns null when id is missing or empty (caller drops the row)", () => {
    expect(
      mapApifyKolItemToRawKolData({ ...igProfile(), id: "" } as ApifyKolItem, STUB_NOW)
    ).toBeNull();
  });

  it("returns null when username is empty (no handle to anchor on)", () => {
    expect(
      mapApifyKolItemToRawKolData(
        { ...igProfile(), username: "" } as ApifyKolItem,
        STUB_NOW
      )
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Adapter-level — error classification.
// ---------------------------------------------------------------------

describe("BL-012-F007 ApifyKolSyncAdapter error classification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeAdapter(fetchImpl: typeof fetch) {
    return new ApifyKolSyncAdapter({
      baseUrl: "http://apify.test:3003",
      apiKey: "biz-key-123",
      fetchImpl,
      timeoutMs: 5_000,
      maxItemsPerRun: 50,
      pageSize: 10,
    });
  }

  it("classifies HTTP 401 as AdapterAuthError (terminal)", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: "missing api key" }), { status: 401 })
    );
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    await expect(adapter.discover({})).rejects.toBeInstanceOf(AdapterAuthError);
  });

  it("classifies HTTP 403 as AdapterAuthError", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })
    );
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    await expect(adapter.discover({})).rejects.toMatchObject({
      name: "AdapterAuthError",
      status: 403,
    });
  });

  it("classifies HTTP 429 as AdapterRateLimitError and parses Retry-After", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 429,
        headers: { "retry-after": "7" },
      })
    );
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    await expect(adapter.discover({})).rejects.toMatchObject({
      name: "AdapterRateLimitError",
      status: 429,
      retryAfterSeconds: 7,
    });
  });

  it("classifies HTTP 503 as AdapterTransientError (eligible for retry)", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 503 })
    );
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    await expect(adapter.discover({})).rejects.toMatchObject({
      name: "AdapterTransientError",
      status: 503,
    });
  });

  it("healthCheck returns healthy=true when /health body { status: 'ok' }", async () => {
    const fetchSpy = vi.fn(async (input: string | URL) => {
      expect(String(input)).toBe("http://apify.test:3003/health");
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
    expect(result.details).toMatchObject({
      upstream: "apify-kol-service",
      status: "ok",
    });
  });

  it("healthCheck returns healthy=false when /health throws", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("ECONNREFUSED");
    });
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.details).toMatchObject({ upstream: "apify-kol-service" });
  });

  it("network error surfaces as AdapterTransientError (no auth confusion)", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const adapter = makeAdapter(fetchSpy as unknown as typeof fetch);
    await expect(adapter.discover({})).rejects.toBeInstanceOf(AdapterTransientError);
  });
});
