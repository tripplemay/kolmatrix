/**
 * B6-kol-daily-sync F002 · YouTubeKolSyncAdapter unit fixtures.
 *
 * The adapter is exercised end-to-end with a stub `YoutubeClient` so
 * the suite stays hermetic — no network, no quota burn, fully
 * deterministic. The real-API smoke is in
 * tests/integration/youtube-adapter.test.ts and is gated by
 * YOUTUBE_API_TEST=true.
 */
import { describe, expect, it, vi } from "vitest";

import {
  DAILY_KEYWORDS_BY_REGION,
  DAILY_REGIONS,
  YouTubeKolSyncAdapter,
  mapToRawKolData,
} from "@/lib/kol-sync/adapters/youtube";
import type { YoutubeClient } from "@/../scripts/seed-kol-from-youtube";

const STUB_NOW = () => "2026-04-28T08:30:00.000Z";

function fullChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "UC_test",
    snippet: {
      title: "Test Gamer",
      customUrl: "@testgamer",
      description: "Plays competitive FPS daily.",
      country: "US",
      defaultLanguage: "en",
      publishedAt: "2018-01-01T00:00:00Z",
      thumbnails: {
        default: { url: "https://yt.example/d.jpg" },
        high: { url: "https://yt.example/h.jpg" },
      },
    },
    statistics: {
      subscriberCount: "200000",
      videoCount: "300",
      viewCount: "10000000",
    },
    topicDetails: {
      topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    },
    brandingSettings: {
      image: { bannerExternalUrl: "https://yt.example/banner.jpg" },
    },
    ...overrides,
  };
}

describe("mapToRawKolData (pure)", () => {
  const ctx = { matrixRegion: "US", matrixKeyword: "gaming", minSubscribers: 10_000 };

  it("projects every required field including raw provenance", () => {
    const out = mapToRawKolData(fullChannel(), ctx, STUB_NOW);
    expect(out).toMatchObject({
      externalId: "UC_test",
      platform: "youtube",
      handle: "@testgamer",
      displayName: "Test Gamer",
      country: "US",
      language: "en",
      subscriberCount: 200_000,
      videoCount: 300,
      viewCount: 10_000_000,
      thumbnailUrl: "https://yt.example/h.jpg",
      bannerUrl: "https://yt.example/banner.jpg",
      scrapedAt: "2026-04-28T08:30:00.000Z",
      raw: { matrixRegion: "US", matrixKeyword: "gaming" },
    });
  });

  it("drops below subscriber threshold / zombie video count / empty description / non-gaming topics", () => {
    expect(
      mapToRawKolData(
        fullChannel({ statistics: { subscriberCount: "5000", videoCount: "300", viewCount: "1" } }),
        ctx,
        STUB_NOW
      )
    ).toBeNull();
    expect(
      mapToRawKolData(
        fullChannel({ statistics: { subscriberCount: "200000", videoCount: "5", viewCount: "1" } }),
        ctx,
        STUB_NOW
      )
    ).toBeNull();
    expect(
      mapToRawKolData(
        fullChannel({
          snippet: {
            title: "T",
            description: "   ",
            customUrl: "@x",
            country: "US",
          },
        }),
        ctx,
        STUB_NOW
      )
    ).toBeNull();
    expect(
      mapToRawKolData(
        fullChannel({
          topicDetails: {
            topicCategories: ["https://en.wikipedia.org/wiki/Cuisine"],
          },
        }),
        ctx,
        STUB_NOW
      )
    ).toBeNull();
  });

  it("nulls matrixRegion + matrixKeyword for the refresh path", () => {
    const refreshCtx = { matrixRegion: null, matrixKeyword: null, minSubscribers: 10_000 };
    const out = mapToRawKolData(fullChannel(), refreshCtx, STUB_NOW);
    expect(out!.raw).toMatchObject({ matrixRegion: null, matrixKeyword: null });
  });
});

describe("YouTubeKolSyncAdapter · matrix defaults", () => {
  it("daily matrix is 6 region × 3 keyword × 10 results = 1,800u worst-case", () => {
    expect(DAILY_REGIONS).toHaveLength(6);
    for (const r of DAILY_REGIONS) {
      expect(DAILY_KEYWORDS_BY_REGION[r]).toHaveLength(3);
    }
    // 6 × 3 = 18 search.list calls × 100u = 1,800u
    const calls =
      DAILY_REGIONS.reduce((sum, r) => sum + DAILY_KEYWORDS_BY_REGION[r].length, 0);
    expect(calls).toBe(18);
    expect(calls * 100).toBe(1_800);
  });

  it("Chinese-region keywords are present in CN/HK/TW (carry-forward补缺口)", () => {
    for (const r of ["CN", "HK", "TW"] as const) {
      expect(DAILY_KEYWORDS_BY_REGION[r]).toContain("游戏直播");
    }
  });
});

