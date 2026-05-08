/**
 * BL-012-F007 / F008 · apify-kol-service KolSyncAdapter.
 *
 * Stage 2 entry point for the fork (`apify-kol-service` deployed on the
 * same VM, port 3003) into the KOLMatrix daily sync pipeline. The
 * adapter is a 1:1 implementation of the `KolSyncAdapter` trait
 * (`src/lib/kol-sync/types.ts`) — discover walks `GET /kol` paginated;
 * refresh re-fetches single profiles via `GET /kol/:platform/:userId`;
 * healthCheck probes `GET /health`. Pure HTTP — no Prisma writes here
 * (the import.ts layer projects RawKolData onto the Kol model).
 *
 * Error classification (consumed by `dispatcher.runDailySync` →
 * `withRetry` from `../retry.ts`):
 *   - 401 / 403 → AdapterAuthError (terminal, no retry)
 *   - 429       → AdapterRateLimitError (Retry-After respected)
 *   - 5xx       → AdapterTransientError (default retry)
 *   - timeout / network → AdapterTransientError
 *   - zod parse → AdapterTransientError (treat as upstream contract
 *                  drift; surfaces in errors[] but doesn't take down
 *                  the daily run; the YouTube source still runs)
 *
 * v0.9.19 sediment: zod schema lives in `../../apify-kol/schemas.ts`
 * shared with the Stage 1.5 admin preview path. Real fork samples from
 * F002 fix-round 2 (mixed string / {url,title} `externalUrls`, record
 * vs array `aggregatorLinks`) are pinned by tests in both consumers.
 *
 * Data-flow note: this adapter sits OUTSIDE the Stage 1.5 isolation
 * boundary on purpose — it's the bridge that promotes apify-kol data
 * into the main KOL pipeline. The Stage 1.5 admin preview client
 * (`src/lib/admin/apify-preview-client.ts`) still does NOT import from
 * `kol-sync/*`; that boundary is asymmetric (admin → adapter ✗,
 * adapter → admin shared schemas ✓).
 */
import { ApifyKolItemSchema, ApifyKolPageSchema } from "../../apify-kol/schemas";
import type {
  HealthCheckResult,
  KolSyncAdapter,
  RawKolData,
  SyncParams,
} from "../types";

import type { ApifyKolItem } from "../../apify-kol/schemas";

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

/** Auth failure — bad / missing / revoked `x-api-key`. Terminal: the
 *  retry wrapper should NOT retry these; ops fix is to re-issue a key. */
export class AdapterAuthError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdapterAuthError";
    this.status = status;
  }
}

/** HTTP 429 from the upstream. Carries the `Retry-After` value (seconds)
 *  when the server provided one; otherwise undefined and callers fall
 *  back to the default backoff schedule. */
