/**
 * B6-kol-daily-sync F003 · Daily cron entry point.
 *
 * Runs once per day at 08:30 BJ (= 00:30 UTC) on prod via
 * /etc/cron.d/kolmatrix-kol-sync. Drives the discover + refresh phases
 * through the dispatcher, writes RawKolData into the kol table, and
 * appends a structured JSON log line per run plus a markdown report
 * under docs/test-reports/kol-sync-daily-{YYYY-MM-DD}.md.
 *
 * Failure policy: any uncaught error is logged but the script still
 * exits 0 so cron doesn't email the on-call for transient upstream
 * issues. F004 layers retry + per-call backoff on top of the adapter
 * methods; this file already calls `dispatcher.healthCheckAll()`
 * first and bails before burning quota when no adapter is healthy.
 *
 * Env:
 *   YOUTUBE_API_KEY  required for live runs
 *   DATABASE_URL     required for live runs (DATABASE_ADMIN_URL falls
 *                    back when set)
 *   KOL_SYNC_DEMO_TENANT_SLUG  defaults to "demo"
 *
 * Flags:
 *   --dry-run        skip API + DB writes; print the matrix plan
 *   --refresh-batch  cap the refresh batch (default 200 KOL/day)
 *   --no-refresh     run discover only (used for first-day smoke)
 */
import "dotenv/config";

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { embedKolsForIds, type EmbedRunStats } from "../src/lib/embedding/kol-embed";
import { computeKolValueScore } from "../src/lib/kol/value-score";
import { YouTubeKolSyncAdapter } from "../src/lib/kol-sync/adapters/youtube";
import { KolSyncDispatcher } from "../src/lib/kol-sync/dispatcher";
import {
  runEngagementBatch,
  type EngagementBatchClient,
  type EngagementBatchResult,
} from "../src/lib/kol-sync/engagement-batch";
import { createEngagementBatchClient } from "../src/lib/kol-sync/engagement-batch-client";
import { importRawKolData, type ImportStats } from "../src/lib/kol-sync/import";
import { PUBLISHED_AFTER_CORE_REGIONS } from "../src/lib/kol-sync/published-after";
import { fetchTieredRefreshIds } from "../src/lib/kol-sync/refresh-selector";
import {
  classifyDailyRun,
  countTrailingZeroDiscoverStreak,
  formatDailyLogLineJson,
  type DailyLogLine,
  type PerMatrixEntry,
} from "../src/lib/kol-sync/log";
import { DEFAULT_BACKOFFS_MS } from "../src/lib/kol-sync/retry";
import type {
  HealthCheckResult,
  KolSyncAdapter,
  RawKolData,
  RefreshReport,
  SyncReport,
} from "../src/lib/kol-sync/types";

const DEFAULT_REFRESH_BATCH = 200;

interface CliArgs {
  dryRun: boolean;
  refreshBatch: number;
  noRefresh: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    refreshBatch: DEFAULT_REFRESH_BATCH,
    noRefresh: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--no-refresh") {
      args.noRefresh = true;
    } else if (a === "--refresh-batch") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        throw new Error(`--refresh-batch must be 0..1000, got "${argv[i]}"`);
      }
      args.refreshBatch = n;
    }
  }
  return args;
}

// ---------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------

function todayUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

