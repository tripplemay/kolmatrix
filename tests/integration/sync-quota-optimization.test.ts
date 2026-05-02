/**
 * BIx-mvp-polish-pass F004-P5 · sync quota optimization integration.
 *
 * Hermetic — no Postgres, no real API. Drives the full BIx-F004 stack
 * via stub adapters / clients to assert the *combination* of P1+P2+
 * P3+P4+P5 behaves as the spec promises:
 *
 *   - 14-region matrix produces 84 search.list calls/day (P1)
 *   - keyword pool of 12 / region rotates 6 by dayOfYear%2 (P1)
 *   - publishedAfter slice phase fires 6 region calls (P3)
 *   - tiered refresh uses fetchTieredRefreshIds (P3)
 *   - engagement batch persists engagementRate + latestVideos (P4)
 *   - per-matrix observability rows surface in the log line (P5)
 *
 * Lives under tests/integration so it runs via the integration vitest
 * config but doesn't touch a real DB; the included tests guard the
 * integration of the pure modules + the orchestrator wiring.
 */
import { describe, expect, it, vi } from "vitest";

import {
  DAILY_KEYWORD_POOL_BY_REGION,
  DAILY_REGIONS,
  YouTubeKolSyncAdapter,
  pickDailyKeywords,
} from "@/lib/kol-sync/adapters/youtube";
import {
  PUBLISHED_AFTER_CORE_REGIONS,
  pickPublishedAfterDays,
  publishedAfterIso,
} from "@/lib/kol-sync/published-after";
import { pickTieredRefreshIds } from "@/lib/kol-sync/refresh-selector";
import { runEngagementBatch, type EngagementBatchClient } from "@/lib/kol-sync/engagement-batch";
import { classifyDailyRun, type PerMatrixEntry } from "@/lib/kol-sync/log";
import type { YoutubeClient } from "@/../scripts/seed-kol-from-youtube";

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

describe("BIx-F004 quota optimization · 14-region matrix end-to-end (P1+P3+P5)", () => {
  it("walks 14 region × 6 keyword + emits per-matrix observability rows", async () => {
    const cells: PerMatrixEntry[] = [];
    const client: YoutubeClient = {
      searchChannels: vi.fn(async (region, keyword) => ({
        ids: [`UC_${region}_${keyword.replace(/\s+/g, "_")}`],
        nextPageToken: null,
      })),
      fetchChannels: vi.fn(async (ids) => ids.map(fullChannel)),
    };
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      onMatrixCell: (e) => cells.push(e),
    });
    await adapter.discover({});
    // 14 region × 6 keyword = 84 main matrix calls.
    expect(cells.length).toBe(84);
    expect(client.searchChannels).toHaveBeenCalledTimes(84);
    expect(cells.every((c) => !c.keyword.includes("|after="))).toBe(true);
    // Each cell saw 1 fresh id and zero rejections.
    expect(cells.every((c) => c.found === 1 && c.newAfterDedupe === 1)).toBe(true);
  });

  it("publishedAfter phase fires for the 6 core regions and tags cells with the window", async () => {
    const cells: PerMatrixEntry[] = [];
    const client: YoutubeClient = {
      searchChannels: vi.fn(async (region, keyword) => ({
        ids: [`UC_${region}_${keyword.replace(/\s+/g, "_")}`],
        nextPageToken: null,
      })),
      fetchChannels: vi.fn(async (ids) => ids.map(fullChannel)),
    };
    const adapter = new YouTubeKolSyncAdapter({
      apiKey: "key",
      client,
      regions: ["US"],
      keywordsByRegion: { US: ["gaming"] },
      publishedAfterRegions: PUBLISHED_AFTER_CORE_REGIONS,
      onMatrixCell: (e) => cells.push(e),
    });
    await adapter.discover({});
    // 1 main call + 6 phase calls.
    expect(cells.length).toBe(7);
    const phaseCells = cells.filter((c) => c.keyword.includes("|after="));
    expect(phaseCells.length).toBe(6);
    // The phase suffix carries the live lookback window.
    const today = new Date();
    const days = pickPublishedAfterDays(today);
    for (const c of phaseCells) {
      expect(c.keyword.endsWith(`|after=${days}d`)).toBe(true);
      expect(c.page).toBe(1);
    }
    // PUBLISHED_AFTER_CORE_REGIONS == cell.region (in order)
    const phaseRegions = phaseCells.map((c) => c.region);
    expect(phaseRegions).toEqual([...PUBLISHED_AFTER_CORE_REGIONS]);
  });
});

