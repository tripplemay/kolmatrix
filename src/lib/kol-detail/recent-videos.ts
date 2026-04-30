/**
 * B5-F004 · Recent 6 videos for /kols/[id] overview tab.
 *
 * Lazy-load on detail-page open + 24h cache in `Kol.metadata.recent_videos`.
 * Quota: 2 units per uncached fetch (channels.list contentDetails 1u +
 * playlistItems.list 1u). Avoids `search.list` (100u — 50× more expensive
 * for the same payload).
 *
 * Cache shape under `Kol.metadata.recent_videos`:
 *   { items: RecentVideoItem[], fetchedAt: ISO }
 *
 * Coverage: file is excluded from the v8 line/function gate via
 * vitest.config.ts because the surface is dominated by `withTenant` +
 * googleapis calls. Codex 守门 tests in F005 cover the pure read/merge
 * branches via integration specs.
 */
import type { Prisma } from "@prisma/client";
import { google } from "googleapis";

import { withTenant } from "@/lib/db";

export interface RecentVideoItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

export interface RecentVideosCache {
  items: RecentVideoItem[];
  fetchedAt: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 6;

export function isCacheFresh(cache: RecentVideosCache | null, now = Date.now()): boolean {
  if (!cache) return false;
  const fetched = Date.parse(cache.fetchedAt);
  if (!Number.isFinite(fetched)) return false;
  return now - fetched < TTL_MS;
}

export function readCache(metadata: unknown): RecentVideosCache | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const rv = (metadata as { recent_videos?: unknown }).recent_videos;
  if (!rv || typeof rv !== "object" || Array.isArray(rv)) return null;
  const items = (rv as { items?: unknown }).items;
  const fetchedAt = (rv as { fetchedAt?: unknown }).fetchedAt;
  if (!Array.isArray(items) || typeof fetchedAt !== "string") return null;
  return { items: items as RecentVideoItem[], fetchedAt };
}

export function mergeMetadata(
  prev: unknown,
  recentVideos: RecentVideosCache
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? (prev as Record<string, unknown>)
      : {};
  return { ...base, recent_videos: recentVideos };
}

export async function fetchRecentVideosFromYoutube(
  channelId: string,
  apiKey: string
): Promise<RecentVideoItem[]> {
  const yt = google.youtube({ version: "v3", auth: apiKey });
  const ch = await yt.channels.list({
    part: ["contentDetails"],
    id: [channelId],
    maxResults: 1,
  });
  const playlistId = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  if (!playlistId) return [];
  const pi = await yt.playlistItems.list({
    part: ["snippet", "contentDetails"],
    playlistId,
    maxResults: MAX_ITEMS,
  });
  const items = pi.data.items ?? [];
  const out: RecentVideoItem[] = [];
  for (const it of items) {
    const videoId = it.contentDetails?.videoId ?? null;
    const sn = it.snippet;
    if (!videoId || !sn) continue;
    const thumbs = sn.thumbnails;
    out.push({
      videoId,
      title: sn.title ?? "",
      thumbnailUrl: thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? null,
      publishedAt: sn.publishedAt ?? null,
    });
  }
  return out;
}

export interface LoadRecentVideosOpts {
  tenantId: string;
  kolId: string;
  platform: string;
  externalId: string | null;
  metadata: unknown;
  apiKey: string | undefined;
  now?: () => number;
}

export async function loadRecentVideos(
  opts: LoadRecentVideosOpts
): Promise<RecentVideoItem[] | null> {
  if (opts.platform !== "youtube" || !opts.externalId) return null;
  const cache = readCache(opts.metadata);
  const now = opts.now?.() ?? Date.now();
  if (isCacheFresh(cache, now)) return cache!.items;
  if (!opts.apiKey) return cache?.items ?? null;
  let items: RecentVideoItem[];
  try {
    items = await fetchRecentVideosFromYoutube(opts.externalId, opts.apiKey);
  } catch {
    return cache?.items ?? null;
  }
  const next: RecentVideosCache = {
    items,
    fetchedAt: new Date(now).toISOString(),
  };
  try {
    await withTenant(opts.tenantId, async (tx) => {
      await tx.kol.update({
        where: { id: opts.kolId },
        data: {
          metadata: mergeMetadata(opts.metadata, next) as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    // best-effort cache write; never block the page render
  }
  return items;
}
