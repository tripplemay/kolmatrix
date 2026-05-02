/**
 * BIx-mvp-polish-pass F004-P3 unit tests · publishedAfter slice
 * rotation helpers + adapter phase wiring.
 */
import { describe, expect, it, vi } from "vitest";

import { YouTubeKolSyncAdapter } from "@/lib/kol-sync/adapters/youtube";
import {
  PUBLISHED_AFTER_CORE_REGIONS,
  PUBLISHED_AFTER_WINDOWS_DAYS,
  pickPublishedAfterDays,
  publishedAfterIso,
} from "@/lib/kol-sync/published-after";
import type { YoutubeClient } from "@/../scripts/seed-kol-from-youtube";

describe("pickPublishedAfterDays (4-day rotation)", () => {
  // dayOfYear is 0-indexed against (year, 0, 0). Jan 1 → dayOfYear 1
  // → idx 1 → 180. We assert the four cycle positions deterministically.
  it("returns 180d on Jan 1 (cycle position 1)", () => {
    expect(pickPublishedAfterDays(new Date(Date.UTC(2026, 0, 1)))).toBe(180);
  });

  it("rotates 365 / 730 / 90 / 180 over four consecutive days", () => {
    const days = [2, 3, 4, 5].map((d) => pickPublishedAfterDays(new Date(Date.UTC(2026, 0, d))));
    expect(days).toEqual([365, 730, 90, 180]);
  });

  it("wraps deterministically over a full year", () => {
    const out = new Set<number>();
    for (let d = 1; d <= 30; d += 1) {
      out.add(pickPublishedAfterDays(new Date(Date.UTC(2026, 0, d))));
    }
    // Every value in the window list shows up across 30 days.
    for (const w of PUBLISHED_AFTER_WINDOWS_DAYS) {
      expect(out.has(w)).toBe(true);
    }
  });
});

describe("publishedAfterIso", () => {
  it("subtracts the requested days as a UTC ISO string", () => {
    const base = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
    const out = publishedAfterIso(base, 90);
    // May 1 - 90 days = Jan 31 (2026 is not a leap year).
    expect(out).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("YouTubeKolSyncAdapter · publishedAfter phase (BIx-F004-P3)", () => {
  function fullChannel(id: string) {
    return {
      id,
      snippet: {
        title: id,
        customUrl: `@${id}`,
        description: "Plays competitive FPS daily.",
        country: "US",
        defaultLanguage: "en",
        publishedAt: "2018-01-01T00:00:00Z",
        thumbnails: { high: { url: "https://yt.example/h.jpg" } },
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

  function stubClient(): YoutubeClient {
    return {
      searchChannels: vi.fn(async (region, keyword, _max, _tok, publishedAfter) => ({
        ids: [
          publishedAfter
            ? `UC_${region}_${keyword.replace(/\s+/g, "_")}_pa`
            : `UC_${region}_${keyword.replace(/\s+/g, "_")}`,
        ],
        nextPageToken: null,
      })),
      fetchChannels: vi.fn(async (ids: readonly string[]) => ids.map((id) => fullChannel(id))),
    } satisfies YoutubeClient;
  }

  // Jan 2 2026: dayOfYear=2 → publishedAfter idx 2 → 365d window;
  // dayOfYear=2 → keyword rotation offset=(2%2)*6=0 (first half of
  // each 12-keyword pool); pickDailyPage cyclePos=2 → page 1.
  const day1 = new Date(Date.UTC(2026, 0, 2));

  it("publishedAfter phase fires only on full-matrix calls (no params.region/keywords)", async () => {
    const client = stubClient();
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      now: () => day1,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
      publishedAfterRegions: ["US", "JP"],
    });
    await adapter.discover({});
    // 1 main matrix call (US/gaming) + 2 publishedAfter phase calls
    // (US + JP, each with the first keyword from today's rotation).
    expect(client.searchChannels).toHaveBeenCalledTimes(3);
    const expectedAfter = publishedAfterIso(day1, 365);
    // Phase keyword resolves via pickDailyKeywords from the per-region
    // pool (US first half offset 0 → "gaming"; JP same → "ゲーム").
    expect(client.searchChannels).toHaveBeenNthCalledWith(
      2,
      "US",
      "gaming",
      50,
      undefined,
      expectedAfter
    );
    expect(client.searchChannels).toHaveBeenNthCalledWith(
      3,
      "JP",
      "ゲーム",
      50,
      undefined,
      expectedAfter
    );
  });

  it("publishedAfter phase is skipped when caller narrows to a single region", async () => {
    const client = stubClient();
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      now: () => day1,
      publishedAfterRegions: ["US", "JP"],
    });
    await adapter.discover({ region: "US", keywords: ["gaming"], maxResults: 10 });
    expect(client.searchChannels).toHaveBeenCalledTimes(1);
  });

  it("publishedAfter phase is disabled when publishedAfterRegions is empty/null", async () => {
    const client = stubClient();
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      now: () => day1,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
      // omit publishedAfterRegions
    });
    await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledTimes(1);
  });

  it("phase results dedupe against the main matrix via the shared seenIds set", async () => {
    // Both phases return the same id → only fetched/mapped once.
    const client: YoutubeClient = {
      searchChannels: vi.fn(async () => ({
        ids: ["UC_DUPE"],
        nextPageToken: null,
      })),
      fetchChannels: vi.fn(async (ids: readonly string[]) => ids.map((id) => fullChannel(id))),
    };
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      now: () => day1,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
      publishedAfterRegions: ["US"],
    });
    const data = await adapter.discover({});
    expect(client.searchChannels).toHaveBeenCalledTimes(2);
    expect(client.fetchChannels).toHaveBeenCalledTimes(1);
    expect(data).toHaveLength(1);
  });

  it("PUBLISHED_AFTER_CORE_REGIONS keeps the original B6 6-region ordering", () => {
    expect(PUBLISHED_AFTER_CORE_REGIONS).toEqual(["CN", "HK", "TW", "US", "JP", "KR"]);
  });
});