interface DailyRunReport {
  date: string;
  startedAt: string;
  endedAt: string;
  health: Record<string, HealthCheckResult>;
  discover: {
    outcomes: SyncReport["outcomes"];
    totals: SyncReport["totals"];
  } | null;
  refresh: {
    outcomes: RefreshReport["outcomes"];
    totals: RefreshReport["totals"];
  } | null;
  importStats: ImportStats | null;
  refreshImportStats: ImportStats | null;
  /** BIx-F004-P5 — per-(region, keyword) cell stats collected from
   *  the adapter's onMatrixCell callback. Empty when the adapter
   *  doesn't emit them (mock / dryRun). */
  perMatrix: PerMatrixEntry[];
  /** B7a-F001 — embedding hook results (audit lock #8:B, soft phase). */
  embedStats: EmbedRunStats | null;
  /** BIx-F004-P4 — Top 100 KOL engagement batch summary. `null` when
   *  the phase didn't run (dryRun / no client / no eligible KOL).
   *
   *  BL-023-F006: `valueScoreRecomputed` is the number of KOL whose
   *  `valueScore` was rewritten using the fresh engagement_rate from
   *  this run. Always ≤ engagementUpdated. */
  engagementBatch: {
    topKolsProcessed: number;
    engagementUpdated: number;
    latestVideosUpdated: number;
    channelsWithoutPlaylist: number;
    valueScoreRecomputed: number;
    apiCallStats: EngagementBatchResult["apiCallStats"];
  } | null;
  errors: string[];
  /** Best-effort estimate based on adapter knowledge; F004 will
   *  replace this with a real counter once retry tracking lands. */
  estimatedQuotaConsumed: number;
}

function formatEmbedSection(report: DailyRunReport, lines: string[]): void {
  if (!report.embedStats) return;
  const e = report.embedStats;
  lines.push("## Embedding hook (B7a-F001)");
  lines.push(
    `- Scanned: ${e.scanned} | Skipped (hash unchanged): ${e.skipped} | Embedded: ${e.embedded} | Failed: ${e.failed}`
  );
  lines.push(
    `- Batches: ${e.batches} | Tokens: ${e.promptTokens} | Estimated cost: $${e.estimatedCostUsd.toFixed(6)}`
  );
  lines.push("");
}