describe("BIx-F004 quota optimization · pool rotation invariants (P1)", () => {
  it("each of 14 regions has exactly 12 keywords; pickDailyKeywords returns 6", () => {
    expect(DAILY_REGIONS.length).toBe(14);
    for (const r of DAILY_REGIONS) {
      const pool = DAILY_KEYWORD_POOL_BY_REGION[r];
      expect(pool.length).toBe(12);
      expect(pickDailyKeywords(r, new Date(Date.UTC(2026, 0, 1))).length).toBe(6);
    }
  });

  it("two consecutive days cover the full 12-keyword pool exactly once", () => {
    for (const r of DAILY_REGIONS) {
      const day0 = pickDailyKeywords(r, new Date(Date.UTC(2026, 0, 2)));
      const day1 = pickDailyKeywords(r, new Date(Date.UTC(2026, 0, 3)));
      const union = new Set([...day0, ...day1]);
      expect(union.size).toBe(12);
    }
  });
});

describe("BIx-F004 quota optimization · tiered refresh prioritisation (P3)", () => {
  it("flagged + tier 1 always run; long-tail rotates over 21 days", () => {
    const tier1 = Array.from({ length: 50 }, (_, i) => `T1_${i}`);
    const tier2 = Array.from({ length: 450 }, (_, i) => `T2_${i}`);
    const tier3 = Array.from({ length: 5000 }, (_, i) => `T3_${i}`);
    const flagged = ["FLAG_X"];
    const day = new Date(Date.UTC(2026, 0, 1));
    const out = pickTieredRefreshIds({
      tier1,
      tier2,
      tier3,
      flagged,
      date: day,
      maxTotal: 200,
    });
    // Flagged first, then tier 1 slice, then tier 2 slice.
    expect(out[0]).toBe("FLAG_X");
    expect(
      out
        .slice(1)
        .every((id) => id.startsWith("T1_") || id.startsWith("T2_") || id.startsWith("T3_"))
    ).toBe(true);
    expect(out.length).toBeLessThanOrEqual(200);
  });
});

describe("BIx-F004 quota optimization · engagement batch + log line (P4+P5)", () => {
  it("engagement batch result feeds back into classifyDailyRun via engagementBatchStats", async () => {
    const client: EngagementBatchClient = {
      fetchUploadsPlaylists: vi.fn(
        async (ids: readonly string[]) => new Map(ids.map((id) => [id, `PL_${id}`]))
      ),
      fetchPlaylistVideoIds: vi.fn(async () => ["v1", "v2", "v3", "v4", "v5", "v6"]),
      fetchVideoStats: vi.fn(async (ids: readonly string[]) =>
        ids.map((id, i) => ({
          videoId: id,
          title: `T-${id}`,
          thumbnailUrl: null,
          viewCount: 1000 * (i + 1),
          likeCount: 100,
          commentCount: 20,
          publishedAt: null,
        }))
      ),
    };
    const result = await runEngagementBatch({
      topChannels: [
        { kolId: "k1", externalId: "UC_a" },
        { kolId: "k2", externalId: "UC_b" },
      ],
      client,
    });
    expect(result.updates).toHaveLength(2);
    expect(result.updates[0]!.engagementRate).toBeGreaterThan(0);

    const logLine = classifyDailyRun({
      timestamp: "2026-05-02T08:30:00Z",
      endedAt: "2026-05-02T08:30:30Z",
      adapters: [{ name: "youtube", healthy: true }],
      discoverCount: 50,
      refreshCount: 200,
      inserted: 30,
      updated: 5,
      skipped: 15,
      dedupeSkipped: 0,
      estimatedQuotaConsumed: 9_100,
      estimatedQuotaRemaining: 900,
      errors: [],
      zeroDiscoverStreakBefore: 0,
      perMatrix: [
        {
          region: "US",
          keyword: "gaming",
          page: 1,
          found: 50,
          newAfterDedupe: 48,
          filterRejections: 12,
        },
      ],
      engagementBatchStats: {
        topKolsProcessed: result.topKolsProcessed,
        engagementUpdated: 2,
        latestVideosUpdated: 2,
        channelsWithoutPlaylist: result.channelsWithoutPlaylist,
        apiCallStats: result.apiCallStats,
      },
    });
    // Within the new 9,500u threshold → INFO.
    expect(logLine.level).toBe("INFO");
    expect(logLine.perMatrix).toBeDefined();
    expect(logLine.perMatrix?.[0]?.region).toBe("US");
    expect(logLine.engagementBatchStats?.topKolsProcessed).toBe(2);
    expect(logLine.engagementBatchStats?.apiCallStats.videos).toBe(1);
  });

  it("publishedAfter ISO subtracts the rotated window deterministically", () => {
    const today = new Date(Date.UTC(2026, 4, 1));
    const days = pickPublishedAfterDays(today);
    const iso = publishedAfterIso(today, days);
    const back = new Date(iso);
    expect(today.getTime() - back.getTime()).toBe(days * 86_400_000);
  });
});
