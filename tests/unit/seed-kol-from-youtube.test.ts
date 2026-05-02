/**
 * MVP-kol-seed-redo F001 · Unit fixtures for the YouTube seed crawler.
 *
 * Five fixtures cover the script's contract end-to-end without touching
 * the real googleapis client:
 *   1. parseArgs accepts dry-run / region / max-results and rejects
 *      bad input.
 *   2. buildRunPlan returns the right quota math for the full matrix
 *      and for a single-region narrowing.
 *   3. mapChannel transforms the googleapis Channel shape into our
 *      EnrichedChannel and applies the subscriber / video / description
 *      filters (drops non-eligible inputs).
 *   4. withRetry retries up to N times with a stub sleep, then surfaces
 *      the last error if it never succeeds.
 *   5. runCrawl drives the orchestrator with a stub YoutubeClient,
 *      asserting matrix iteration, dedupe, and the per-region tally.
 */
import { describe, expect, it, vi } from "vitest";

import {
  ALL_REGIONS,
  buildRunPlan,
  formatOutputJson,
  isGamingTopic,
  mapChannel,
  parseArgs,
  runCrawl,
  withRetry,
  type EnrichedChannel,
  type Region,
  type YoutubeClient,
} from "@/../scripts/seed-kol-from-youtube";

describe("parseArgs", () => {
  it("defaults to live + 50 results + 2 pages + all regions", () => {
    expect(parseArgs([])).toEqual({
      dryRun: false,
      maxResultsPerQuery: 50,
      maxPagesPerQuery: 2,
    });
  });

  it("accepts --dry-run + --region + --max-results + --max-pages", () => {
    expect(
      parseArgs([
        "--dry-run",
        "--region",
        "US",
        "--max-results",
        "25",
        "--max-pages",
        "3",
      ])
    ).toEqual({
      dryRun: true,
      region: "US",
      maxResultsPerQuery: 25,
      maxPagesPerQuery: 3,
    });
  });

  it("rejects unknown region", () => {
    expect(() => parseArgs(["--region", "FR"])).toThrow(/region must be one of/i);
  });

  it("rejects out-of-range --max-results / --max-pages", () => {
    expect(() => parseArgs(["--max-results", "0"])).toThrow();
    expect(() => parseArgs(["--max-results", "51"])).toThrow();
    expect(() => parseArgs(["--max-results", "junk"])).toThrow();
    expect(() => parseArgs(["--max-pages", "0"])).toThrow();
    expect(() => parseArgs(["--max-pages", "6"])).toThrow();
  });
});

describe("buildRunPlan", () => {
  it("computes 8,080u worst-case quota for the full matrix at 2 pages", () => {
    const plan = buildRunPlan({
      dryRun: false,
      maxResultsPerQuery: 50,
      maxPagesPerQuery: 2,
    });
    expect(plan.regions).toEqual(ALL_REGIONS);
    // 8 regions × 5 keywords × 2 pages.
    expect(plan.totalSearchCalls).toBe(80);
    expect(plan.totalSearchQuotaUnits).toBe(8_000);
    // Worst-case 80 × 50 = 4,000 channels → 80 channels.list calls.
    expect(plan.worstCaseChannelCalls).toBe(80);
    expect(plan.worstCaseChannelQuotaUnits).toBe(80);
    expect(plan.totalQuotaUnitsWorstCase).toBe(8_080);
    // Headroom check: stays under the 10K daily free quota.
    expect(plan.totalQuotaUnitsWorstCase).toBeLessThan(10_000);
  });

  it("collapses to single page when --max-pages 1", () => {
    const plan = buildRunPlan({
      dryRun: false,
      maxResultsPerQuery: 50,
      maxPagesPerQuery: 1,
    });
    expect(plan.totalSearchCalls).toBe(40);
    expect(plan.totalQuotaUnitsWorstCase).toBe(4_040);
  });

  it("narrows to a single region when --region is provided", () => {
    const plan = buildRunPlan({
      dryRun: false,
      region: "JP",
      maxResultsPerQuery: 50,
      maxPagesPerQuery: 2,
    });
    expect(plan.regions).toEqual(["JP"]);
    // 5 keywords × 2 pages.
    expect(plan.totalSearchCalls).toBe(10);
    expect(plan.totalSearchQuotaUnits).toBe(1_000);
  });
});

