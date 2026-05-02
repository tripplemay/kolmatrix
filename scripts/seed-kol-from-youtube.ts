/**
 * MVP-kol-seed-redo F001 · YouTube Data API v3 KOL crawler.
 *
 * Walks an 8-region × 5-keyword matrix, calls `search.list` with
 * `videoCategoryId=20` (Gaming), de-duplicates the resulting channel
 * IDs, then enriches each channel via `channels.list` with
 * `part=snippet,statistics,topicDetails,brandingSettings` so the
 * downstream import (F003) can write every Kol schema field without a
 * second pass.
 *
 * Quota cost (free tier 10,000 units / day):
 *   - search.list  = 100 units / call → 8 × 5 = 40 calls = 4,000 units
 *   - channels.list = 1 unit / call (up to 50 IDs each)
 *                    ~1,000 channels / 50 = ≤ 20 calls = ≤ 20 units
 *   - Total ~ 4,020 units (≈ 40% of daily budget)
 *
 * Usage:
 *   npm run seed:kol-youtube                     (live, writes JSON)
 *   npm run seed:kol-youtube:dry                 (no API calls, prints plan)
 *   npm run seed:kol-youtube -- --region US      (single region)
 *   npm run seed:kol-youtube -- --max-results 25 (cap per query)
 *
 * Output:
 *   docs/kol-seed-youtube-{YYYY-MM-DD}.json — array of EnrichedChannel
 *   plus a summary header with quota + region/keyword breakdown.
 *
 * Env:
 *   YOUTUBE_API_KEY  required for live runs (Google Cloud Console)
 *
 * BL-001 reminder: this script is invoked via `tsx` outside of Next, so
 * `dotenv/config` is imported at the top to populate process.env from
 * the on-disk .env files.
 */
import "dotenv/config";

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { google, youtube_v3 } from "googleapis";

// ---------------------------------------------------------------------
// Matrix config — 8 regions × 5 language-appropriate gaming keywords.
// ---------------------------------------------------------------------

export type Region =
  | "CN"
  | "HK"
  | "TW"
  | "US"
  | "GB"
  | "JP"
  | "KR"
  | "ES"
  // BIx-F004-P1: daily matrix expanded 6→14 regions to lift discovery
  // density (8% → ~91% of daily quota). These ISO-3166-1 alpha-2 codes
  // are accepted directly by YouTube `search.list?regionCode=…`.
  | "DE"
  | "BR"
  | "MX"
  | "TH"
  | "ID"
  | "IN";

export const ALL_REGIONS: readonly Region[] = ["CN", "HK", "TW", "US", "GB", "JP", "KR", "ES"];

// One-shot seed script only walks the original 8 ALL_REGIONS — daily
// cron uses the wider 14-region matrix in `src/lib/kol-sync/adapters/
// youtube.ts`. `Partial<Record<…>>` keeps the type honest so adding
// a new code to `Region` doesn't fail-stop here.
const KEYWORDS_BY_REGION: Partial<Record<Region, readonly string[]>> = {
  CN: ["游戏", "电竞", "手游", "主播", "实况"],
  HK: ["游戏", "电竞", "手游", "主播", "实况"],
  TW: ["游戏", "电竞", "手游", "主播", "实况"],
  US: ["gaming", "gameplay", "esports", "let's play", "streamer"],
  GB: ["gaming", "gameplay", "esports", "let's play", "streamer"],
  JP: ["ゲーム", "実況", "esports", "Vtuber", "プロゲーマー"],
  KR: ["게임", "방송", "esports", "스트리머", "프로게이머"],
  ES: ["juegos", "gaming", "esports", "streamer", "videojuegos"],
};

/**
 * BIx-F004-P1 · `KOL_SYNC_MIN_SUBSCRIBERS` env-var hook.
 *
 * Per spec §F004 and the 2026-05-01 user decision (c), the minimum-
 * subscribers filter is now environment-driven so prod and staging
 * can carry different thresholds without code edits:
 *
 *   - prod      → unset (or `1000`) → matches PRD §10.1 micro-influencer
 *                 floor + `quality.ts` 1K signal.
 *   - staging   → `KOL_SYNC_MIN_SUBSCRIBERS=10000` (kept higher for
 *                 noise reduction; staging data set stays curated).
 *
 * Defaulting to `1000` instead of the legacy `10_000` was an
 * intentional product decision — prior seed runs over-filtered the
 * micro-influencer band PRD asked us to cover.
 */
