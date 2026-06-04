/**
 * BL-059 · Daily cron entry point (apify-kol single-source).
 *
 * Runs once per day at 08:30 BJ (= 00:30 UTC) on prod via
 * /etc/cron.d/kolmatrix-kol-sync. After BL-059 (5/9 deprecate) the
 * YouTube Data API path + engagement-batch enrichment were removed; the
 * daily sync drives a single adapter (`apify-kol-service`) through
 * healthCheck → discover → import → refresh → import → embed-hook.
 * (BL-082-F003 re-wired the tiered refresh phase that BL-059 had dropped:
 * `fetchTieredRefreshIds` → `dispatcher.runRefresh` → import.)
 * apify-kol's discover() walks the fork's GET /kol with
 * its own 4-dim score filter; Kol rows are tagged
 * `metadata.source = 'apify-kol'`, and `engagementRate` is derived by
 * the mapper (BL-059-F001 simplified `(totalLikes / postsCount) /
 * followers * 100`).
 *
 * Failure policy: any uncaught error is logged but the script still
 * exits 0 so cron doesn't email the on-call for transient upstream
 * issues. Retries (30s/2min/5min) wrap each adapter call.
 *
 * Env:
 *   APIFY_KOL_BASE_URL              required for live runs
 *   APIFY_KOL_BUSINESS_API_KEY      required for live runs
 *   DATABASE_URL                    required for live runs (DATABASE_ADMIN_URL falls
 *                                   back when set)
 *   KOL_SYNC_DEMO_TENANT_SLUG       defaults to "demo"
 *
 * Flags:
 *   --dry-run        skip API + DB writes; print the plan-only report
 */
import "dotenv/config";

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { embedKolsForIds, type EmbedRunStats } from "../src/lib/embedding/kol-embed";
import { ApifyKolSyncAdapter } from "../src/lib/kol-sync/adapters/apify-kol";
import { KolSyncDispatcher } from "../src/lib/kol-sync/dispatcher";
import {
  enrichKolsForTenant,
  type EnrichStageStats,
} from "../src/lib/kol-sync/enrichment-stage";
import { importRawKolData, type ImportStats } from "../src/lib/kol-sync/import";
import { fetchTieredRefreshIds } from "../src/lib/kol-sync/refresh-selector";

// BL-082-F003 — apify-kol platforms put on the daily refresh rota.
const REFRESH_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
import type { QualityFlags, QualitySkipReason } from "../src/lib/kol-sync/quality";
import {
  classifyDailyRun,
  countTrailingZeroDiscoverStreak,
  formatDailyLogLineJson,
  type DailyLogLine,
} from "../src/lib/kol-sync/log";
import { DEFAULT_BACKOFFS_MS } from "../src/lib/kol-sync/retry";
import type {
  HealthCheckResult,
  KolSyncAdapter,
  SyncReport,
} from "../src/lib/kol-sync/types";

