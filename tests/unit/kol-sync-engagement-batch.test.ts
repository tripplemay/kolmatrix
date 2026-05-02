/**
 * BIx-mvp-polish-pass F004-P4 unit tests · top-100 engagement batch.
 */
import { describe, expect, it, vi } from "vitest";

import {
  computeEngagementRate,
  runEngagementBatch,
  type EngagementBatchClient,
  type EngagementVideoStats,
} from "@/lib/kol-sync/engagement-batch";

function vid(overrides: Partial<EngagementVideoStats>): EngagementVideoStats {
  return {
    videoId: "v",
    title: "t",
    thumbnailUrl: null,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    publishedAt: null,
    ...overrides,
  };
}

describe("computeEngagementRate", () => {
  it("returns total(like+comment) / total(views)", () => {
    const r = computeEngagementRate([
      vid({ viewCount: 1000, likeCount: 50, commentCount: 10 }),
      vid({ viewCount: 2000, likeCount: 100, commentCount: 40 }),
    ]);
    // (60 + 140) / (1000 + 2000) = 200 / 3000 ≈ 0.0667
    expect(r).toBeCloseTo(200 / 3000, 6);
  });

  it("returns null when there are no videos", () => {
    expect(computeEngagementRate([])).toBeNull();
  });

  it("returns null when total views are zero (avoid Infinity)", () => {
    expect(computeEngagementRate([vid({ likeCount: 5 })])).toBeNull();
  });
});

describe("runEngagementBatch", () => {
  function stubClient(): EngagementBatchClient {
    return {
      // 50-id batches → 1 call for ≤ 50, 2 for 51-100, etc.
      fetchUploadsPlaylists: vi.fn(async (ids: readonly string[]) => {
        const map = new Map<string, string>();
        for (const id of ids) map.set(id, `PL_${id}`);
        return map;
      }),
      fetchPlaylistVideoIds: vi.fn(async (playlistId: string, max: number) => {
        const channelId = playlistId.replace(/^PL_/, "");
        return Array.from({ length: max }, (_, i) => `${channelId}_v${i}`);
      }),
      fetchVideoStats: vi.fn(async (ids: readonly string[]) =>
        ids.map((id, i) =>
          vid({
            videoId: id,
            title: `Title ${id}`,
            viewCount: 1000 * (i + 1),
            likeCount: 50,
            commentCount: 10,
          })
        )
      ),
    };
  }

  it("returns empty result for empty input without burning quota", async () => {
    const client = stubClient();
    const r = await runEngagementBatch({ topChannels: [], client });
    expect(r.updates).toEqual([]);
    expect(r.apiCallStats).toEqual({ channels: 0, playlistItems: 0, videos: 0 });
    expect(client.fetchUploadsPlaylists).not.toHaveBeenCalled();
  });

  it("orchestrates channels → playlist → videos for 100 KOL with correct call counts", async () => {
    const client = stubClient();
    const topChannels = Array.from({ length: 100 }, (_, i) => ({
      kolId: `kol-${i}`,
      externalId: `UC_${i}`,
    }));
    const r = await runEngagementBatch({ topChannels, client });

    // Spec §F004 #7: 100/50=2 channels.list calls + 100 playlistItems
    // + 600 videos / 50 batch = 12 videos.list calls.
    expect(r.apiCallStats).toEqual({ channels: 2, playlistItems: 100, videos: 12 });
    expect(r.topKolsProcessed).toBe(100);
    expect(r.channelsWithoutPlaylist).toBe(0);
    expect(r.videosFetched).toBe(600);
    expect(r.updates).toHaveLength(100);
    // First channel: 6 videos with viewCount 1000..6000, like+comment
    // 60 each → 360 / 21000 ≈ 0.0171.
    expect(r.updates[0]!.engagementRate).toBeCloseTo(360 / 21000, 6);
    expect(r.updates[0]!.latestVideos).toHaveLength(6);
  });

  it("counts channels-without-playlist and yields null engagementRate for them", async () => {
    const client: EngagementBatchClient = {
      fetchUploadsPlaylists: vi.fn(async () => new Map([["UC_with", "PL_with"]])),
      fetchPlaylistVideoIds: vi.fn(async () => ["v1", "v2"]),
      fetchVideoStats: vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => vid({ videoId: id, viewCount: 1000, likeCount: 100 }))
      ),
    };
    const r = await runEngagementBatch({
      topChannels: [
        { kolId: "kol-with", externalId: "UC_with" },
        { kolId: "kol-without", externalId: "UC_without" },
      ],
      client,
    });
    expect(r.channelsWithoutPlaylist).toBe(1);
    expect(r.updates).toHaveLength(2);
    const without = r.updates.find((u) => u.externalId === "UC_without")!;
    expect(without.engagementRate).toBeNull();
    expect(without.latestVideos).toHaveLength(0);
    const withCh = r.updates.find((u) => u.externalId === "UC_with")!;
    expect(withCh.latestVideos).toHaveLength(2);
  });

  it("dedupes overlapping video ids across channels (collab credit)", async () => {
    const client: EngagementBatchClient = {
      fetchUploadsPlaylists: vi.fn(async (ids: readonly string[]) =>
        new Map(ids.map((id) => [id, `PL_${id}`]))
      ),
      // Both channels surface the same video "v_shared".
      fetchPlaylistVideoIds: vi.fn(async () => ["v_shared", "v_unique"]),
      fetchVideoStats: vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => vid({ videoId: id, viewCount: 1000, likeCount: 50 }))
      ),
    };
    const r = await runEngagementBatch({
      topChannels: [
        { kolId: "k1", externalId: "UC_a" },
        { kolId: "k2", externalId: "UC_b" },
      ],
      client,
    });
    // 3 unique ids (v_shared once + UC_a-only? no wait, both channels
    // returned exactly ["v_shared","v_unique"] — same names; so 2
    // unique). 1 batch call to videos.list.
    expect(client.fetchVideoStats).toHaveBeenCalledTimes(1);
    expect(r.videosFetched).toBe(2);
    // Each channel's latestVideos still has 2 entries (the dedupe is
    // only at the API-call layer; per-channel rollup re-attaches).
    expect(r.updates[0]!.latestVideos).toHaveLength(2);
    expect(r.updates[1]!.latestVideos).toHaveLength(2);
  });

  it("surfaces a playlist call error as an empty videos list (no crash)", async () => {
    const client: EngagementBatchClient = {
      fetchUploadsPlaylists: vi.fn(async (ids: readonly string[]) =>
        new Map(ids.map((id) => [id, `PL_${id}`]))
      ),
      fetchPlaylistVideoIds: vi
        .fn()
        .mockImplementationOnce(async () => ["v1"])
        .mockImplementationOnce(async () => {
          throw new Error("403 quota");
        }),
      fetchVideoStats: vi.fn(async (ids: readonly string[]) =>
        ids.map((id) => vid({ videoId: id, viewCount: 1000, likeCount: 100 }))
      ),
    };
    const r = await runEngagementBatch({
      topChannels: [
        { kolId: "k1", externalId: "UC_a" },
        { kolId: "k2", externalId: "UC_b" },
      ],
      client,
    });
    expect(r.updates).toHaveLength(2);
    expect(r.updates[1]!.latestVideos).toHaveLength(0);
    // Still counted against the quota — the API charged a unit for
    // the failed call, and we want the cost surfaced in the log.
    expect(r.apiCallStats.playlistItems).toBe(2);
  });
});
