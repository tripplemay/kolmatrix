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
  FILTER_MIN_VIDEOS,
  createYoutubeClient,
  getFilterMinSubscribers,
  isGamingTopic,
  type Region as KolSeedRegion,
  type YoutubeClient,
} from "../../../../scripts/seed-kol-from-youtube";
import { pickDailyPage, type KolSyncCursorProvider } from "../cursor";
import type { PerMatrixEntry } from "../log";
import {
  pickPublishedAfterDays,
  publishedAfterIso,
  PUBLISHED_AFTER_CORE_REGIONS,
} from "../published-after";
import type { HealthCheckResult, KolSyncAdapter, RawKolData, SyncParams } from "../types";

// ---------------------------------------------------------------------
// Daily matrix — what the adapter walks when SyncParams omits region.
// BIx-F004-P1: 6 → 14 region matrix; per-region keyword pool of 12
// rotated 6-at-a-time by day-of-year; per-page cap 10 → 50.
// ---------------------------------------------------------------------

export type DailyRegion =
  | "CN"
  | "HK"
  | "TW"
  | "US"
  | "GB"
  | "DE"
  | "ES"
  | "BR"
  | "MX"
  | "JP"
  | "KR"
  | "TH"
  | "ID"
  | "IN";

/** 14 regions — covers Chinese / Anglo / European / Latin / SEA /
 *  South Asian gaming-creator pools. Combined with the day-of-year
 *  keyword rotation below, this lifts daily quota utilization from
 *  ~18% to ~91%. ISO-3166-1 alpha-2 codes go straight into
 *  `search.list?regionCode=…`. */
export const DAILY_REGIONS: readonly DailyRegion[] = [
  "CN",
  "HK",
  "TW",
  "US",
  "GB",
  "DE",
  "ES",
  "BR",
  "MX",
  "JP",
  "KR",
  "TH",
  "ID",
  "IN",
];

/** Per-region keyword pool — 12 game-creator vertical terms. Each cron
 *  day picks 6 by `dayOfYear % 2` (0 → indices 0–5, 1 → indices 6–11)
 *  so a full rotation covers the pool every 2 days. Verticals cover
 *  MOBA / FPS / RPG / 二次元 / live / commentary / strategy / Vtuber /
 *  review / speedrun / VR / mobile / indie. */
