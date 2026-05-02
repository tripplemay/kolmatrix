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
import { inMemoryKolSyncCursorProvider } from "@/lib/kol-sync/cursor";
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

describe("YouTubeKolSyncAdapter · matrix defaults (BIx-F004-P1: 14 region × 6 keyword)", () => {
  it("daily matrix is 14 region × 6 keyword × 50 results = 8,400u worst-case", () => {
    expect(DAILY_REGIONS).toHaveLength(14);
    // Pool is 12 keywords / region; pickDailyKeywords returns 6 per day.
    for (const r of DAILY_REGIONS) {
      expect(DAILY_KEYWORDS_BY_REGION[r]).toHaveLength(12);
    }
    // 14 region × 6 keyword (today's rotation slice) = 84 search.list
    // calls × 100u = 8,400u — base cost before publishedAfter slices
    // and engagement batch.
    const callsPerDay = DAILY_REGIONS.length * 6;
    expect(callsPerDay).toBe(84);
    expect(callsPerDay * 100).toBe(8_400);
  });

  it("Chinese-region pool keeps the carry-forward seed terms (CN/HK/TW)", () => {
    expect(DAILY_KEYWORDS_BY_REGION.CN).toContain("游戏直播");
    expect(DAILY_KEYWORDS_BY_REGION.HK).toContain("游戏直播");
    expect(DAILY_KEYWORDS_BY_REGION.TW).toContain("遊戲直播");
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
    // BIx-F004-P1: 14 region × 6 keyword (today's pickDailyKeywords
    // slice from a 12-keyword pool) = 84 search.list calls.
    expect(client.searchChannels).toHaveBeenCalledTimes(84);
    // UC_SHARED appears in every search but is fetched only once.
    expect(data.filter((d) => d.externalId === "UC_SHARED")).toHaveLength(1);
    // 84 unique per-(region,keyword) ids + 1 shared = 85 rows.
    expect(data).toHaveLength(85);
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
    // BIx-F004-P2 added an optional pageToken 4th arg; with no
    // cursorProvider the adapter passes `undefined`.
    expect(client.searchChannels).toHaveBeenCalledWith("JP", "Vtuber", 25, undefined, undefined);
    // 1 fresh id + 1 shared = 2 rows.
    expect(data).toHaveLength(2);
  });
});

describe("YouTubeKolSyncAdapter · cursor (BIx-F004-P2 page rotation)", () => {
  function makeStubClient(nextPageToken: string | null = "tok-next") {
    return {
      searchChannels: vi.fn(async (region: string, keyword: string) => ({
        ids: [`UC_${region}_${keyword.replace(/\s+/g, "_")}`],
        nextPageToken,
      })),
      fetchChannels: vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => ({ ...fullChannel({ id }) }))
      ),
    } satisfies YoutubeClient;
  }

  // Pin to dayOfYear=1 (cyclePos 1 → page 1) and dayOfYear=4
  // (cyclePos 4 → page 2) so the cursor branches are deterministic.
  const day1 = new Date(Date.UTC(2026, 0, 1)); // page 1
  const day4 = new Date(Date.UTC(2026, 0, 4)); // page 2

  it("page-1 days call searchChannels with no pageToken and persist {page:1, nextPageToken}", async () => {
    const client = makeStubClient("tok-after-p1");
    const cursor = inMemoryKolSyncCursorProvider();
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      cursorProvider: cursor,
      now: () => day1,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
    });
    await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledWith("US", "gaming", 50, undefined, undefined);
    expect(await cursor.get("US", "gaming")).toEqual({
      page: 1,
      nextPageToken: "tok-after-p1",
    });
  });

  it("page-2 day with valid page-1 cursor uses the stored nextPageToken", async () => {
    const client = makeStubClient("tok-after-p2");
    const cursor = inMemoryKolSyncCursorProvider(
      new Map([["US::gaming", { page: 1, nextPageToken: "tok-from-p1" }]])
    );
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      cursorProvider: cursor,
      now: () => day4,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
    });
    await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledWith(
      "US",
      "gaming",
      50,
      "tok-from-p1",
      undefined
    );
    expect(await cursor.get("US", "gaming")).toEqual({
      page: 2,
      nextPageToken: "tok-after-p2",
    });
  });

  it("page-2 day without a matching page-1 cursor self-heals to page 1", async () => {
    const client = makeStubClient("tok-fresh-p1");
    // Cursor is at page 3 (mismatch — gap in cron), so we shouldn't
    // forward its token; instead reset to page 1.
    const cursor = inMemoryKolSyncCursorProvider(
      new Map([["US::gaming", { page: 3, nextPageToken: "stale" }]])
    );
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      cursorProvider: cursor,
      now: () => day4,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
    });
    await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledWith("US", "gaming", 50, undefined, undefined);
    // Cursor row reflects the actual page consumed (1, not the
    // intended 2) so the next 6-day cycle realigns naturally.
    expect(await cursor.get("US", "gaming")).toEqual({
      page: 1,
      nextPageToken: "tok-fresh-p1",
    });
  });

  it("absence of cursorProvider leaves search.list at page 1 forever", async () => {
    const client = makeStubClient("ignored");
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      now: () => day4, // would be page 2 if cursor were wired
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
    });
    await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledWith("US", "gaming", 50, undefined, undefined);
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