export function getFilterMinSubscribers(): number {
  const raw = process.env.KOL_SYNC_MIN_SUBSCRIBERS;
  if (!raw) return 1_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1_000;
}
/**
 * @deprecated Use `getFilterMinSubscribers()` so the env-var hook is
 * honoured. Re-exported as a number constant solely so existing
 * snapshot tests / fixtures that imported the symbol keep type-
 * checking; the value is captured at module load and reflects the
 * env at process start. Callers in hot paths (adapter / seeder)
 * already migrated to the function form.
 */
export const FILTER_MIN_SUBSCRIBERS = getFilterMinSubscribers();
export const FILTER_MIN_VIDEOS = 30;

/**
 * Returns true iff at least one Wikipedia topic URL looks like a
 * gaming subject. We bias toward false-positives over false-negatives:
 * if YouTube returns no topicCategories at all (some smaller channels
 * have an empty topicDetails) we trust the search-keyword pre-filter
 * and let it through. Concrete URL examples we match:
 *
 *   https://en.wikipedia.org/wiki/Action_game
 *   https://en.wikipedia.org/wiki/Strategy_video_game
 *   https://en.wikipedia.org/wiki/ESports
 *   https://en.wikipedia.org/wiki/Sports_game
 */
export function isGamingTopic(urls: readonly string[]): boolean {
  if (urls.length === 0) return true;
  return urls.some((u) => /game|esport/i.test(u));
}

// search.list returns at most 50 results per call, regardless of what
// we request — the API simply caps the page. Default to that.
const DEFAULT_MAX_RESULTS_PER_QUERY = 50;

// 2 pages per (region, keyword) typically yields ~25 surviving channels
// after the subs/videos/desc/topic filters. 40 (region,keyword) combos
// × 2 pages = 80 search calls × 100u = 8,000u + ≤80 channels × 1u =
// ≤8,080u, leaving ~2,000u headroom on the 10,000u/day free tier.
const DEFAULT_MAX_PAGES_PER_QUERY = 2;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface EnrichedChannel {
  id: string;
  handle: string | null;
  title: string;
  description: string;
  country: string | null;
  defaultLanguage: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  topicCategories: string[];
  /** Region the matrix sourced this channel from (the search query
   *  region), independent of the channel's self-declared country. */
  matrixRegion: Region;
  /** Keyword the search hit on. Useful for downstream debugging. */
  matrixKeyword: string;
  /** Wall-clock at scrape time. */
  scrapedAt: string;
}

export interface RunPlan {
  regions: readonly Region[];
  maxResultsPerQuery: number;
  totalSearchCalls: number;
  totalSearchQuotaUnits: number;
  /** Worst-case channels.list call count assuming every search result
   *  is a unique channel (i.e. zero overlap). Real number is usually
   *  half of this thanks to dedupe. */
  worstCaseChannelCalls: number;
  worstCaseChannelQuotaUnits: number;
  totalQuotaUnitsWorstCase: number;
}

export interface CliArgs {
  dryRun: boolean;
  region?: Region;
  maxResultsPerQuery: number;
  maxPagesPerQuery: number;
}

// ---------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    maxResultsPerQuery: DEFAULT_MAX_RESULTS_PER_QUERY,
    maxPagesPerQuery: DEFAULT_MAX_PAGES_PER_QUERY,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--region") {
      const v = argv[++i] ?? "";
      if (!isRegion(v)) {
        throw new Error(`--region must be one of ${ALL_REGIONS.join("|")}, got "${v}"`);
      }
      args.region = v;
    } else if (a === "--max-results") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        throw new Error(`--max-results must be 1..50, got "${argv[i]}"`);
      }
      args.maxResultsPerQuery = n;
    } else if (a === "--max-pages") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        throw new Error(`--max-pages must be 1..5, got "${argv[i]}"`);
      }
      args.maxPagesPerQuery = n;
    }
  }
  return args;
}

