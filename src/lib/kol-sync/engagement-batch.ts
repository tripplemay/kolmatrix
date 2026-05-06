/**
 * BIx-mvp-polish-pass F004-P4 · Top 100 KOL engagement batch.
 *
 * Replaces the B5-F004 lazy-load (100u per detail-page open) with a
 * once-a-day pre-compute that writes the *real* `engagementRate` plus
 * a 6-video `latestVideos` cache straight into `Kol.metadata`.
 *
 * Pipeline (per spec §F004 #7, ~114u/day total):
 *   1. channels.list contentDetails  — 100/50 = 2 calls × 1u  =   2u
 *   2. playlistItems.list (top 6 ids) — 100 calls × 1u         = 100u
 *   3. videos.list stats              — 600/50 = 12 calls × 1u =  12u
 *
 * The orchestrator (`runEngagementBatch`) is pure — every API call
 * goes through `EngagementBatchClient`, so unit tests can drive the
 * fan-out / averaging / dedupe paths with an in-memory stub. The
 * googleapis-backed client lives in `engagement-batch-client.ts`.
 *
 * Engagement formula: `avg(likeCount + commentCount) / avg(viewCount)`
 * across the 6 most-recent videos. Falls back to `null` when the
 * channel has no playlist or every video reports zero views (avoids
 * NaN / Infinity polluting the column).
 */

export interface EngagementVideoStats {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
}

export interface EngagementBatchClient {
  /** channels.list contentDetails → map of channelId → uploads
   *  playlist id. Implementations should batch 50 ids per call. */
  fetchUploadsPlaylists(channelIds: readonly string[]): Promise<Map<string, string>>;
  /** playlistItems.list → up to `maxItems` most-recent video ids. */
  fetchPlaylistVideoIds(playlistId: string, maxItems: number): Promise<readonly string[]>;
  /** videos.list snippet+statistics. Implementations should batch
   *  50 ids per call (the API ceiling). */
  fetchVideoStats(videoIds: readonly string[]): Promise<readonly EngagementVideoStats[]>;
}

export interface TopChannelInput {
  /** `Kol.id` — used downstream to write back via Prisma. */
  kolId: string;
  /** `Kol.externalId` — the YouTube channel id. */
  externalId: string;
}

export interface EngagementBatchInput {
  topChannels: readonly TopChannelInput[];
  client: EngagementBatchClient;
  /** Spec §F004 #7 fixes this at 6 — kept configurable for tests. */
  maxVideosPerChannel?: number;
}

export interface EngagementUpdate {
  kolId: string;
  externalId: string;
  /** BL-023-F008: percentage in [0, 100] (e.g. 4.2 = 4.2%). The rest
   *  of the app — UI cards, filters, seed data, value-score buckets —
   *  treats engagement_rate as a percentage; the original 2026-04 BIx
   *  F004 P4 implementation returned a fraction here, which silently
   *  wrote 0.04 into the Decimal(5,2) column for a "real" 4% rate and
   *  surfaced as "0.0%" in the UI. Fixed in BL-023 along with a one-
   *  shot backfill of the 137 affected prod KOL. */
  engagementRate: number | null;
  latestVideos: readonly EngagementVideoStats[];
}

export interface EngagementBatchResult {
  updates: readonly EngagementUpdate[];
  topKolsProcessed: number;
  channelsWithoutPlaylist: number;
  videosFetched: number;
  apiCallStats: {
    channels: number;
    playlistItems: number;
    videos: number;
  };
}

export const DEFAULT_VIDEOS_PER_CHANNEL = 6;
export const VIDEOS_LIST_BATCH = 50;