export const DAILY_KEYWORD_POOL_BY_REGION: Record<DailyRegion, readonly string[]> = {
  CN: [
    "游戏直播",
    "Steam",
    "手游推荐",
    "电竞解说",
    "游戏攻略",
    "速通",
    "二次元游戏",
    "Vtuber",
    "MOBA",
    "FPS",
    "原神",
    "独立游戏",
  ],
  HK: [
    "游戏直播",
    "Steam",
    "手游推荐",
    "電競",
    "Game 攻略",
    "速通",
    "二次元",
    "Vtuber",
    "MOBA",
    "FPS",
    "原神",
    "獨立遊戲",
  ],
  TW: [
    "遊戲直播",
    "Steam",
    "手遊推薦",
    "電競",
    "遊戲攻略",
    "速通",
    "二次元",
    "Vtuber",
    "MOBA",
    "FPS",
    "原神",
    "獨立遊戲",
  ],
  US: [
    "gaming",
    "esports",
    "let's play",
    "FPS gameplay",
    "MOBA",
    "RPG playthrough",
    "speedrun",
    "indie game",
    "VR gaming",
    "mobile gaming",
    "game review",
    "twitch streamer",
  ],
  GB: [
    "gaming",
    "esports",
    "let's play",
    "FPS",
    "MOBA",
    "RPG",
    "speedrun",
    "indie",
    "VR",
    "mobile gaming",
    "game review",
    "streamer",
  ],
  DE: [
    "Gaming",
    "esports",
    "Let's Play",
    "Gameplay",
    "MOBA",
    "Rollenspiel",
    "Speedrun",
    "Indie Spiel",
    "VR Gaming",
    "Mobile Gaming",
    "Spielereview",
    "Streamer",
  ],
  ES: [
    "juegos",
    "gaming",
    "esports",
    "videojuegos",
    "MOBA",
    "FPS",
    "rol",
    "speedrun",
    "indie",
    "móviles",
    "análisis juego",
    "streamer",
  ],
  BR: [
    "jogos",
    "gameplay",
    "esports",
    "Let's Play",
    "MOBA",
    "FPS",
    "RPG",
    "speedrun",
    "indie",
    "mobile",
    "análise de jogo",
    "streamer",
  ],
  MX: [
    "videojuegos",
    "gameplay",
    "esports",
    "gaming",
    "MOBA",
    "FPS",
    "rol",
    "speedrun",
    "indie",
    "móviles",
    "reseña",
    "streamer",
  ],
  JP: [
    "ゲーム",
    "実況",
    "Vtuber",
    "ゲーム実況",
    "esports",
    "FPS",
    "RPG",
    "速攻",
    "インディーゲーム",
    "VR",
    "モバイルゲーム",
    "ゲームレビュー",
  ],
  KR: [
    "게임",
    "스트리머",
    "esports",
    "방송",
    "프로게이머",
    "FPS",
    "RPG",
    "스피드런",
    "인디게임",
    "VR",
    "모바일게임",
    "게임리뷰",
  ],
  TH: [
    "เกม",
    "เกมมิ่ง",
    "esports",
    "สตรีมเมอร์",
    "MOBA",
    "FPS",
    "RPG",
    "เกมมือถือ",
    "speedrun",
    "อินดี้",
    "รีวิวเกม",
    "Vtuber",
  ],
  ID: [
    "gaming",
    "game",
    "esports",
    "streamer",
    "MOBA",
    "FPS",
    "RPG",
    "Mobile Legends",
    "speedrun",
    "indie",
    "review game",
    "let's play",
  ],
  IN: [
    "gaming",
    "esports",
    "gameplay",
    "BGMI",
    "Free Fire",
    "FPS",
    "MOBA",
    "RPG",
    "speedrun",
    "indie",
    "game review",
    "streamer",
  ],
};

/**
 * Pick today's 6 keywords for a region from the 12-deep pool.
 * Rotation = `dayOfYear % 2` → indices 0–5 (even days) or 6–11 (odd
 * days). Two-day cycle covers the full vertical rotation; combined
 * with the publishedAfter slice cycle (F004-P3) the matrix surfaces
 * different cohorts every day. Pure / deterministic / unit-testable.
 */
export function pickDailyKeywords(region: DailyRegion, date: Date = new Date()): readonly string[] {
  const pool = DAILY_KEYWORD_POOL_BY_REGION[region] ?? [];
  if (pool.length === 0) return [];
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  const dayOfYear = Math.floor(diff / 86_400_000);
  const half = Math.floor(pool.length / 2);
  const offset = (dayOfYear % 2) * half;
  return pool.slice(offset, offset + half);
}

/** Per-page cap. F004-P1 lifted 10 → 50 (`search.list` API maximum)
 *  so each 100u call returns 5× more candidates without changing
 *  the per-call quota. */
export const DAILY_MAX_RESULTS = 50;

/**
 * @deprecated kept as alias for back-compat with snapshot tests; new
 * code reads `pickDailyKeywords(region, today)` for the rotation. The
 * exported map still resolves via the pool so the shape is stable.
 */