describe("YouTubeKolSyncAdapter · discover", () => {
  function stubClient(): YoutubeClient {
    return {
      searchChannels: vi.fn(async (region, keyword) => {
        // Each (region, keyword) pair returns a fresh id + a shared id
        // so the dedupe path is exercised across the matrix.
        return {
          ids: [`UC_${region}_${keyword.replace(/\s+/g, "_")}`, "UC_SHARED"],
          nextPageToken: null,
        };
      }),
      fetchChannels: vi.fn(async (ids: string[]) =>
        ids.map((id: string) => ({
          ...fullChannel({ id }),
        }))
      ),
    };
  }

  it("walks the full daily matrix when no region is given, deduping shared ids", async () => {
    const client = stubClient();
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    const data = await adapter.discover({});
    // 18 search calls (6 region × 3 keyword).
    expect(client.searchChannels).toHaveBeenCalledTimes(18);
    // UC_SHARED appears in every search but is fetched only once.
    expect(data.filter((d) => d.externalId === "UC_SHARED")).toHaveLength(1);
    // 18 unique per-keyword ids + 1 shared = 19 RawKolData rows.
    expect(data).toHaveLength(19);
    expect(data.every((d) => d.platform === "youtube")).toBe(true);
  });

  it("narrows to a single region + custom keywords + maxResults override", async () => {
    const client = stubClient();
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    const data = await adapter.discover({
      region: "JP",
      keywords: ["Vtuber"],
      maxResults: 25,
    });
    expect(client.searchChannels).toHaveBeenCalledTimes(1);
    expect(client.searchChannels).toHaveBeenCalledWith("JP", "Vtuber", 25);
    // 1 fresh id + 1 shared = 2 rows.
    expect(data).toHaveLength(2);
  });
});

describe("YouTubeKolSyncAdapter · refresh", () => {
  it("batches channels.list at 50 ids per call and skips below-threshold rows", async () => {
    let callCount = 0;
    const client: YoutubeClient = {
      searchChannels: vi.fn(),
      fetchChannels: vi.fn(async (ids: string[]) => {
        callCount += 1;
        return ids.map((id: string, i: number) =>
          fullChannel({
            id,
            statistics:
              i === 0
                ? // First channel in each batch falls below threshold.
                  { subscriberCount: "500", videoCount: "300", viewCount: "1" }
                : { subscriberCount: "200000", videoCount: "300", viewCount: "1" },
          })
        );
      }),
    };
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    const ids = Array.from({ length: 75 }).map((_, i) => `UC_${i}`);
    const data = await adapter.refresh(ids);

    // 75 ids → ⌈75/50⌉ = 2 calls.
    expect(callCount).toBe(2);
    expect(client.fetchChannels).toHaveBeenNthCalledWith(1, ids.slice(0, 50));
    expect(client.fetchChannels).toHaveBeenNthCalledWith(2, ids.slice(50, 75));
    // 75 - 2 (one below-threshold per batch) = 73 surviving rows.
    expect(data).toHaveLength(73);
    expect(data.every((d) => d.raw?.matrixRegion === null)).toBe(true);
  });

  it("returns [] for empty externalIds list (no API call burned)", async () => {
    const client: YoutubeClient = {
      searchChannels: vi.fn(),
      fetchChannels: vi.fn(),
    };
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    expect(await adapter.refresh([])).toEqual([]);
    expect(client.fetchChannels).not.toHaveBeenCalled();
  });
});

describe("YouTubeKolSyncAdapter · healthCheck", () => {
  it("returns healthy when probe channel resolves", async () => {
    const client: YoutubeClient = {
      searchChannels: vi.fn(),
      fetchChannels: vi.fn(async () => [
        { id: "UCBR8-60-B28hp2BmDPdntcQ", snippet: { title: "YouTube Spotlight" } },
      ]),
    };
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(true);
    expect(r.details).toMatchObject({ probeChannelTitle: "YouTube Spotlight" });
  });

  it("returns unhealthy when YOUTUBE_API_KEY is missing (no client)", async () => {
    const adapter = new YouTubeKolSyncAdapter({ apiKey: undefined });
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(false);
    expect(r.details).toMatchObject({ error: expect.stringContaining("YOUTUBE_API_KEY") });
  });

  it("coerces a thrown probe to unhealthy + details.error", async () => {
    const client: YoutubeClient = {
      searchChannels: vi.fn(),
      fetchChannels: vi.fn(async () => {
        throw new Error("403 quota exhausted");
      }),
    };
    const adapter = new YouTubeKolSyncAdapter({ apiKey: "key", client });
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(false);
    expect(r.details).toMatchObject({ error: "403 quota exhausted" });
  });
});

describe("YouTubeKolSyncAdapter · no-key safety net", () => {
  it("discover/refresh throw a clear error when the adapter was built without an API key", async () => {
    const adapter = new YouTubeKolSyncAdapter({ apiKey: undefined });
    await expect(adapter.discover({})).rejects.toThrow(/YOUTUBE_API_KEY/);
    await expect(adapter.refresh(["UC_x"])).rejects.toThrow(/YOUTUBE_API_KEY/);
  });
});