export async function runEngagementBatch(
  input: EngagementBatchInput
): Promise<EngagementBatchResult> {
  const maxVideos = input.maxVideosPerChannel ?? DEFAULT_VIDEOS_PER_CHANNEL;
  const topKolsProcessed = input.topChannels.length;
  if (topKolsProcessed === 0) {
    return {
      updates: [],
      topKolsProcessed: 0,
      channelsWithoutPlaylist: 0,
      videosFetched: 0,
      apiCallStats: { channels: 0, playlistItems: 0, videos: 0 },
    };
  }

  // Step 1 — uploads playlist ids. Client batches internally; we count
  // calls via the returned map size (one call per ⌈n/50⌉).
  const channelIds = input.topChannels.map((c) => c.externalId);
  const playlistMap = await input.client.fetchUploadsPlaylists(channelIds);
  const channelsCalls = Math.ceil(channelIds.length / 50);

  // Step 2 — top N video ids per channel (1u per call). Sequential
  // rather than parallel: API quota is daily-window, not RPS-bound,
  // and we'd rather one bad channel error not nuke the whole run.
  let playlistItemsCalls = 0;
  let channelsWithoutPlaylist = 0;
  const channelToVideoIds = new Map<string, readonly string[]>();
  for (const ch of input.topChannels) {
    const playlistId = playlistMap.get(ch.externalId);
    if (!playlistId) {
      channelsWithoutPlaylist += 1;
      channelToVideoIds.set(ch.externalId, []);
      continue;
    }
    try {
      const ids = await input.client.fetchPlaylistVideoIds(playlistId, maxVideos);
      playlistItemsCalls += 1;
      channelToVideoIds.set(ch.externalId, ids);
    } catch {
      // One channel's playlist erroring shouldn't sink the batch.
      // Count the (failed) call against quota — it still consumed a
      // unit upstream — and move on with no videos.
      playlistItemsCalls += 1;
      channelToVideoIds.set(ch.externalId, []);
    }
  }

  // Step 3 — videos.list batched 50/call, deduped (the same video id
  // can technically appear under multiple channels via collabs).
  const allVideoIds = new Set<string>();
  for (const ids of channelToVideoIds.values()) {
    for (const id of ids) allVideoIds.add(id);
  }
  const orderedIds = Array.from(allVideoIds);
  const videoMap = new Map<string, EngagementVideoStats>();
  let videosCalls = 0;
  for (let i = 0; i < orderedIds.length; i += VIDEOS_LIST_BATCH) {
    const slice = orderedIds.slice(i, i + VIDEOS_LIST_BATCH);
    const stats = await input.client.fetchVideoStats(slice);
    videosCalls += 1;
    for (const s of stats) videoMap.set(s.videoId, s);
  }

  // Per-channel rollup — preserves the playlist's chronological order
  // (newest first, which is YouTube's default for an uploads playlist).
  const updates: EngagementUpdate[] = [];
  for (const ch of input.topChannels) {
    const ids = channelToVideoIds.get(ch.externalId) ?? [];
    const videos: EngagementVideoStats[] = [];
    for (const id of ids) {
      const stats = videoMap.get(id);
      if (stats) videos.push(stats);
    }
    updates.push({
      kolId: ch.kolId,
      externalId: ch.externalId,
      engagementRate: computeEngagementRate(videos),
      latestVideos: videos,
    });
  }

  return {
    updates,
    topKolsProcessed,
    channelsWithoutPlaylist,
    videosFetched: videoMap.size,
    apiCallStats: {
      channels: channelsCalls,
      playlistItems: playlistItemsCalls,
      videos: videosCalls,
    },
  };
}

/**
 * `avg(likeCount + commentCount) / avg(viewCount) * 100` across the
 * input window — returns a percentage (e.g. 4.2 for a 4.2% rate) so it
 * matches the unit the rest of the app (UI cards, filters, seed,
 * BL-023 value-score buckets) already expects. Returns `null` when
 * there aren't enough data points (no videos, or zero total views —
 * typical for unlisted/private channels that crept in via topic filter).
 */
export function computeEngagementRate(videos: readonly EngagementVideoStats[]): number | null {
  if (videos.length === 0) return null;
  let totalEngagements = 0;
  let totalViews = 0;
  for (const v of videos) {
    totalEngagements += v.likeCount + v.commentCount;
    totalViews += v.viewCount;
  }
  if (totalViews <= 0) return null;
  return (totalEngagements / totalViews) * 100;
}