function isRegion(v: string): v is Region {
  return (ALL_REGIONS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------
// Plan / quota math (pure, fully unit-tested)
// ---------------------------------------------------------------------

export function buildRunPlan(args: CliArgs): RunPlan {
  const regions = args.region ? [args.region] : ALL_REGIONS;
  const totalQueries = regions.reduce((sum, r) => sum + (KEYWORDS_BY_REGION[r]?.length ?? 0), 0);
  const totalSearchCalls = totalQueries * args.maxPagesPerQuery;
  const totalSearchQuotaUnits = totalSearchCalls * 100;
  const worstCaseChannels = totalSearchCalls * args.maxResultsPerQuery;
  const worstCaseChannelCalls = Math.ceil(worstCaseChannels / 50);
  const worstCaseChannelQuotaUnits = worstCaseChannelCalls;
  return {
    regions,
    maxResultsPerQuery: args.maxResultsPerQuery,
    totalSearchCalls,
    totalSearchQuotaUnits,
    worstCaseChannelCalls,
    worstCaseChannelQuotaUnits,
    totalQuotaUnitsWorstCase: totalSearchQuotaUnits + worstCaseChannelQuotaUnits,
  };
}

// ---------------------------------------------------------------------
// Field mapping — pure transform from googleapis Channel to our shape.
// Lifted into its own function so unit tests can assert end-to-end
// without touching the network.
// ---------------------------------------------------------------------

export function mapChannel(
  raw: youtube_v3.Schema$Channel,
  matrixRegion: Region,
  matrixKeyword: string,
  now: () => string = () => new Date().toISOString()
): EnrichedChannel | null {
  const id = raw.id ?? null;
  const snippet = raw.snippet ?? {};
  const stats = raw.statistics ?? {};
  const topic = raw.topicDetails ?? {};
  const branding = raw.brandingSettings ?? {};
  const subscriberCount = parseIntSafe(stats.subscriberCount);
  const videoCount = parseIntSafe(stats.videoCount);
  const viewCount = parseIntSafe(stats.viewCount);

  if (!id) return null;
  if (subscriberCount < getFilterMinSubscribers()) return null;
  if (videoCount < FILTER_MIN_VIDEOS) return null;
  const description = (snippet.description ?? "").trim();
  if (description.length === 0) return null;
  const topicCategories = topic.topicCategories ?? [];
  if (!isGamingTopic(topicCategories)) return null;

  return {
    id,
    handle: snippet.customUrl ?? null,
    title: snippet.title ?? "",
    description,
    country: snippet.country ?? null,
    defaultLanguage: snippet.defaultLanguage ?? null,
    publishedAt: snippet.publishedAt ?? null,
    thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
    bannerUrl: branding.image?.bannerExternalUrl ?? null,
    subscriberCount,
    videoCount,
    viewCount,
    topicCategories,
    matrixRegion,
    matrixKeyword,
    scrapedAt: now(),
  };
}

function parseIntSafe(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------
// Retry — moved to src/lib/kol-sync/retry.ts in B6-F004 so the same
// 30s/2min/5min schedule covers the kol-seed-redo + B6 daily paths
// without two implementations drifting. Re-exported here so existing
// callers (and the unit fixtures in tests/unit/seed-kol-from-youtube.test.ts)
// keep importing from the same surface.
// ---------------------------------------------------------------------

import { withRetry, type RetryOpts } from "../src/lib/kol-sync/retry";

export { withRetry, type RetryOpts };

// ---------------------------------------------------------------------
// YouTube client
// ---------------------------------------------------------------------

export interface SearchPage {
  ids: string[];
  nextPageToken: string | null;
}

export interface YoutubeClient {
  searchChannels(
    region: Region,
    keyword: string,
    maxResults: number,
    pageToken?: string
  ): Promise<SearchPage>;
  fetchChannels(ids: string[]): Promise<youtube_v3.Schema$Channel[]>;
}

export function createYoutubeClient(apiKey: string): YoutubeClient {
  const yt = google.youtube({ version: "v3", auth: apiKey });
  return {
    async searchChannels(region, keyword, maxResults, pageToken) {
      // NOTE: `videoCategoryId` is only honoured by search.list when
      // type=video; combining it with type=channel returns
      // 400 "Request contains an invalid argument". We instead lean on
      // (a) keyword (gaming/电竞/ゲーム/etc.) and (b) the post-search
      // topicCategories filter inside mapChannel().
      const res = await yt.search.list({
        part: ["snippet"],
        q: keyword,
        regionCode: region,
        type: ["channel"],
        maxResults,
        ...(pageToken ? { pageToken } : {}),
      });
      const items = res.data.items ?? [];
      const ids = items
        .map((it) => it.snippet?.channelId ?? it.id?.channelId ?? null)
        .filter((id): id is string => Boolean(id));
      return {
        ids: Array.from(new Set(ids)),
        nextPageToken: res.data.nextPageToken ?? null,
      };
    },
    async fetchChannels(ids) {
      if (ids.length === 0) return [];
      const res = await yt.channels.list({
        part: ["snippet", "statistics", "topicDetails", "brandingSettings"],
        id: ids,
        maxResults: 50,
      });
      return res.data.items ?? [];
    },
  };
}

// ---------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------

export interface RunReport {
  plan: RunPlan;
  channels: EnrichedChannel[];
  searchCallsExecuted: number;
  channelCallsExecuted: number;
  uniqueChannelsSeen: number;
  channelsAcceptedByFilters: number;
  perRegion: Partial<Record<Region, number>>;
  startedAt: string;
  endedAt: string;
}

export interface RunOpts {
  client: YoutubeClient;
  /** Receive each enriched channel as it arrives — useful for tests
   *  and progress reporters. */
  onChannel?: (c: EnrichedChannel) => void;
  /** Receive every API call event so the runner can report quota. */
  onApiCall?: (kind: "search" | "channels", quotaUsed: number) => void;
  retry?: RetryOpts;
}

export async function runCrawl(args: CliArgs, opts: RunOpts): Promise<RunReport> {
  const plan = buildRunPlan(args);
  const startedAt = new Date().toISOString();
  const seenChannelIds = new Set<string>();
  const collectedChannels: EnrichedChannel[] = [];
  const perRegion: Partial<Record<Region, number>> = {
    CN: 0,
    HK: 0,
    TW: 0,
    US: 0,
    GB: 0,
    JP: 0,
    KR: 0,
    ES: 0,
  };
  let searchCallsExecuted = 0;
  let channelCallsExecuted = 0;
  let acceptedByFilters = 0;

  for (const region of plan.regions) {
    const keywords = KEYWORDS_BY_REGION[region] ?? [];
    for (const keyword of keywords) {
      let pageToken: string | undefined = undefined;
      for (let page = 0; page < args.maxPagesPerQuery; page += 1) {
        const search: SearchPage = await withRetry(
          () => opts.client.searchChannels(region, keyword, args.maxResultsPerQuery, pageToken),
          opts.retry
        );
        searchCallsExecuted += 1;
        opts.onApiCall?.("search", 100);

        const newIds = search.ids.filter((id) => !seenChannelIds.has(id));
        for (const id of newIds) seenChannelIds.add(id);

        // channels.list takes up to 50 IDs/call.
        for (let i = 0; i < newIds.length; i += 50) {
          const slice = newIds.slice(i, i + 50);
          const raw = await withRetry(() => opts.client.fetchChannels(slice), opts.retry);
          channelCallsExecuted += 1;
          opts.onApiCall?.("channels", 1);
          for (const r of raw) {
            const mapped = mapChannel(r, region, keyword);
            if (!mapped) continue;
            acceptedByFilters += 1;
            perRegion[region] = (perRegion[region] ?? 0) + 1;
            collectedChannels.push(mapped);
            opts.onChannel?.(mapped);
          }
        }

        if (!search.nextPageToken) break;
        pageToken = search.nextPageToken;
      }
    }
  }

  return {
    plan,
    channels: collectedChannels,
    searchCallsExecuted,
    channelCallsExecuted,
    uniqueChannelsSeen: seenChannelIds.size,
    channelsAcceptedByFilters: acceptedByFilters,
    perRegion,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------
// Output writer
// ---------------------------------------------------------------------

export function todayUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

export function outputPath(date: string = todayUtc()): string {
  return resolve(__dirname, "..", `docs/kol-seed-youtube-${date}.json`);
}

export function formatOutputJson(report: RunReport): string {
  return (
    JSON.stringify(
      {
        version: 1,
        generatedAt: report.endedAt,
        sourceMatrix: {
          regions: report.plan.regions,
          maxResultsPerQuery: report.plan.maxResultsPerQuery,
          totalSearchCalls: report.plan.totalSearchCalls,
        },
        quota: {
          searchCallsExecuted: report.searchCallsExecuted,
          channelCallsExecuted: report.channelCallsExecuted,
          totalQuotaUnitsConsumed: report.searchCallsExecuted * 100 + report.channelCallsExecuted,
        },
        counts: {
          uniqueChannelsSeen: report.uniqueChannelsSeen,
          channelsAcceptedByFilters: report.channelsAcceptedByFilters,
          perRegion: report.perRegion,
        },
        channels: report.channels,
      },
      null,
      2
    ) + "\n"
  );
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const plan = buildRunPlan(args);
  console.log(
    `[seed-kol-youtube] regions=${plan.regions.join(",")} maxPages=${args.maxPagesPerQuery} maxResults=${args.maxResultsPerQuery}`
  );
  console.log(
    `[seed-kol-youtube] plan: search=${plan.totalSearchCalls} calls × 100u = ${plan.totalSearchQuotaUnits}u, channels (worst case)=${plan.worstCaseChannelCalls} calls × 1u = ${plan.worstCaseChannelQuotaUnits}u, total worst-case ${plan.totalQuotaUnitsWorstCase}u (free tier 10,000u/day)`
  );
  console.log(
    `[seed-kol-youtube] filters: subscriberCount ≥ ${getFilterMinSubscribers().toLocaleString()}, videoCount ≥ ${FILTER_MIN_VIDEOS}, description non-empty`
  );

  if (args.dryRun) {
    console.log(`[seed-kol-youtube] DRY-RUN — no API calls, no writes.`);
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Add it to .env (local), .env.staging, or .env.production. " +
        "Register a key at https://console.cloud.google.com/apis (enable YouTube Data API v3)."
    );
  }

  const client = createYoutubeClient(apiKey);
  let runningQuota = 0;
  const regionsAnnounced = new Set<Region>();
  const report = await runCrawl(args, {
    client,
    onApiCall: (kind, units) => {
      runningQuota += units;
      // Print every 10 search calls (1,000u steps) and every 50 channel
      // calls (50u steps) to keep the log readable on long runs.
      if (
        (kind === "search" && runningQuota % 1_000 < 100) ||
        (kind === "channels" && runningQuota % 50 < 1)
      ) {
        console.log(
          `[seed-kol-youtube] ${kind} call. running quota=${runningQuota}u (~${Math.round((runningQuota / 10_000) * 100)}% of daily budget)`
        );
      }
    },
    onChannel: (c) => {
      // Stay quiet on the per-channel hose — only show one line/region.
      if (!regionsAnnounced.has(c.matrixRegion)) {
        regionsAnnounced.add(c.matrixRegion);
        console.log(
          `[seed-kol-youtube] first ${c.matrixRegion} hit: ${c.title} (${c.subscriberCount.toLocaleString()} subs)`
        );
      }
    },
    retry: {
      onRetry: (attempt, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[seed-kol-youtube] retry #${attempt} after error: ${msg.slice(0, 200)}`);
      },
    },
  });

  const path = outputPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatOutputJson(report), "utf8");

  console.log(
    `\n[seed-kol-youtube] DONE — ${report.channelsAcceptedByFilters} channels written to ${path}`
  );
  console.log(
    `[seed-kol-youtube] quota consumed: search ${report.searchCallsExecuted} calls × 100u + channels ${report.channelCallsExecuted} calls × 1u = ${
      report.searchCallsExecuted * 100 + report.channelCallsExecuted
    }u`
  );
  console.log(`[seed-kol-youtube] per-region:`, report.perRegion);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[seed-kol-youtube] fatal: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
