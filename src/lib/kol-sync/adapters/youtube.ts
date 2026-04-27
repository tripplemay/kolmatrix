/**
 * B6-kol-daily-sync F002 · YouTube Data API adapter.
 *
 * Wraps the existing `scripts/seed-kol-from-youtube.ts` client + filter
 * helpers in the `KolSyncAdapter` contract so the daily cron can pull
 * via the dispatcher without touching YouTube specifics. The adapter
 * is stateless — quota counting / retry / DB writes happen one layer
 * out (F003 + F004).
 *
 * Daily quota math (default matrix):
 *   - discover: 6 region × 3 keyword × 1 page × 100 units = 1,800 units
 *   - refresh:  ⌈N/50⌉ channels.list calls × 1 unit  (≤ 4 units for
 *               the 200-KOL/day rotation in the spec)
 *   - healthCheck: 1 unit per probe
 *   - Total per cron: ~1,800-1,810 units of the 10,000/day free tier.
 */
import type { youtube_v3 } from "googleapis";

import {
  FILTER_MIN_SUBSCRIBERS,
  FILTER_MIN_VIDEOS,
  createYoutubeClient,
  isGamingTopic,
  type Region as KolSeedRegion,
  type YoutubeClient,
} from "../../../../scripts/seed-kol-from-youtube";
import type {
  HealthCheckResult,
  KolSyncAdapter,
  RawKolData,
  SyncParams,
} from "../types";

// ---------------------------------------------------------------------
// Daily matrix — what the adapter walks when SyncParams omits region.
// ---------------------------------------------------------------------

export type DailyRegion = "CN" | "HK" | "TW" | "US" | "JP" | "KR";

/** Six regions chosen to (a) keep the 中文区 supply up while the
 *  kol-seed-redo carry-forward gate (≥150 by 2026-05-03) is still
 *  open, and (b) refresh the major game-community markets. ES / GB
 *  are intentionally excluded from the daily matrix — they were
 *  covered by the kol-seed-redo one-shot crawl, and adding them
 *  wouldn't move the carry-forward needle. */
export const DAILY_REGIONS: readonly DailyRegion[] = [
  "CN",
  "HK",
  "TW",
  "US",
  "JP",
  "KR",
];

/** Three keywords per region — chosen to be more specific than the
 *  kol-seed-redo broad terms ("gaming"/"游戏") so we surface fresh
 *  channels the matrix hasn't already seen. */
export const DAILY_KEYWORDS_BY_REGION: Record<DailyRegion, readonly string[]> = {
  CN: ["游戏直播", "Steam", "手游推荐"],
  HK: ["游戏直播", "Steam", "手游推荐"],
  TW: ["游戏直播", "Steam", "手游推荐"],
  US: ["gaming", "esports", "let's play"],
  JP: ["ゲーム", "Vtuber", "実況"],
  KR: ["게임", "스트리머", "esports"],
};

/** Per-page result cap — `search.list` ignores anything > 50, but the
 *  daily spec wants smaller pages so the dispatcher's 1,800u/day
 *  budget is predictable. */
export const DAILY_MAX_RESULTS = 10;

/** A well-known stable channel used by `healthCheck()` to confirm
 *  API key + quota + JSON shape with one unit. YouTube Spotlight has
 *  been live since 2008 — safe to assume it's not going away. */
const HEALTH_CHECK_CHANNEL_ID = "UCBR8-60-B28hp2BmDPdntcQ";

// ---------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------

export interface YouTubeAdapterOpts {
  /** YOUTUBE_API_KEY. When undefined the adapter still constructs but
   *  every method throws — useful for tests that want to drive the
   *  failure branch without mocking. */
  apiKey: string | undefined;
  /** Inject a stub client in unit tests. Defaults to the real
   *  googleapis client built from `apiKey`. */
  client?: YoutubeClient;
  /** Override matrix (rare — used by F003 daily script for first-3-day
   *  carry-forward weighting). */
  regions?: readonly string[];
  keywordsByRegion?: Readonly<Record<string, readonly string[]>>;
  maxResults?: number;
}

export class YouTubeKolSyncAdapter implements KolSyncAdapter {
  readonly name = "youtube";
  readonly source = "youtube-api-daily";

  private readonly client: YoutubeClient | null;
  private readonly regions: readonly string[];
  private readonly keywordsByRegion: Readonly<Record<string, readonly string[]>>;
  private readonly maxResults: number;

  constructor(opts: YouTubeAdapterOpts) {
    this.regions = opts.regions ?? DAILY_REGIONS;
    this.keywordsByRegion =
      opts.keywordsByRegion ??
      (DAILY_KEYWORDS_BY_REGION as Readonly<Record<string, readonly string[]>>);
    this.maxResults = opts.maxResults ?? DAILY_MAX_RESULTS;
    if (opts.client) {
      this.client = opts.client;
    } else if (opts.apiKey) {
      this.client = createYoutubeClient(opts.apiKey);
    } else {
      this.client = null;
    }
  }