describe("mapChannel", () => {
  const baseRaw = {
    id: "UC_test_chan",
    snippet: {
      title: "Test Gamer",
      customUrl: "@testgamer",
      description: "Plays a lot of FPS.",
      country: "US",
      defaultLanguage: "en",
      publishedAt: "2018-01-15T00:00:00Z",
      thumbnails: {
        default: { url: "https://example.com/d.jpg" },
        high: { url: "https://example.com/h.jpg" },
      },
    },
    statistics: {
      subscriberCount: "150000",
      videoCount: "200",
      viewCount: "5000000",
    },
    topicDetails: {
      topicCategories: [
        "https://en.wikipedia.org/wiki/Action_game",
        "https://en.wikipedia.org/wiki/Video_game_culture",
      ],
    },
    brandingSettings: {
      image: { bannerExternalUrl: "https://example.com/banner.jpg" },
    },
  };

  it("maps every requested field including metadata extras", () => {
    const out = mapChannel(baseRaw, "US", "gaming", () => "2026-04-27T00:00:00.000Z");
    expect(out).toEqual<EnrichedChannel>({
      id: "UC_test_chan",
      handle: "@testgamer",
      title: "Test Gamer",
      description: "Plays a lot of FPS.",
      country: "US",
      defaultLanguage: "en",
      publishedAt: "2018-01-15T00:00:00Z",
      thumbnailUrl: "https://example.com/h.jpg",
      bannerUrl: "https://example.com/banner.jpg",
      subscriberCount: 150_000,
      videoCount: 200,
      viewCount: 5_000_000,
      topicCategories: [
        "https://en.wikipedia.org/wiki/Action_game",
        "https://en.wikipedia.org/wiki/Video_game_culture",
      ],
      matrixRegion: "US",
      matrixKeyword: "gaming",
      scrapedAt: "2026-04-27T00:00:00.000Z",
    });
  });

  it("drops channels under the subscriber threshold", () => {
    // BIx-F004-P1 lowered the default threshold 10_000 → 1_000 to honour
    // PRD §10.1 micro-influencer floor; fixture now sits below the new
    // default so the "below threshold returns null" intent still holds.
    const tiny = {
      ...baseRaw,
      statistics: { ...baseRaw.statistics, subscriberCount: "999" },
    };
    expect(mapChannel(tiny, "US", "gaming")).toBeNull();
  });

  it("drops channels with zombie video counts", () => {
    const zombie = {
      ...baseRaw,
      statistics: { ...baseRaw.statistics, videoCount: "5" },
    };
    expect(mapChannel(zombie, "US", "gaming")).toBeNull();
  });

  it("drops channels with empty descriptions", () => {
    const blank = {
      ...baseRaw,
      snippet: { ...baseRaw.snippet, description: "   " },
    };
    expect(mapChannel(blank, "US", "gaming")).toBeNull();
  });

  it("drops channels whose topicCategories don't look gaming", () => {
    const cooking = {
      ...baseRaw,
      topicDetails: {
        topicCategories: ["https://en.wikipedia.org/wiki/Cuisine"],
      },
    };
    expect(mapChannel(cooking, "US", "gaming")).toBeNull();
  });

  it("trusts the search keyword when topicCategories is empty", () => {
    const noTopics = {
      ...baseRaw,
      topicDetails: {},
    };
    const out = mapChannel(noTopics, "US", "gaming");
    expect(out).not.toBeNull();
    expect(out!.topicCategories).toEqual([]);
  });

  it("falls back to the default thumbnail when high is missing", () => {
    const noHigh = {
      ...baseRaw,
      snippet: {
        ...baseRaw.snippet,
        thumbnails: { default: { url: "https://example.com/d.jpg" } },
      },
    };
    const out = mapChannel(noHigh, "US", "gaming");
    expect(out?.thumbnailUrl).toBe("https://example.com/d.jpg");
  });
});