interface CliArgs {
  dryRun: boolean;
  /**
   * BL-075-F003 fix-round 1: optional row cap on the enrichment stage.
   * Cron leaves it unset (no cap) so the daily run processes every
   * NULL row; staging / signoff verification passes a small value
   * (e.g. 10) to demonstrate the daily-sync → enrichment-stage
   * → kol.enriched audit_log wiring in a finite-time window without
   * waiting on the full 3000+ row catch-up. `0` is treated as
   * "no cap" so legacy cron lines stay safe.
   */
  enrichmentLimit: number | null;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, enrichmentLimit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a.startsWith("--enrichment-limit=")) {
      const n = Number(a.slice("--enrichment-limit=".length));
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--enrichment-limit must be >=0, got "${a}"`);
      }
      args.enrichmentLimit = n > 0 ? n : null;
    }
    // Legacy --no-refresh / --refresh-batch flags are accepted-and-ignored
    // (the refresh phase, re-wired in BL-082-F003, always runs on the
    // tiered selector's daily slice; old cron lines passing them keep
    // working without toggling it off).
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
  importStats: ImportStats | null;
  /** BL-082-F003 — total rows re-fetched + re-imported by the refresh
   *  phase (tiered selector → adapter.refresh → import). */
  refreshCount: number;
  /** B7a-F001 — embedding hook results (audit lock #8:B, soft phase). */
  embedStats: EmbedRunStats | null;
  /** BL-075-F003 — enrichment stage stats (country/language fill). */
  enrichStats: EnrichStageStats | null;
  errors: string[];
  /** Best-effort estimate; apify-kol charges 1u per healthCheck and
   *  ~1u per /kol page request. */
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

function formatEnrichmentSection(report: DailyRunReport, lines: string[]): void {
  if (!report.enrichStats) return;
  const e = report.enrichStats;
  lines.push("## Enrichment stage (BL-075-F003)");
  lines.push(
    `- Scanned: ${e.scanned} | language+=${e.enrichedLanguage} | country+=${e.enrichedCountry} | both+=${e.enrichedBoth} | failed=${e.failedCount}`
  );
  lines.push(
    `- Country source: audience-geo-top1=${e.sources.audienceGeoTop1} | llm=${e.sources.llm} | fallback-null=${e.sources.fallbackNull}`
  );
  lines.push(
    `- LLM calls: ${e.llmCallCount} | Estimated cost: $${e.estimatedLlmCostUsd.toFixed(4)}`
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
        `- Imported: inserted=${report.importStats.inserted} updated=${report.importStats.updated} skipped=${report.importStats.skipped} failed=${report.importStats.failed}`
      );
    }
    lines.push("");
  }
  lines.push("## Refresh");
  lines.push(`- Rows refreshed: ${report.refreshCount}`);
  lines.push("");
  formatEmbedSection(report, lines);
  formatEnrichmentSection(report, lines);
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
    refreshCount: report.refreshCount,
    inserted: report.importStats?.inserted ?? 0,
    updated: report.importStats?.updated ?? 0,
    skipped: report.importStats?.skipped ?? 0,
    dedupeSkipped: 0,
    estimatedQuotaConsumed: report.estimatedQuotaConsumed,
    estimatedQuotaRemaining: Math.max(0, 10_000 - report.estimatedQuotaConsumed),
    errors: report.errors,
    zeroDiscoverStreakBefore,
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
  now?: () => Date;
  /** Override the default 30s/2min/5min backoff (e.g. tests pass in
   *  a synchronous sleep). When undefined the orchestrator uses the
   *  spec-mandated schedule. */
  retry?: import("../src/lib/kol-sync/retry").RetryOpts;
  /** BL-075-F003 fix-round 1: optional cap on the per-tenant
   *  enrichment scan. Tests + signoff verification pass a small
   *  value; cron leaves it undefined for unbounded daily catch-up. */
  enrichmentLimit?: number;
}

export async function runDaily(deps: DailyRunDeps): Promise<DailyRunReport> {
  const startedAt = new Date().toISOString();
  const dispatcher = new KolSyncDispatcher(deps.adapters);
  const errors: string[] = [];
  let estimatedQuotaConsumed = 0;

  const health = await dispatcher.healthCheckAll();
  // 1u per healthCheck call; apify-kol charges ≤ 1u for the probe.
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
      importStats: null,
      refreshCount: 0,
      embedStats: null,
      enrichStats: null,
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
    for (const o of discover.outcomes) {
      if (!o.ok) errors.push(`discover[${o.adapter}]: ${o.error}`);
    }
  }

  // ---- WRITE DISCOVERED (per-adapter source tagging) ----
  // Each adapter exposes its own `metadata.source` value via the
  // KolSyncAdapter contract. Import path runs once per adapter so the
  // apify-kol bridge writes rows tagged `source: 'apify-kol'`.
  let importStats: ImportStats | null = null;
  if (deps.prisma && !deps.dryRun && discover) {
    const tenant = await deps.prisma.tenant.findUnique({
      where: { slug: deps.tenantSlug },
    });
    if (!tenant) {
      errors.push(`tenant not found: ${deps.tenantSlug}`);
    } else {
      const sourceByAdapter = new Map(deps.adapters.map((a) => [a.name, a.source]));
      const aggregate: ImportStats = {
        total: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        skippedByReason: {},
        flaggedByKind: {},
        categoriesHistogram: {},
      };
      for (const outcome of discover.outcomes) {
        if (!outcome.ok || outcome.data.length === 0) continue;
        const source = sourceByAdapter.get(outcome.adapter) ?? outcome.adapter;
        try {
          const stats = await importRawKolData(deps.prisma, outcome.data, {
            tenantId: tenant.id,
            source,
            isDemo: false,
            now: deps.now,
          });
          aggregate.total += stats.total;
          aggregate.inserted += stats.inserted;
          aggregate.updated += stats.updated;
          aggregate.skipped += stats.skipped;
          aggregate.failed += stats.failed;
          for (const [reason, count] of Object.entries(stats.skippedByReason)) {
            const key = reason as QualitySkipReason;
            aggregate.skippedByReason[key] =
              (aggregate.skippedByReason[key] ?? 0) + (count as number);
          }
          for (const [flag, count] of Object.entries(stats.flaggedByKind)) {
            const key = flag as keyof QualityFlags;
            aggregate.flaggedByKind[key] =
              (aggregate.flaggedByKind[key] ?? 0) + (count as number);
          }
          for (const [cat, count] of Object.entries(stats.categoriesHistogram)) {
            aggregate.categoriesHistogram[cat] =
              (aggregate.categoriesHistogram[cat] ?? 0) + count;
          }
        } catch (err) {
          errors.push(
            `discover-import[${outcome.adapter}]: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      if (aggregate.total > 0) {
        importStats = aggregate;
      }
      // BL-076-F003: surface per-row upsert failures so the daily log
      // line's `errors=N` alert fires (and the next-day on-call sees
      // failed-row context in audit_log.kol.import_failed). Without
      // this push the per-row try/catch would silently swallow the
      // very thing F003 set out to expose.
      if (aggregate.failed > 0) {
        errors.push(
          `import-row-failed[apify-kol]: ${aggregate.failed} row(s) — see audit_log.kol.import_failed`
        );
      }
    }
  }

  // ---- REFRESH (BL-082-F003) ----
  // Sequential after discover→import: re-fetch a tiered slice of existing
  // KOLs per platform via `fetchTieredRefreshIds` → `dispatcher.runRefresh`
  // → import the refreshed rows back through the same upsert path. Keeps
  // the long-tail's follower/engagement metrics fresh (BL-059 removed this
  // phase; BL-081 F004 audit flagged the resulting refresh=0). Soft phase:
  // failures (incl. fork 404s, which adapter.refresh skips) degrade to
  // "fewer rows refreshed" but never abort the sync.
  let refreshCount = 0;
  if (deps.prisma && !deps.dryRun && discover) {
    try {
      const tenant = await deps.prisma.tenant.findUnique({
        where: { slug: deps.tenantSlug },
      });
      if (tenant) {
        const sourceByAdapter = new Map(deps.adapters.map((a) => [a.name, a.source]));
        console.log(`[kol-sync-daily] refresh phase start ${new Date().toISOString()}`);
        for (const platform of REFRESH_PLATFORMS) {
          const ids = await fetchTieredRefreshIds(deps.prisma, {
            tenantId: tenant.id,
            platform,
          });
          if (ids.length === 0) {
            console.log(`[kol-sync-daily] refresh ${platform}: 0 ids on rota`);
            continue;
          }
          const refreshReport = await dispatcher.runRefresh({
            perAdapterIds: { "apify-kol": ids },
            retry: deps.retry ?? { backoffsMs: DEFAULT_BACKOFFS_MS },
          });
          for (const outcome of refreshReport.outcomes) {
            if (!outcome.ok) {
              errors.push(`refresh[${outcome.adapter}/${platform}]: ${outcome.error}`);
              continue;
            }
            if (outcome.data.length === 0) continue;
            const source = sourceByAdapter.get(outcome.adapter) ?? outcome.adapter;
            try {
              await importRawKolData(deps.prisma, outcome.data, {
                tenantId: tenant.id,
                source,
                isDemo: false,
                now: deps.now,
              });
            } catch (err) {
              errors.push(
                `refresh-import[${platform}]: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
          refreshCount += refreshReport.totals.refreshCount;
          console.log(
            `[kol-sync-daily] refresh ${platform}: requested=${ids.length} refreshed=${refreshReport.totals.refreshCount} failedAdapters=${refreshReport.totals.failedAdapters}`,
          );
        }
        console.log(
          `[kol-sync-daily] refresh phase end ${new Date().toISOString()} totalRefreshed=${refreshCount}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kol-sync-daily] refresh phase failed: ${msg.slice(0, 200)}`);
      errors.push(`refresh-phase: ${msg.slice(0, 200)}`);
    }
  }

  // ---- EMBED HOOK (B7a-F001 audit lock #8:B) ----
  // Soft phase: embedding failures degrade to "vectors stale by one
  // day" but never abort the sync. Pull every kol id touched in this
  // run via last_synced_at >= startedAt, then call embedKolsForIds
  // which itself dirty-checks via embedding_text_hash.
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
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kol-sync-daily] embed-hook failed: ${msg.slice(0, 200)}`);
      errors.push(`embed-hook: ${msg.slice(0, 200)}`);
    }
  }

  // ---- ENRICHMENT (BL-075-F003) ----
  // After import + embed, fill NULL country_code / language on every
  // active gaming KOL in the tenant. Newly-inserted rows from this
  // run are scanned together with any historical rows the backfill
  // (F004) could not reach earlier. Failures degrade to "fill_rate
  // does not advance" but never abort the sync.
  let enrichStats: EnrichStageStats | null = null;
  if (deps.prisma && !deps.dryRun) {
    try {
      const tenant = await deps.prisma.tenant.findUnique({
        where: { slug: deps.tenantSlug },
      });
      if (tenant) {
        enrichStats = await enrichKolsForTenant({
          prisma: deps.prisma,
          tenantId: tenant.id,
          limit: deps.enrichmentLimit,
          logger: (m) => console.log(m),
        });
        if (enrichStats.failedCount > 0) {
          errors.push(
            `enrichment-stage: ${enrichStats.failedCount}/${enrichStats.scanned} failed`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[kol-sync-daily] enrichment-stage failed: ${msg.slice(0, 200)}`);
      errors.push(`enrichment-stage: ${msg.slice(0, 200)}`);
    }
  }

  return {
    date: todayUtc(),
    startedAt,
    endedAt: new Date().toISOString(),
    health,
    discover: discover ? { outcomes: discover.outcomes, totals: discover.totals } : null,
    importStats,
    refreshCount,
    embedStats,
    enrichStats,
    errors,
    estimatedQuotaConsumed,
  };
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

const REPORT_DIR_REL = "docs/test-reports";
const STRUCTURED_LOG_PATH = process.env.KOL_SYNC_LOG_PATH ?? "/var/log/kolmatrix-kol-sync.log";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[kol-sync-daily] starting (dryRun=${args.dryRun})`);

  const apifyKolBase = process.env.APIFY_KOL_BASE_URL;
  const apifyKolKey = process.env.APIFY_KOL_BUSINESS_API_KEY;
  if (!apifyKolBase || !apifyKolKey) {
    console.error(
      "[kol-sync-daily] APIFY_KOL_BASE_URL or APIFY_KOL_BUSINESS_API_KEY missing — cannot run (single-source apify-kol since BL-059)"
    );
    process.exitCode = 0; // cron-friendly: don't page on env mishap
    return;
  }

  const adapters: KolSyncAdapter[] = [
    new ApifyKolSyncAdapter({
      baseUrl: apifyKolBase,
      apiKey: apifyKolKey,
      maxRequestsPerSecond: 5,
      maxItemsPerRun: 5_000,
    }),
  ];

  let prisma: PrismaClient | null = null;
  if (!args.dryRun) {
    const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
    if (!conn) {
      console.error("[kol-sync-daily] DATABASE_URL not set — refusing to run without a DB");
      process.exitCode = 0;
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
      enrichmentLimit: args.enrichmentLimit ?? undefined,
    });
  } catch (err) {
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
    `[kol-sync-daily] level=${logLine.level} summary: discover=${logLine.discoverCount} inserted=${logLine.inserted} updated=${logLine.updated} failed=${report.importStats?.failed ?? 0} errors=${logLine.errors.length} quota_est=${logLine.estimatedQuotaConsumed}`
  );
  if (logLine.alerts.length > 0) {
    console.log(`[kol-sync-daily] alerts: ${logLine.alerts.join(" | ")}`);
  }

  process.exitCode = 0;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[kol-sync-daily] outer-guard: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 0;
  });
}