export const DAILY_KEYWORDS_BY_REGION: Record<DailyRegion, readonly string[]> = Object.fromEntries(
  (Object.keys(DAILY_KEYWORD_POOL_BY_REGION) as DailyRegion[]).map((r) => [
    r,
    DAILY_KEYWORD_POOL_BY_REGION[r],
  ])
) as Record<DailyRegion, readonly string[]>;

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
  /** BIx-F004-P2: page-rotation cursor store. When supplied, daily
   *  cron pulls page 1 → 2 → 3 over a 6-day cycle (`pickDailyPage`)
   *  instead of always pulling page 1. Wire `prismaKolSyncCursor
   *  Provider(prisma)` from production callers; unit tests use
   *  `inMemoryKolSyncCursorProvider()`. Omit to keep page-1-only
   *  behaviour (one-shot scripts / tests that never rotate). */
  cursorProvider?: KolSyncCursorProvider;
  /** BIx-F004-P2: clock injection for `pickDailyPage`. Defaults to
   *  the real `Date()`; tests pin a value here. */
  now?: () => Date;
  /** BIx-F004-P3: regions to include in the publishedAfter slice
   *  phase (an extra search.list pass that surfaces "newly emerging"
   *  channels). Defaults to `null` → phase disabled. The daily cron
   *  passes `PUBLISHED_AFTER_CORE_REGIONS.slice(0, env count)` so a
   *  quota-tight day can shrink to 4 regions and reclaim 200u. */
  publishedAfterRegions?: readonly string[] | null;
  /** BIx-F004-P5: per-cell observability hook. Fires once per
   *  (region, keyword) iteration with the raw counts the daily log
   *  serializes into `perMatrix`. The phase loop also fires this for
   *  publishedAfter cells so a single log line can attribute
   *  rejections by source. Omit to opt out (no-op). */
  onMatrixCell?: (entry: PerMatrixEntry) => void;
}

export class YouTubeKolSyncAdapter implements KolSyncAdapter {
  readonly name = "youtube";
  readonly source = "youtube-api-daily";

  private readonly client: YoutubeClient | null;
  private readonly regions: readonly string[];
  private readonly keywordsByRegion: Readonly<Record<string, readonly string[]>> | null;
  private readonly maxResults: number;
  private readonly cursorProvider: KolSyncCursorProvider | null;
  private readonly now: () => Date;
  private readonly publishedAfterRegions: readonly string[] | null;
  private readonly onMatrixCell: ((entry: PerMatrixEntry) => void) | null;

