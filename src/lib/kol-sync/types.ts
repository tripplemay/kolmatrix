/**
 * B6-kol-daily-sync F001 · Sync Worker public types.
 *
 * Every data source the daily cron pulls from (today: YouTube; June+:
 * the BL-012 crawler team's API; later: TikTok / Bilibili) implements
 * the same `KolSyncAdapter` interface. The dispatcher only knows about
 * this interface, so swapping a source in/out is a 1-file change.
 *
 * The shape of `RawKolData` is the union of fields any platform might
 * surface. The downstream import path is responsible for projecting
 * this onto the Prisma `Kol` model — adapters do NOT touch Prisma.
 */

/**
 * Platform-agnostic representation of a single channel/profile, as it
 * comes back from a sync adapter. Optional fields stay undefined when
 * the source doesn't expose them; the import path treats undefined
 * and null the same.
 */
export interface RawKolData {
  /** Permanent platform-side identifier (e.g. YouTube `channel.id`). */
  externalId: string;
  /** 'youtube' | 'tiktok' | 'bilibili' | 'crawler-team' | etc. */
  platform: string;
  /** @handle when the platform exposes one. */
  handle: string | null;
  displayName: string;
  description?: string;
  country?: string | null;
  language?: string | null;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  subscriberCount: number;
  videoCount?: number;
  viewCount?: number;
  /** Wikipedia topic URLs or platform-native category labels. */
  topicCategories?: string[];
  publishedAt?: string | null;
  /** ISO timestamp of the latest published video. Surfaces from
   *  adapters that walk the uploads playlist (e.g. crawler-team API).
   *  YouTube channels.list doesn't expose this directly; F005's
   *  zombie-skip rule short-circuits when undefined. */
  lastUploadAt?: string | null;
  /** Coarse safety classification from the upstream — F005's
   *  NSFW-skip rule normalises to lowercase and matches against
   *  ["questionable", "unsafe", "nsfw"]. */
  brandSafetyRating?: string | null;
  /** Source-specific raw payload, preserved verbatim so B5-enrichment
   *  can promote nested fields into proper columns later without a
   *  re-fetch. */
  raw?: Record<string, unknown>;
  /** BL-059 F001 — engagement proxy derived by the adapter. apify-kol
   *  computes `(totalLikes / postsCount) / followers * 100` from the
   *  fork's accumulated counters; YouTube's BL-023 path used a true
   *  per-video rate but is being deprecated. Adapters that don't
   *  expose engagement leave this undefined and `engagement_rate`
   *  stays NULL on the Kol row. */
  engagement_rate?: number | null;
  /** Wall-clock at scrape time — used for `last_synced_at` and to
   *  distinguish stale rows. */
  scrapedAt: string;
}

/**
 * Inputs to `discover()`. Any field absent leaves the choice to the
 * adapter (e.g. YouTube falls back to its 8-region × 5-keyword matrix).
 */
export interface SyncParams {
  region?: string;
  keywords?: readonly string[];
  minSubscribers?: number;
  /** Cap per (region, keyword) page; clamped per-platform. */
  maxResults?: number;
}

/**
 * Adapter contract. Implementations are stateless and side-effect free
 * apart from the network call they own — DB writes happen downstream.
 */
export interface KolSyncAdapter {
  /** Stable short id, used as the dispatcher map key. */
  readonly name: string;
  /** Goes into `metadata.source` on the Kol row. */
  readonly source: string;

  /** Find new KOLs (delta crawl). */
  discover(params: SyncParams): Promise<RawKolData[]>;

  /** Re-fetch existing KOLs by externalId so subscribers / view counts
   *  stay current. The dispatcher decides which IDs to refresh on a
   *  given day. */
  refresh(externalIds: readonly string[]): Promise<RawKolData[]>;

  /** Cheap "is the upstream reachable + key valid + quota left" probe.
   *  Surfaces in /api/health and the daily structured log. */
  healthCheck(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  healthy: boolean;
  /** Free-form per-adapter context (quotaLeft, lastError, etc.). */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Dispatcher I/O — kept here because both the dispatcher AND the
// downstream daily script consume these shapes.
// ---------------------------------------------------------------------

export interface DailySyncOpts {
  /** Per-adapter overrides keyed by `adapter.name`. Adapters not in
   *  the map run with `{}` (their own defaults). */
  perAdapterParams?: Readonly<Record<string, SyncParams>>;
  /** When true the dispatch stops on the first failing adapter; when
   *  false the rest still run. Default: false. */
  failFast?: boolean;
  /** When set each adapter call is wrapped in withRetry — F004's
   *  30s/2min/5min backoff schedule. Omit to skip retries entirely
   *  (useful in tests). */
  retry?: import("./retry").RetryOpts;
}

export interface RefreshOpts {
  /** Per-adapter `externalIds` to refresh. Empty / missing arrays are
   *  no-ops for that adapter. */
  perAdapterIds: Readonly<Record<string, readonly string[]>>;
  failFast?: boolean;
  retry?: import("./retry").RetryOpts;
}

export type AdapterOutcome<T> =
  | { adapter: string; ok: true; data: T }
  | { adapter: string; ok: false; error: string };

export interface SyncReport {
  startedAt: string;
  endedAt: string;
  outcomes: AdapterOutcome<RawKolData[]>[];
  totals: {
    discoverCount: number;
    failedAdapters: number;
  };
}

export interface RefreshReport {
  startedAt: string;
  endedAt: string;
  outcomes: AdapterOutcome<RawKolData[]>[];
  totals: {
    refreshCount: number;
    failedAdapters: number;
  };
}
