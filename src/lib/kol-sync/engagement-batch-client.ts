/**
 * BIx-mvp-polish-pass F004-P4 · googleapis-backed
 * EngagementBatchClient.
 *
 * Thin adapter over `youtube_v3` so the orchestrator in
 * `engagement-batch.ts` stays unit-testable. Quota math (per spec
 * §F004 #7):
 *
 *   channels.list contentDetails  · 1u/call · batches 50 ids
 *   playlistItems.list snippet+CD · 1u/call · 1 channel/call (6 ids)
 *   videos.list snippet+statistics · 1u/call · batches 50 ids
 */
import { google, type youtube_v3 } from "googleapis";

import type { EngagementBatchClient, EngagementVideoStats } from "./engagement-batch";

export function createEngagementBatchClient(apiKey: string): EngagementBatchClient {
  const yt = google.youtube({ version: "v3", auth: apiKey });
  return {
    async fetchUploadsPlaylists(channelIds) {
      const out = new Map<string, string>();
      for (let i = 0; i < channelIds.length; i += 50) {
        const slice = channelIds.slice(i, i + 50);
        const res = await yt.channels.list({
          part: ["contentDetails"],
          id: [...slice],
          maxResults: 50,
        });
        for (const item of res.data.items ?? []) {
          const id = item.id;
          const uploads = item.contentDetails?.relatedPlaylists?.uploads ?? null;
          if (id && uploads) out.set(id, uploads);
        }
      }
      return out;
    },
    async fetchPlaylistVideoIds(playlistId, maxItems) {
      const res = await yt.playlistItems.list({
        part: ["contentDetails"],
        playlistId,
        maxResults: maxItems,
      });
      const items = res.data.items ?? [];
      const out: string[] = [];
      for (const it of items) {
        const id = it.contentDetails?.videoId;
        if (id) out.push(id);
      }
      return out;
    },
    async fetchVideoStats(videoIds) {
      if (videoIds.length === 0) return [];
      const res = await yt.videos.list({
        part: ["snippet", "statistics"],
        id: [...videoIds],
        maxResults: 50,
      });
      return (res.data.items ?? [])
        .map(toStats)
        .filter((s): s is EngagementVideoStats => s !== null);
    },
  };
}

function toStats(item: youtube_v3.Schema$Video): EngagementVideoStats | null {
  const id = item.id;
  if (!id) return null;
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const thumbs = snippet.thumbnails;
  return {
    videoId: id,
    title: snippet.title ?? "",
    thumbnailUrl: thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null,
    viewCount: parseIntSafe(stats.viewCount),
    likeCount: parseIntSafe(stats.likeCount),
    commentCount: parseIntSafe(stats.commentCount),
    publishedAt: snippet.publishedAt ?? null,
  };
}

function parseIntSafe(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
