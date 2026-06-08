/**
 * BL-096-F002 · Crawler monitor fetch client (server-only).
 *
 * Thin-client fetcher for the apify-kol-service `/admin/stats` observability
 * endpoint (extended in BL-096-F001). ADR-017: the crawler owns the data;
 * KOLMatrix only calls this API and renders. Used by
 * `/[locale]/admin/crawler-monitor`.
 *
 * Auth: `/admin/stats` is platform-admin gated and authenticated with the fork's
 * ADMIN key via the `x-api-key` header (≠ the business read key used by
 * apify-preview-client). Requires env `APIFY_KOL_ADMIN_API_KEY`.
 *
 * Graceful degradation: the response schema makes the BL-096-F001 observability
 * fields optional, so the page still renders against an OLD /admin/stats (before
 * the F001 fork-sync) — missing sections just show empty/zero instead of erroring.
 */
import { z } from "zod";

const FETCH_TIMEOUT_MS = 15_000;

export const CrawlerStatsSchema = z.object({
  // BL-086-F004 existing
  tikhubBalanceUsd: z.number().nullable().default(null),
  tikhubFreeCreditUsd: z.number().nullable().default(null),
  apifyCostThisMonthUsd: z.number().default(0),
  // BL-096-F001 observability (optional → graceful degrade on old /admin/stats)
  observedAt: z.string().optional(),
  drain: z
    .object({
      scrapeQueueByState: z.array(z.object({ state: z.string(), count: z.number() })).default([]),
      manualSeedByStatus: z.array(z.object({ status: z.string(), count: z.number() })).default([]),
      manualSeedInsertedToday: z.number().default(0),
    })
    .default({ scrapeQueueByState: [], manualSeedByStatus: [], manualSeedInsertedToday: 0 }),
  ingestRateByDay: z.array(z.object({ day: z.string(), count: z.number() })).default([]),
  scrapeCompositionToday: z
    .array(
      z.object({
        kind: z.string(),
        jobs: z.number(),
        scraped: z.number(),
        inserted: z.number(),
        costUsd: z.number(),
      }),
    )
    .default([]),
  ytEmailByStatus: z.array(z.object({ status: z.string(), count: z.number() })).default([]),
  igToday: z.object({ scraped: z.number(), inserted: z.number() }).default({ scraped: 0, inserted: 0 }),
  refreshBacklog: z.object({ total: z.number(), dueNow: z.number() }).default({ total: 0, dueNow: 0 }),
  costTodayUsd: z.number().default(0),
});

export type CrawlerStats = z.infer<typeof CrawlerStatsSchema>;

export type CrawlerMonitorErrorKind =
  | "config"
  | "unauthorized"
  | "rate_limit"
  | "transient"
  | "timeout"
  | "parse";

export class CrawlerMonitorError extends Error {
  readonly kind: CrawlerMonitorErrorKind;
  readonly status?: number;
  constructor(kind: CrawlerMonitorErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CrawlerMonitorError";
    this.kind = kind;
    this.status = status;
  }
}

interface FetchDeps {
  fetch?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export async function fetchCrawlerStats(deps: FetchDeps = {}): Promise<CrawlerStats> {
  const baseUrl = deps.baseUrl ?? process.env.APIFY_KOL_BASE_URL;
  const apiKey = deps.apiKey ?? process.env.APIFY_KOL_ADMIN_API_KEY;
  if (!baseUrl) throw new CrawlerMonitorError("config", "APIFY_KOL_BASE_URL is not set");
  if (!apiKey) throw new CrawlerMonitorError("config", "APIFY_KOL_ADMIN_API_KEY is not set");

  const url = `${baseUrl.replace(/\/$/, "")}/admin/stats`;
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { "x-api-key": apiKey, accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CrawlerMonitorError("timeout", `/admin/stats timed out after ${timeoutMs}ms`);
    }
    throw new CrawlerMonitorError(
      "transient",
      `/admin/stats fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new CrawlerMonitorError(
      "unauthorized",
      `/admin/stats auth rejected (HTTP ${response.status}) — check APIFY_KOL_ADMIN_API_KEY`,
      response.status,
    );
  }
  if (response.status === 429) {
    throw new CrawlerMonitorError("rate_limit", "/admin/stats rate-limited (HTTP 429)", response.status);
  }
  if (!response.ok) {
    throw new CrawlerMonitorError(
      "transient",
      `/admin/stats responded HTTP ${response.status}`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new CrawlerMonitorError(
      "parse",
      `/admin/stats was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parsed = CrawlerStatsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CrawlerMonitorError("parse", `/admin/stats failed schema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

export type HealthStatus = "ok" | "warn" | "critical";
export interface HealthLight {
  id: "balance" | "ingest" | "instagram";
  status: HealthStatus;
}

/** Low-balance thresholds (USD). Below critical → red; below warn → yellow. */
export const BALANCE_CRITICAL_USD = 20;
export const BALANCE_WARN_USD = 50;

/**
 * BL-096-F002 · Visualise the two silent-failure modes that previously needed a
 * human to notice: balance drained (→ insufficient-balance stall) and ingest=0
 * (the 6/04 + 5/14 dry spells). IG 0-produce is a known BL-095 watch (warn only).
 */
export function computeHealthLights(stats: CrawlerStats): HealthLight[] {
  const lights: HealthLight[] = [];

  // Balance
  const bal = stats.tikhubBalanceUsd;
  lights.push({
    id: "balance",
    status: bal == null ? "warn" : bal < BALANCE_CRITICAL_USD ? "critical" : bal < BALANCE_WARN_USD ? "warn" : "ok",
  });

  // Ingest today (sum of inserted across kinds). 0 with jobs running = silent stall.
  const insertedToday = stats.scrapeCompositionToday.reduce((s, c) => s + c.inserted, 0);
  const jobsToday = stats.scrapeCompositionToday.reduce((s, c) => s + c.jobs, 0);
  lights.push({
    id: "ingest",
    status: jobsToday > 0 && insertedToday === 0 ? "critical" : "ok",
  });

  // Instagram produce today (BL-095 known 0-produce). Warn, not critical.
  const igRanScrapes = stats.scrapeCompositionToday.some(
    (c) => c.kind === "hashtag" || c.kind === "manual_seed",
  );
  lights.push({
    id: "instagram",
    status: igRanScrapes && stats.igToday.inserted === 0 ? "warn" : "ok",
  });

  return lights;
}