function formatMarkdownReport(report: DailyRunReport): string {
  const lines: string[] = [];
  lines.push(`# kol-sync daily report — ${report.date}`);
  lines.push("");
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Ended:   ${report.endedAt}`);
  lines.push(`- Estimated quota consumed: ${report.estimatedQuotaConsumed} units`);
  lines.push("");
  lines.push("## Adapter health");
  for (const [name, h] of Object.entries(report.health)) {
    lines.push(
      `- **${name}**: ${h.healthy ? "healthy" : "unhealthy"} ${JSON.stringify(h.details ?? {})}`
    );
  }
  lines.push("");
  if (report.discover) {
    lines.push("## Discover");
    lines.push(`- Total raw rows: ${report.discover.totals.discoverCount}`);
    lines.push(`- Failed adapters: ${report.discover.totals.failedAdapters}`);
    if (report.importStats) {
      lines.push(
        `- Imported: inserted=${report.importStats.inserted} updated=${report.importStats.updated} skipped=${report.importStats.skipped}`
      );
    }
    lines.push("");
  }
  if (report.refresh) {
    lines.push("## Refresh");
    lines.push(`- Total raw rows: ${report.refresh.totals.refreshCount}`);
    if (report.refreshImportStats) {
      lines.push(
        `- Imported: inserted=${report.refreshImportStats.inserted} updated=${report.refreshImportStats.updated} skipped=${report.refreshImportStats.skipped}`
      );
    }
    lines.push("");
  }
  formatEmbedSection(report, lines);
  if (report.engagementBatch) {
    const eb = report.engagementBatch;
    lines.push("## Engagement batch (BIx-F004-P4)");
    lines.push(
      `- Top KOL processed: ${eb.topKolsProcessed} | engagement updated: ${eb.engagementUpdated} | latestVideos updated: ${eb.latestVideosUpdated} | without playlist: ${eb.channelsWithoutPlaylist}`
    );
    lines.push(`- valueScore recomputed (BL-023-F006): ${eb.valueScoreRecomputed}`);
    lines.push(
      `- API calls — channels.list: ${eb.apiCallStats.channels} | playlistItems.list: ${eb.apiCallStats.playlistItems} | videos.list: ${eb.apiCallStats.videos}`
    );
    lines.push("");
  }
  if (report.perMatrix.length > 0) {
    const totalFound = report.perMatrix.reduce((s, e) => s + e.found, 0);
    const totalRejections = report.perMatrix.reduce((s, e) => s + e.filterRejections, 0);
    lines.push("## Per-matrix (BIx-F004-P5)");
    lines.push(
      `- Cells: ${report.perMatrix.length} | found: ${totalFound} | filterRejections: ${totalRejections}`
    );
    lines.push("");
  }
  if (report.errors.length > 0) {
    lines.push("## Errors");
    for (const e of report.errors) lines.push(`- ${e}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildLogLineFromReport(
  report: DailyRunReport,
  zeroDiscoverStreakBefore: number
): DailyLogLine {
  const adapters = Object.entries(report.health).map(([name, h]) => ({
    name,
    healthy: h.healthy,
  }));
  return classifyDailyRun({
    timestamp: report.startedAt,
    endedAt: report.endedAt,
    adapters,
    discoverCount: report.discover?.totals.discoverCount ?? 0,
    refreshCount: report.refresh?.totals.refreshCount ?? 0,
    inserted: report.importStats?.inserted ?? 0,
    updated: (report.importStats?.updated ?? 0) + (report.refreshImportStats?.updated ?? 0),
    skipped: report.importStats?.skipped ?? 0,
    dedupeSkipped: 0, // F005 will surface this once quality module lands
    estimatedQuotaConsumed: report.estimatedQuotaConsumed,
    estimatedQuotaRemaining: Math.max(0, 10_000 - report.estimatedQuotaConsumed),
    errors: report.errors,
    zeroDiscoverStreakBefore,
    perMatrix: report.perMatrix.length > 0 ? report.perMatrix : undefined,
    engagementBatchStats: report.engagementBatch ?? undefined,
  });
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

export interface DailyRunDeps {
  adapters: KolSyncAdapter[];
  prisma: PrismaClient | null;
  tenantSlug: string;
  dryRun: boolean;
  refreshBatch: number;
  noRefresh: boolean;
  now?: () => Date;
  /** Override the default 30s/2min/5min backoff (e.g. tests pass in
   *  a synchronous sleep). When undefined the orchestrator uses the
   *  spec-mandated schedule. */
  retry?: import("../src/lib/kol-sync/retry").RetryOpts;
  /** BIx-F004-P4 — engagement batch client. `undefined` skips the
   *  phase (used in tests + when the API key is missing). */
  engagementBatchClient?: EngagementBatchClient;
  /** BIx-F004-P4 — top-N cap for the engagement batch. Default 100. */
  engagementBatchTopN?: number;
  /** BIx-F004-P5 — collector for per-cell observability events.
   *  Caller wires the YouTube adapter's `onMatrixCell` to push into
   *  this array; the orchestrator surfaces it on the report so the
   *  daily log line picks it up. */
  perMatrixCollector?: PerMatrixEntry[];
}

export async function runDaily(deps: DailyRunDeps): Promise<DailyRunReport> {
  const startedAt = new Date().toISOString();
  // BIx-F004-P5: per-cell stats are pushed by the YouTube adapter via
  // its `onMatrixCell` callback (caller wires it in main()); the
  // collector is shared via this array reference so what's reported
  // is exactly what the adapter emitted.
  const perMatrix = deps.perMatrixCollector ?? [];
  const dispatcher = new KolSyncDispatcher(deps.adapters);
  const errors: string[] = [];
  let estimatedQuotaConsumed = 0;

  const health = await dispatcher.healthCheckAll();
  // 1u per healthCheck call (YouTube). Generic across adapters because
  // every adapter is supposed to charge ≤ 1u for the probe.
  estimatedQuotaConsumed += Object.keys(health).length;

  const anyHealthy = Object.values(health).some((h) => h.healthy);
  if (!anyHealthy) {
    errors.push("all adapters unhealthy — bailing before discover");
    return {
      date: todayUtc(),
      startedAt,
      endedAt: new Date().toISOString(),
      health,
      discover: null,
      refresh: null,
      importStats: null,
      refreshImportStats: null,
      perMatrix,
      embedStats: null,
      engagementBatch: null,
      errors,
      estimatedQuotaConsumed,
    };
  }

  // ---- DISCOVER ----
  const discover = deps.dryRun
    ? null
    : await dispatcher.runDailySync({
        retry: deps.retry ?? {
          backoffsMs: DEFAULT_BACKOFFS_MS,
          onRetry: (attempt, err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[kol-sync-daily] discover retry #${attempt}: ${msg.slice(0, 200)}`);
          },
        },
      });
  if (discover) {
    // Estimate: each YouTube adapter discover burns ~9,000u for the
    // BIx-F004-P3 daily matrix — 14 region × 6 keyword × 100u
    // (= 8,400u) for the main matrix + ~600u for the publishedAfter
    // slice phase (6 core regions × 100u) when env permits. Other
    // adapters add their own when they land.
    estimatedQuotaConsumed +=
      discover.outcomes.filter((o) => o.adapter === "youtube" && o.ok).length * 9_000;
    for (const o of discover.outcomes) {
      if (!o.ok) errors.push(`discover[${o.adapter}]: ${o.error}`);
    }
  }
  const discoveredRaws: RawKolData[] = discover
    ? discover.outcomes.flatMap((o) => (o.ok ? o.data : []))
    : [];

  // ---- WRITE DISCOVERED ----
  let importStats: ImportStats | null = null;
  if (deps.prisma && !deps.dryRun && discoveredRaws.length > 0) {
    const tenant = await deps.prisma.tenant.findUnique({
      where: { slug: deps.tenantSlug },
    });
    if (!tenant) {
      errors.push(`tenant not found: ${deps.tenantSlug}`);
    } else {
      try {
        // Default to youtube-api-daily; adapter-specific imports could
        // land later when more sources come online.
        importStats = await importRawKolData(deps.prisma, discoveredRaws, {
          tenantId: tenant.id,
          source: "youtube-api-daily",
          isDemo: false,
          now: deps.now,
        });
      } catch (err) {
        errors.push(`discover-import: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ---- REFRESH ----
  let refresh: DailyRunReport["refresh"] = null;
  let refreshImportStats: ImportStats | null = null;
  if (deps.prisma && !deps.dryRun && !deps.noRefresh && deps.refreshBatch > 0) {
    const tenant = await deps.prisma.tenant.findUnique({
      where: { slug: deps.tenantSlug },
    });
    if (tenant) {
      // BIx-F004-P3: pick via the tiered selector instead of FIFO so
      // the top 50 by valueScore stay fresh on a 3-day cycle, the
      // 51-500 cohort on 7 days, the long-tail on 21 days, and any
      // flagged-as-suspicious row is forced into today's batch.
      const staleIds = await fetchTieredRefreshIds(deps.prisma, {
        tenantId: tenant.id,
        platform: "youtube",
        date: deps.now ? deps.now() : new Date(),
        maxTotal: deps.refreshBatch,
      });
      if (staleIds.length > 0) {
        const refreshReport = await dispatcher.runRefresh({
          perAdapterIds: { youtube: staleIds },
          retry: deps.retry ?? {
            backoffsMs: DEFAULT_BACKOFFS_MS,
            onRetry: (attempt, err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`[kol-sync-daily] refresh retry #${attempt}: ${msg.slice(0, 200)}`);
            },
          },
        });
        refresh = {
          outcomes: refreshReport.outcomes,
          totals: refreshReport.totals,
        };
        for (const o of refreshReport.outcomes) {
          if (!o.ok) errors.push(`refresh[${o.adapter}]: ${o.error}`);
        }
        // ~1u per ⌈ids/50⌉ batch.
        estimatedQuotaConsumed += Math.ceil(staleIds.length / 50);
        const refreshedRaws = refreshReport.outcomes.flatMap((o) => (o.ok ? o.data : []));
        if (refreshedRaws.length > 0) {
          try {
            refreshImportStats = await importRawKolData(deps.prisma, refreshedRaws, {
              tenantId: tenant.id,
              source: "youtube-api-daily",
              isDemo: false,
              now: deps.now,
            });
          } catch (err) {
            errors.push(`refresh-import: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
  }

  // ---- ENGAGEMENT BATCH (BIx-F004-P4) ----
  // Pre-compute real engagementRate + cache the 6 most-recent videos
  // for the top 100 KOL by valueScore. Replaces B5-F004's per-page
  // lazy-load (100u/click) with a daily ~114u amortised batch.
  // Soft-fails: thrown errors surface in `errors` but never abort
  // the run.
  let engagementBatch: DailyRunReport["engagementBatch"] = null;
  if (deps.prisma && !deps.dryRun && deps.engagementBatchClient) {
    try {
      const tenant = await deps.prisma.tenant.findUnique({
        where: { slug: deps.tenantSlug },
      });
      if (tenant) {
        const topN = deps.engagementBatchTopN ?? 100;
        const top = await deps.prisma.kol.findMany({
          where: {
            tenantId: tenant.id,
            platform: "youtube",
            externalId: { not: null },
          },
          orderBy: [{ valueScore: { sort: "desc", nulls: "last" } }, { id: "asc" }],
          take: topN,
          select: {
            id: true,
            externalId: true,
            metadata: true,
            // BL-023-F006: extra fields needed for the post-batch
            // valueScore recompute. Pulled in the same query so we
            // don't pay for a second findMany after the engagement
            // updates land.
            followerCount: true,
            categories: true,
            engagementAuthenticity: true,
          },
        });
        const topChannels = top
          .filter((r): r is typeof r & { externalId: string } => Boolean(r.externalId))
          .map((r) => ({ kolId: r.id, externalId: r.externalId }));
        if (topChannels.length > 0) {
          const result = await runEngagementBatch({
            topChannels,
            client: deps.engagementBatchClient,
          });
          let engagementUpdated = 0;
          let latestVideosUpdated = 0;
          let valueScoreRecomputed = 0;
          const metaByKolId = new Map<string, unknown>(top.map((r) => [r.id, r.metadata]));
          // BL-023-F006: keep the full top-N row payload around so the
          // post-batch valueScore recompute can read followerCount /
          // categories / engagementAuthenticity without a re-query.
          const topById = new Map(top.map((r) => [r.id, r]));
          for (const u of result.updates) {
            const prevMeta = metaByKolId.get(u.kolId);
            const merged = mergeLatestVideos(prevMeta, u.latestVideos);
            try {
              await deps.prisma.kol.update({
                where: { id: u.kolId },
                data: {
                  engagementRate: u.engagementRate,
                  metadata: merged as Parameters<
                    NonNullable<typeof deps.prisma>["kol"]["update"]
                  >[0]["data"]["metadata"],
                },
              });
              if (u.engagementRate !== null) engagementUpdated += 1;
              if (u.latestVideos.length > 0) latestVideosUpdated += 1;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(
                `[kol-sync-daily] engagement-batch update ${u.kolId}: ${msg.slice(0, 200)}`
              );
              continue;
            }
            // BL-023-F006: recompute valueScore using the engagement
            // signal we just wrote. Per-row soft-fail — a recompute
            // miss leaves the prior valueScore in place; the next
            // daily run gets another shot. Skips KOL whose engagement
            // batch yielded null (no playlist / zero views) since the
            // formula would just collapse back to the placeholder.
            if (u.engagementRate == null) continue;
            const kol = topById.get(u.kolId);
            if (!kol) continue;
            try {
              const { total } = computeKolValueScore({
                followerCount: kol.followerCount ?? 0,
                categories: kol.categories ?? [],
                engagementRate: u.engagementRate,
                engagementAuthenticity: kol.engagementAuthenticity,
              });
              await deps.prisma.kol.update({
                where: { id: u.kolId },
                data: { valueScore: total },
              });
              valueScoreRecomputed += 1;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(
                `[kol-sync-daily] valueScore-recompute ${u.kolId}: ${msg.slice(0, 200)}`
              );
            }
          }
          engagementBatch = {
            topKolsProcessed: result.topKolsProcessed,
            engagementUpdated,
            latestVideosUpdated,
            channelsWithoutPlaylist: result.channelsWithoutPlaylist,
            valueScoreRecomputed,
            apiCallStats: result.apiCallStats,
          };
          // Real quota cost from API counters — more accurate than
          // the discover/refresh estimates.
          const cost =
            result.apiCallStats.channels +
            result.apiCallStats.playlistItems +
            result.apiCallStats.videos;
          estimatedQuotaConsumed += cost;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kol-sync-daily] engagement-batch failed: ${msg.slice(0, 200)}`);
      errors.push(`engagement-batch: ${msg.slice(0, 200)}`);
    }
  }

  // ---- EMBED HOOK (B7a-F001 audit lock #8:B) ----
  // Soft phase: embedding failures degrade to "vectors stale by one
  // day" but never abort the sync. We pull every kol id touched in
  // this run via last_synced_at >= startedAt, then call
  // embedKolsForIds which itself dirty-checks via embedding_text_hash.
  let embedStats: EmbedRunStats | null = null;
  if (deps.prisma && !deps.dryRun) {
    try {
      const tenant = await deps.prisma.tenant.findUnique({
        where: { slug: deps.tenantSlug },
      });
      if (tenant) {
        const touched = await deps.prisma.kol.findMany({
          where: {
            tenantId: tenant.id,
            lastSyncedAt: { gte: new Date(startedAt) },
          },
          select: { id: true },
        });
        const ids = touched.map((r) => r.id);
        if (ids.length > 0) {
          embedStats = await embedKolsForIds(deps.prisma, ids, {
            logger: (m) => console.log(m),
          });
          if (embedStats.failed > 0) {
            errors.push(`embed-hook: ${embedStats.failed}/${embedStats.scanned} failed`);
          }
        }
      }
    } catch (err) {
      // Soft-fail: log + collect but never throw out of runDaily.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kol-sync-daily] embed-hook failed: ${msg.slice(0, 200)}`);
      errors.push(`embed-hook: ${msg.slice(0, 200)}`);
    }
  }

  return {
    date: todayUtc(),
    startedAt,
    endedAt: new Date().toISOString(),
    health,
    discover: discover ? { outcomes: discover.outcomes, totals: discover.totals } : null,
    refresh,
    importStats,
    refreshImportStats,
    perMatrix,
    embedStats,
    engagementBatch,
    errors,
    estimatedQuotaConsumed,
  };
}

/**
 * BIx-F004-P4 · merge `latestVideos` into a Kol.metadata blob,
 * preserving all existing keys. Defensive against malformed prior
 * payloads — non-object metadata is treated as "start fresh".
 */
function mergeLatestVideos(
  prev: unknown,
  latestVideos: ReadonlyArray<{
    videoId: string;
    title: string;
    thumbnailUrl: string | null;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string | null;
  }>
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  base.latestVideos = latestVideos;
  return base;
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

const REPORT_DIR_REL = "docs/test-reports";
const STRUCTURED_LOG_PATH = process.env.KOL_SYNC_LOG_PATH ?? "/var/log/kolmatrix-kol-sync.log";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-sync-daily] starting (dryRun=${args.dryRun} refreshBatch=${args.refreshBatch} noRefresh=${args.noRefresh})`
  );

  const apiKey = process.env.YOUTUBE_API_KEY;
  // BIx-F004-P3: publishedAfter slice phase — 6 core regions by
  // default, falls back to 4 when quota is tight (env override).
  // 0 disables the phase. Invalid → spec default of 6.
  const sliceCountEnv = Number(process.env.KOL_SYNC_PUBLISHED_AFTER_SLICES);
  const sliceCount =
    Number.isFinite(sliceCountEnv) &&
    sliceCountEnv >= 0 &&
    sliceCountEnv <= PUBLISHED_AFTER_CORE_REGIONS.length
      ? sliceCountEnv
      : PUBLISHED_AFTER_CORE_REGIONS.length;
  const publishedAfterRegions =
    sliceCount > 0 ? PUBLISHED_AFTER_CORE_REGIONS.slice(0, sliceCount) : null;

  // BIx-F004-P5: per-cell observability collector. Adapter pushes
  // each (region, keyword) iteration's stats here; runDaily picks up
  // the array via `perMatrixCollector` and surfaces it on the report.
  const perMatrixCollector: PerMatrixEntry[] = [];
  const adapters: KolSyncAdapter[] = [
    new YouTubeKolSyncAdapter({
      apiKey,
      publishedAfterRegions,
      onMatrixCell: (e) => perMatrixCollector.push(e),
    }),
  ];

  // BIx-F004-P4: engagement batch client (skipped when key is
  // missing — discover/refresh still complete).
  const engagementBatchClient: EngagementBatchClient | undefined = apiKey
    ? createEngagementBatchClient(apiKey)
    : undefined;

  let prisma: PrismaClient | null = null;
  if (!args.dryRun) {
    const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
    if (!conn) {
      console.error("[kol-sync-daily] DATABASE_URL not set — refusing to run without a DB");
      process.exitCode = 0; // cron-friendly: don't page on env mishap
      return;
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });
  }

  const tenantSlug = process.env.KOL_SYNC_DEMO_TENANT_SLUG ?? "demo";

  let report: DailyRunReport;
  try {
    report = await runDaily({
      adapters,
      prisma,
      tenantSlug,
      dryRun: args.dryRun,
      refreshBatch: args.refreshBatch,
      noRefresh: args.noRefresh,
      engagementBatchClient,
      perMatrixCollector,
    });
  } catch (err) {
    // Outermost guard so cron always sees exit 0. F004 will pipe the
    // error into the structured log + alerting.
    console.error(`[kol-sync-daily] fatal: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 0;
    return;
  } finally {
    if (prisma) await prisma.$disconnect();
  }

  // Compute the zero-discover streak by reading the existing log
  // file's trailing entries. Tolerates missing file / malformed
  // lines — both yield 0.
  let priorStreak = 0;
  try {
    if (existsSync(STRUCTURED_LOG_PATH)) {
      priorStreak = countTrailingZeroDiscoverStreak(readFileSync(STRUCTURED_LOG_PATH, "utf8"));
    }
  } catch (err) {
    console.warn(
      `[kol-sync-daily] could not read prior log for streak: ${err instanceof Error ? err.message : err}`
    );
  }

  const logLine = buildLogLineFromReport(report, priorStreak);

  // Write the structured log line + markdown report.
  try {
    appendFileSync(STRUCTURED_LOG_PATH, formatDailyLogLineJson(logLine) + "\n");
  } catch (err) {
    console.warn(
      `[kol-sync-daily] could not write structured log to ${STRUCTURED_LOG_PATH}: ${err instanceof Error ? err.message : err}`
    );
  }
  const reportPath = resolve(__dirname, "..", REPORT_DIR_REL, `kol-sync-daily-${report.date}.md`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, formatMarkdownReport(report), "utf8");

  console.log(`[kol-sync-daily] DONE — report: ${reportPath}`);
  console.log(
    `[kol-sync-daily] level=${logLine.level} summary: discover=${logLine.discoverCount} refresh=${logLine.refreshCount} inserted=${logLine.inserted} updated=${logLine.updated} errors=${logLine.errors.length} quota_est=${logLine.estimatedQuotaConsumed}`
  );
  if (logLine.alerts.length > 0) {
    console.log(`[kol-sync-daily] alerts: ${logLine.alerts.join(" | ")}`);
  }

  // Exit 0 even on partial errors — F004's alerting job is to surface
  // them out-of-band.
  process.exitCode = 0;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[kol-sync-daily] outer-guard: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 0;
  });
}