  constructor(opts: YouTubeAdapterOpts) {
    this.regions = opts.regions ?? DAILY_REGIONS;
    // BIx-F004-P1: when callers don't override, leave the keyword
    // resolution lazy — `discover()` calls `pickDailyKeywords()` per
    // region for today's rotation. The static `keywordsByRegion`
    // record below is only consulted when an override is supplied
    // (tests / one-shot scripts).
    this.keywordsByRegion = opts.keywordsByRegion ?? null;
    this.maxResults = opts.maxResults ?? DAILY_MAX_RESULTS;
    this.cursorProvider = opts.cursorProvider ?? null;
    this.now = opts.now ?? (() => new Date());
    this.publishedAfterRegions = opts.publishedAfterRegions ?? null;
    this.onMatrixCell = opts.onMatrixCell ?? null;
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
    const minSubscribers = params.minSubscribers ?? getFilterMinSubscribers();
    const today = this.now();
    // BIx-F004-P2: which page (1/2/3) the cron should hit today.
    // Only meaningful when a cursor provider is wired — without one
    // we always call page 1.
    const targetPage = pickDailyPage(today);

    // Dedupe across (region, keyword) so popular channels don't
    // double-bill the channels.list quota when multiple queries hit
    // them on the same day.
    const seenIds = new Set<string>();
    const results: RawKolData[] = [];

    for (const region of regions) {
      // Keyword resolution priority: per-call override → constructor
      // override → today's rotation from the per-region pool.
      const keywords =
        params.keywords && params.keywords.length > 0
          ? params.keywords
          : (this.keywordsByRegion?.[region] ??
            (DAILY_KEYWORD_POOL_BY_REGION[region as DailyRegion]
              ? pickDailyKeywords(region as DailyRegion, today)
              : []));
      for (const keyword of keywords) {
        // BIx-F004-P2: derive pageToken for `targetPage` from the
        // cursor store. Page 1 always uses no token. Page 2/3 use
        // the cursor's `nextPageToken` only when the stored `page`
        // is exactly `targetPage - 1` — otherwise we'd skip a page
        // (e.g. cron missed yesterday). On a mismatch we fall back
        // to page 1 to keep the data path safe; the cursor self-
        // heals on the next 6-day cycle.
        let pageToken: string | undefined;
        let actualPage: number = targetPage;
        if (this.cursorProvider && targetPage > 1) {
          const cursor = await this.cursorProvider.get(region, keyword);
          if (cursor.page === targetPage - 1 && cursor.nextPageToken) {
            pageToken = cursor.nextPageToken;
          } else {
            actualPage = 1;
          }
        }
        // Cast: SyncParams.region is widened to string for portability
        // across adapters; the kol-seed-redo client predates B6 and
        // narrows to its own Region enum. The DAILY_REGIONS used by
        // this adapter are a subset of that enum, so the cast is
        // sound at runtime.
        const search = await client.searchChannels(
          region as KolSeedRegion,
          keyword,
          maxResults,
          pageToken,
          undefined
        );
        // BIx-F004-P2: persist the cursor so tomorrow's run knows
        // which page to advance to. Errors here surface — we'd
        // rather fail loudly than silently regress to page-1-only.
        if (this.cursorProvider) {
          await this.cursorProvider.set(region, keyword, actualPage, search.nextPageToken ?? null);
        }
        const fresh = search.ids.filter((id) => !seenIds.has(id));
        for (const id of fresh) seenIds.add(id);
        let cellAccepted = 0;
        if (fresh.length > 0) {
          const enriched = await client.fetchChannels(fresh);
          for (const raw of enriched) {
            const mapped = mapToRawKolData(raw, {
              matrixRegion: region,
              matrixKeyword: keyword,
              minSubscribers,
            });
            if (mapped) {
              results.push(mapped);
              cellAccepted += 1;
            }
          }
        }
        // BIx-F004-P5: per-cell observability. Reports raw / dedupe /
        // rejection counts so the daily log can attribute zero-yield
        // matrix days to a specific cell instead of the whole adapter.
        this.onMatrixCell?.({
          region,
          keyword,
          page: actualPage,
          found: search.ids.length,
          newAfterDedupe: fresh.length,
          filterRejections: fresh.length - cellAccepted,
        });
      }
    }

    // BIx-F004-P3: publishedAfter slice phase — surfaces "newly
    // emerging" channels the default relevance ranking buries. One
    // extra search.list per region in `publishedAfterRegions`, page 1,
    // first keyword from today's rotation, with a sliding lookback
    // window (90/180/365/730 days, dayOfYear%4). Skipped entirely
    // when no override and per-call `region`/`keywords` aren't set
    // (single-region calls don't want this batch overhead). Deduped
    // against the main matrix via `seenIds`.
    const phaseRegions = this.publishedAfterRegions;
    const isFullMatrixCall = !params.region && !(params.keywords && params.keywords.length > 0);
    if (phaseRegions && phaseRegions.length > 0 && isFullMatrixCall) {
      const days = pickPublishedAfterDays(today);
      const publishedAfter = publishedAfterIso(today, days);
      for (const region of phaseRegions) {
        const rotated = DAILY_KEYWORD_POOL_BY_REGION[region as DailyRegion]
          ? pickDailyKeywords(region as DailyRegion, today)
          : [];
        const keyword = rotated[0];
        if (!keyword) continue;
        const search = await client.searchChannels(
          region as KolSeedRegion,
          keyword,
          maxResults,
          undefined,
          publishedAfter
        );
        const fresh = search.ids.filter((id) => !seenIds.has(id));
        for (const id of fresh) seenIds.add(id);
        let cellAccepted = 0;
        if (fresh.length > 0) {
          const enriched = await client.fetchChannels(fresh);
          for (const raw of enriched) {
            const mapped = mapToRawKolData(raw, {
              matrixRegion: region,
              matrixKeyword: `${keyword}|after=${days}d`,
              minSubscribers,
            });
            if (mapped) {
              results.push(mapped);
              cellAccepted += 1;
            }
          }
        }
        // BIx-F004-P5: report the publishedAfter cell on the same
        // observability channel as the main matrix; the keyword carries
        // the `|after=…d` suffix so consumers can split by phase.
        this.onMatrixCell?.({
          region,
          keyword: `${keyword}|after=${days}d`,
          page: 1,
          found: search.ids.length,
          newAfterDedupe: fresh.length,
          filterRejections: fresh.length - cellAccepted,
        });
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
          minSubscribers: getFilterMinSubscribers(),
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
    thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
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