describe("isGamingTopic", () => {
  it("matches Action_game / Strategy_video_game / Sports_game / ESports", () => {
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Action_game"])).toBe(true);
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Strategy_video_game"])).toBe(true);
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Sports_game"])).toBe(true);
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/ESports"])).toBe(true);
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Casual_game"])).toBe(true);
  });

  it("rejects non-gaming topics", () => {
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Cuisine"])).toBe(false);
    expect(isGamingTopic(["https://en.wikipedia.org/wiki/Music"])).toBe(false);
  });

  it("permits unknown topicCategories (empty list trusts the search keyword)", () => {
    expect(isGamingTopic([])).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns the first successful result without sleeping", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => "ok");
    const out = await withRetry(fn, { sleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries with the configured backoff schedule and reports each attempt", async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt += 1;
      if (attempt < 3) throw new Error(`boom ${attempt}`);
      return "ok";
    });
    const out = await withRetry(fn, {
      backoffsMs: [10, 20, 30],
      sleep,
      onRetry,
    });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("rethrows the last error after exhausting retries", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error("permanent");
    });
    await expect(
      withRetry(fn, { backoffsMs: [1, 1, 1], sleep })
    ).rejects.toThrow(/permanent/);
    // 1 initial + 3 retries.
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe("runCrawl + formatOutputJson", () => {
  function stubChannel(id: string, country: string) {
    return {
      id,
      snippet: {
        title: `Channel ${id}`,
        customUrl: `@${id.toLowerCase()}`,
        description: "Plays competitive games every day.",
        country,
        defaultLanguage: "en",
        publishedAt: "2020-01-01T00:00:00Z",
        thumbnails: { high: { url: `https://yt.com/${id}.jpg` } },
      },
      statistics: {
        subscriberCount: "200000",
        videoCount: "300",
        viewCount: "10000000",
      },
      topicDetails: {
        topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
      },
      brandingSettings: {},
    };
  }

  it("iterates the matrix, dedupes channels seen across queries, and tallies per region", async () => {
    const fakeClient: YoutubeClient = {
      searchChannels: vi.fn(async (region: Region, keyword: string) => {
        // Each (region, keyword) pair returns one fresh ID + one shared
        // ID so the dedupe path is exercised. No nextPageToken — the
        // test runs single-page by default.
        return {
          ids: [`${region}-${keyword}`.replace(/\s+/g, "_"), "SHARED_ID"],
          nextPageToken: null,
        };
      }),
      fetchChannels: vi.fn(async (ids: string[]) =>
        ids.map((id: string) =>
          stubChannel(id, id === "SHARED_ID" ? "US" : id.split("-")[0]!)
        )
      ),
    };

    const args = {
      dryRun: false,
      region: "JP" as Region,
      maxResultsPerQuery: 50,
      maxPagesPerQuery: 2,
    };
    const report = await runCrawl(args, {
      client: fakeClient,
      retry: { sleep: async () => {} },
    });

    // 1 region × 5 keywords. nextPageToken is null so the second page
    // never gets requested — searchCallsExecuted = 5, not 10.
    expect(report.searchCallsExecuted).toBe(5);
    // SHARED_ID is fetched only on the first iteration; subsequent
    // search hits dedupe it out so the channel call only carries the
    // fresh per-keyword ID — that's 4 channel calls of 1 id each plus
    // 1 channel call of 2 ids on the first iteration.
    expect(report.channelCallsExecuted).toBe(5);
    // 5 unique keyword-prefixed IDs + 1 SHARED_ID = 6.
    expect(report.uniqueChannelsSeen).toBe(6);
    expect(report.channelsAcceptedByFilters).toBe(6);
    expect(report.perRegion.JP).toBe(6);
    // Other regions stay at zero since we narrowed.
    expect(report.perRegion.US).toBe(0);

    const out = JSON.parse(formatOutputJson(report));
    expect(out.version).toBe(1);
    expect(out.quota.totalQuotaUnitsConsumed).toBe(5 * 100 + 5);
    expect(out.channels).toHaveLength(6);
    expect(out.channels[0]).toMatchObject({
      matrixRegion: "JP",
      country: expect.any(String),
    });
  });

  it("follows nextPageToken up to maxPagesPerQuery", async () => {
    let callCount = 0;
    const fakeClient: YoutubeClient = {
      searchChannels: vi.fn(async (region: Region, keyword: string) => {
        callCount += 1;
        // First call returns a nextPageToken; second call clears it.
        const isFirstPage = callCount % 2 === 1;
        return {
          ids: [`${region}-${keyword}-p${isFirstPage ? 1 : 2}`.replace(/\s+/g, "_")],
          nextPageToken: isFirstPage ? "TOK" : null,
        };
      }),
      fetchChannels: vi.fn(async (ids: string[]) =>
        ids.map((id: string) => stubChannel(id, "JP"))
      ),
    };

    const report = await runCrawl(
      {
        dryRun: false,
        region: "JP",
        maxResultsPerQuery: 50,
        maxPagesPerQuery: 2,
      },
      { client: fakeClient, retry: { sleep: async () => {} } }
    );

    // 5 keywords × 2 pages = 10 search calls.
    expect(report.searchCallsExecuted).toBe(10);
    expect(report.uniqueChannelsSeen).toBe(10);
  });
});