  async discover(params: SyncParams): Promise<RawKolData[]> {
    const client = this.requireClient();
    const regions = params.region ? [params.region] : this.regions;
    const maxResults = params.maxResults ?? this.maxResults;
    const minSubscribers = params.minSubscribers ?? FILTER_MIN_SUBSCRIBERS;

    // Dedupe across (region, keyword) so popular channels don't
    // double-bill the channels.list quota when multiple queries hit
    // them on the same day.
    const seenIds = new Set<string>();
    const results: RawKolData[] = [];

    for (const region of regions) {
      const keywords =
        params.keywords && params.keywords.length > 0
          ? params.keywords
          : this.keywordsByRegion[region] ?? [];
      for (const keyword of keywords) {
        // Cast: SyncParams.region is widened to string for portability
        // across adapters; the kol-seed-redo client predates B6 and
        // narrows to its own Region enum. The DAILY_REGIONS used by
        // this adapter are a subset of that enum, so the cast is
        // sound at runtime.
        const search = await client.searchChannels(
          region as KolSeedRegion,
          keyword,
          maxResults
        );
        const fresh = search.ids.filter((id) => !seenIds.has(id));
        for (const id of fresh) seenIds.add(id);
        if (fresh.length === 0) continue;
        const enriched = await client.fetchChannels(fresh);
        for (const raw of enriched) {
          const mapped = mapToRawKolData(raw, {
            matrixRegion: region,
            matrixKeyword: keyword,
            minSubscribers,
          });
          if (mapped) results.push(mapped);
        }
      }
    }
    return results;
  }

  async refresh(externalIds: readonly string[]): Promise<RawKolData[]> {
    const client = this.requireClient();
    if (externalIds.length === 0) return [];
    const out: RawKolData[] = [];
    // channels.list batches up to 50 ids per call.
    for (let i = 0; i < externalIds.length; i += 50) {
      const slice = externalIds.slice(i, i + 50);
      const enriched = await client.fetchChannels([...slice]);
      for (const raw of enriched) {
        // No matrix context in the refresh path — we're not searching,
        // we're re-fetching by id. The min-sub filter still applies so
        // a channel that fell below 10K stops getting refreshed.
        const mapped = mapToRawKolData(raw, {
          matrixRegion: null,
          matrixKeyword: null,
          minSubscribers: FILTER_MIN_SUBSCRIBERS,
        });
        if (mapped) out.push(mapped);
      }
    }
    return out;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.client) {
      return {
        healthy: false,
        details: { error: "YOUTUBE_API_KEY is not set" },
      };
    }
    try {
      const channels = await this.client.fetchChannels([HEALTH_CHECK_CHANNEL_ID]);
      const probe = channels[0];
      if (!probe?.id) {
        return {
          healthy: false,
          details: { error: "probe channel returned empty payload" },
        };
      }
      return {
        healthy: true,
        details: {
          probeChannelId: probe.id,
          probeChannelTitle: probe.snippet?.title ?? null,
          quotaCostThisProbe: 1,
        },
      };
    } catch (err) {
      return {
        healthy: false,
        details: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  private requireClient(): YoutubeClient {
    if (!this.client) {
      throw new Error(
        "YouTubeKolSyncAdapter: YOUTUBE_API_KEY is not set; healthCheck would have flagged this but discover/refresh were called anyway"
      );
    }
    return this.client;
  }
}

// ---------------------------------------------------------------------
// googleapis Channel → RawKolData (pure, fully unit-tested)
// ---------------------------------------------------------------------

interface MapCtx {
  matrixRegion: string | null;
  matrixKeyword: string | null;
  minSubscribers: number;
}

export function mapToRawKolData(
  raw: youtube_v3.Schema$Channel,
  ctx: MapCtx,
  now: () => string = () => new Date().toISOString()
): RawKolData | null {
  const id = raw.id ?? null;
  if (!id) return null;
  const stats = raw.statistics ?? {};
  const subscriberCount = parseIntSafe(stats.subscriberCount);
  const videoCount = parseIntSafe(stats.videoCount);
  const viewCount = parseIntSafe(stats.viewCount);
  if (subscriberCount < ctx.minSubscribers) return null;
  if (videoCount < FILTER_MIN_VIDEOS) return null;
  const snippet = raw.snippet ?? {};
  const description = (snippet.description ?? "").trim();
  if (description.length === 0) return null;
  const topicCategories = raw.topicDetails?.topicCategories ?? [];
  if (!isGamingTopic(topicCategories)) return null;
  const branding = raw.brandingSettings ?? {};
  return {
    externalId: id,
    platform: "youtube",
    handle: snippet.customUrl ?? null,
    displayName: snippet.title ?? "",
    description,
    country: snippet.country ?? null,
    language: snippet.defaultLanguage ?? null,
    thumbnailUrl:
      snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
    bannerUrl: branding.image?.bannerExternalUrl ?? null,
    subscriberCount,
    videoCount,
    viewCount,
    topicCategories,
    publishedAt: snippet.publishedAt ?? null,
    raw: {
      matrixRegion: ctx.matrixRegion,
      matrixKeyword: ctx.matrixKeyword,
      thumbnails: snippet.thumbnails,
    },
    scrapedAt: now(),
  };
}

function parseIntSafe(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