export class AdapterRateLimitError extends Error {
  readonly status: number = 429;
  readonly retryAfterSeconds: number | undefined;
  constructor(message: string, retryAfterSeconds: number | undefined) {
    super(message);
    this.name = "AdapterRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 5xx, timeout, network drop, or parse drift. Safe to retry under the
 *  default 30s/2min/5min schedule (`../retry.ts`). */
export class AdapterTransientError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdapterTransientError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PAGE_SIZE = 100;
/** Cap per `discover()` invocation. Keeps a runaway fork (e.g. a TikHub
 *  storm dumping 50k rows in a day) from monopolising the daily run.
 *  Tunable via constructor opts; the daily script defaults to 5,000. */
const DEFAULT_MAX_ITEMS_PER_RUN = 5_000;

export interface ApifyKolAdapterConfig {
  /** Service base URL — same-VM internal `http://localhost:3003`
   *  on prod / staging; tests pass a fake URL like `http://apify.test:3003`. */
  baseUrl: string;
  /** Business read API key (`x-api-key` header). Loaded from
   *  `APIFY_KOL_BUSINESS_API_KEY` in the daily-script entrypoint. */
  apiKey: string;
  /** Soft client-side throttle. Currently advisory — the upstream
   *  service has its own rate limiter. Default: 5 req/s. */
  maxRequestsPerSecond?: number;
  /** Discover-side cap (per call). Default 5,000. */
  maxItemsPerRun?: number;
  /** Page size requested from upstream (max 100 per fork contract).
   *  Default 100 to minimise the round-trip count. */
  pageSize?: number;
  /** Inject a fake fetch in tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout. Default 30s. */
  timeoutMs?: number;
}

interface ParsedRefreshId {
  platform: string;
  userId: string;
}

/** externalId convention: `<platform>:<platformUserId>`. The dispatcher
 *  hands these back to refresh() exactly as discover() emitted them. */
function parseRefreshId(externalId: string): ParsedRefreshId | null {
  const idx = externalId.indexOf(":");
  if (idx <= 0 || idx === externalId.length - 1) return null;
  return {
    platform: externalId.slice(0, idx),
    userId: externalId.slice(idx + 1),
  };
}

export class ApifyKolSyncAdapter implements KolSyncAdapter {
  readonly name = "apify-kol";
  readonly source = "apify-kol";

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxItemsPerRun: number;
  private readonly pageSize: number;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ApifyKolAdapterConfig) {
    if (!opts.baseUrl) {
      throw new Error("ApifyKolSyncAdapter: baseUrl is required");
    }
    if (!opts.apiKey) {
      throw new Error("ApifyKolSyncAdapter: apiKey is required");
    }
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.maxItemsPerRun = opts.maxItemsPerRun ?? DEFAULT_MAX_ITEMS_PER_RUN;
    this.pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async discover(params: SyncParams): Promise<RawKolData[]> {
    const collected: RawKolData[] = [];
    let page = 1;
    // SyncParams.region carries the upstream platform filter for this
    // adapter (apify-kol shards by platform, not country region). The
    // daily script's per-adapter params override is the supported way
    // to scope a run to a single platform; omit for cross-platform.
    const platform = params.region;

    while (collected.length < this.maxItemsPerRun) {
      const search = new URLSearchParams();
      if (platform) search.set("platform", platform);
      search.set("page", String(page));
      search.set("pageSize", String(this.pageSize));
      search.set("sort", "recent");

      const url = `${this.baseUrl}/kol?${search.toString()}`;
      const raw = await this.fetchJson(url);
      const parsed = ApifyKolPageSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AdapterTransientError(
          `apify-kol: response failed schema validation: ${parsed.error.message}`
        );
      }

      const rows = parsed.data.data;
      const remaining = this.maxItemsPerRun - collected.length;
      const slice = rows.slice(0, remaining);
      for (const item of slice) {
        const mapped = mapApifyKolItemToRawKolData(item);
        if (mapped) collected.push(mapped);
      }

      // End conditions: short page (last page) or upstream-imposed cap.
      if (rows.length < this.pageSize) break;
      page += 1;
    }

    return collected;
  }

  async refresh(externalIds: readonly string[]): Promise<RawKolData[]> {
    if (externalIds.length === 0) return [];
    const out: RawKolData[] = [];
    for (const externalId of externalIds) {
      const ref = parseRefreshId(externalId);
      if (!ref) continue;
      const url = `${this.baseUrl}/kol/${encodeURIComponent(ref.platform)}/${encodeURIComponent(ref.userId)}`;
      let raw: unknown;
      try {
        raw = await this.fetchJson(url);
      } catch (err) {
        // 404 → row was deleted upstream; skip and let other ids in the
        // batch continue. We surface a 404 by tagging it on the
        // transient error and short-circuiting before the throw.
        if (err instanceof AdapterTransientError && err.status === 404) {
          continue;
        }
        throw err;
      }
      const parsed = ApifyKolItemSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AdapterTransientError(
          `apify-kol refresh: schema mismatch for ${externalId}: ${parsed.error.message}`
        );
      }
      const mapped = mapApifyKolItemToRawKolData(parsed.data);
      if (mapped) out.push(mapped);
    }
    return out;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const url = `${this.baseUrl}/health`;
    try {
      const body = await this.fetchJson(url, { skipAuth: true });
      const status =
        typeof body === "object" && body !== null && "status" in body
          ? (body as { status?: unknown }).status
          : null;
      return {
        healthy: status === "ok",
        details: { upstream: "apify-kol-service", status: typeof status === "string" ? status : null },
      };
    } catch (err) {
      return {
        healthy: false,
        details: {
          upstream: "apify-kol-service",
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  // -------------------------------------------------------------------
  // HTTP helper — single source of error classification.
  // -------------------------------------------------------------------

  private async fetchJson(
    url: string,
    opts: { skipAuth?: boolean } = {}
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (!opts.skipAuth) headers["x-api-key"] = this.apiKey;
      response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AdapterTransientError(
          `apify-kol: request timed out after ${this.timeoutMs}ms`
        );
      }
      throw new AdapterTransientError(
        `apify-kol: network error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AdapterAuthError(
        `apify-kol: auth rejected (HTTP ${response.status})`,
        response.status
      );
    }
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      throw new AdapterRateLimitError(
        `apify-kol: rate-limited (HTTP 429)${retryAfter !== undefined ? ` retry-after=${retryAfter}s` : ""}`,
        retryAfter
      );
    }
    if (response.status === 404) {
      throw new AdapterTransientError(
        `apify-kol: not found (HTTP 404)`,
        404
      );
    }
    if (response.status >= 500) {
      throw new AdapterTransientError(
        `apify-kol: upstream error (HTTP ${response.status})`,
        response.status
      );
    }
    if (!response.ok) {
      throw new AdapterTransientError(
        `apify-kol: unexpected HTTP ${response.status}`,
        response.status
      );
    }

    try {
      return await response.json();
    } catch (err) {
      throw new AdapterTransientError(
        `apify-kol: response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  if (Number.isFinite(n) && n >= 0) return n;
  // RFC 7231 also allows an HTTP-date — best-effort parse.
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  return undefined;
}

// ---------------------------------------------------------------------
// Field mapping — fork camelCase → KOLMatrix RawKolData (BL-012-F008)
// ---------------------------------------------------------------------

/**
 * Project a single `ApifyKolItem` onto the platform-agnostic
 * `RawKolData` shape consumed by `import.ts`. Pure / fully unit-tested.
 *
 * Mapping rules (spec v1 §2.2 + v4 carry-forward):
 *   - externalId   = item.id (string-ified — fork emits number for some
 *                    legacy rows)
 *   - platform     = item.platform (verbatim — fork already emits
 *                    canonical lowercase)
 *   - handle       = item.username
 *   - displayName  = item.displayName ?? item.username (always non-empty
 *                    so downstream UI doesn't render a blank row)
 *   - description  = item.bio ?? undefined
 *   - thumbnailUrl = item.avatarUrl
 *   - subscriberCount = item.followers ?? 0 (some TT rows ship null
 *                    when followers can't be scraped; treat as 0 so the
 *                    row still upserts and quality.ts can spam-skip)
 *   - topicCategories = item.matchedTags ?? []
 *   - country / language / lastUploadAt / brandSafetyRating = null
 *     (fork doesn't expose these; reserved for future enrichment)
 *   - raw = the fork item verbatim (preserves all 4 dimension scores +
 *           tier + emails + phones + aggregator data + handles for the
 *           B5 enrichment pipeline)
 *
 * Returns null when the item is unusable (missing id / username) so
 * the caller can drop it without throwing.
 */
export function mapApifyKolItemToRawKolData(
  item: ApifyKolItem,
  now: () => string = () => new Date().toISOString()
): RawKolData | null {
  if (item.id == null || item.id === "") return null;
  if (!item.username) return null;

  const externalId = String(item.id);
  const handle = item.username;
  const displayName =
    typeof item.displayName === "string" && item.displayName.length > 0
      ? item.displayName
      : item.username;

  const description =
    typeof item.bio === "string" && item.bio.length > 0 ? item.bio : undefined;

  const thumbnailUrl =
    typeof item.avatarUrl === "string" && item.avatarUrl.length > 0
      ? item.avatarUrl
      : null;

  const subscriberCount =
    typeof item.followers === "number" && Number.isFinite(item.followers)
      ? item.followers
      : 0;

  const topicCategories = Array.isArray(item.matchedTags)
    ? item.matchedTags.filter((t): t is string => typeof t === "string")
    : [];

  return {
    externalId,
    platform: item.platform,
    handle,
    displayName,
    description,
    country: null,
    language: null,
    thumbnailUrl,
    bannerUrl: null,
    subscriberCount,
    topicCategories,
    publishedAt: null,
    lastUploadAt: null,
    brandSafetyRating: null,
    raw: { ...(item as Record<string, unknown>) },
    scrapedAt: now(),
  };
}
