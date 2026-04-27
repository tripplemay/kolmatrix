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

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { YouTubeKolSyncAdapter } from "../src/lib/kol-sync/adapters/youtube";
import { KolSyncDispatcher } from "../src/lib/kol-sync/dispatcher";
import { importRawKolData, type ImportStats } from "../src/lib/kol-sync/import";
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
  errors: string[];
  /** Best-effort estimate based on adapter knowledge; F004 will
   *  replace this with a real counter once retry tracking lands. */
  estimatedQuotaConsumed: number;
}

function formatMarkdownReport(report: DailyRunReport): string {
  const lines: string[] = [];
  lines.push(`# kol-sync daily report — ${report.date}`);
  lines.push("");
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Ended:   ${report.endedAt}`);
  lines.push(
    `- Estimated quota consumed: ${report.estimatedQuotaConsumed} units`
  );
  lines.push("");
  lines.push("## Adapter health");
  for (const [name, h] of Object.entries(report.health)) {
    lines.push(`- **${name}**: ${h.healthy ? "healthy" : "unhealthy"} ${JSON.stringify(h.details ?? {})}`);
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
    updated:
      (report.importStats?.updated ?? 0) +
      (report.refreshImportStats?.updated ?? 0),
    skipped: report.importStats?.skipped ?? 0,
    dedupeSkipped: 0, // F005 will surface this once quality module lands
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
  refreshBatch: number;
  noRefresh: boolean;
  now?: () => Date;
  /** Override the default 30s/2min/5min backoff (e.g. tests pass in
   *  a synchronous sleep). When undefined the orchestrator uses the
   *  spec-mandated schedule. */
  retry?: import("../src/lib/kol-sync/retry").RetryOpts;
}

export async function runDaily(deps: DailyRunDeps): Promise<DailyRunReport> {
  const startedAt = new Date().toISOString();
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
            console.warn(
              `[kol-sync-daily] discover retry #${attempt}: ${msg.slice(0, 200)}`
            );
          },
        },
      });
  if (discover) {
    // Estimate: each YouTube adapter discover call burns ~1,800u for
    // the default daily matrix. Other adapters add their own when
    // they land.
    estimatedQuotaConsumed += discover.outcomes
      .filter((o) => o.adapter === "youtube" && o.ok)
      .length * 1_800;
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
        errors.push(
          `discover-import: ${err instanceof Error ? err.message : String(err)}`
        );
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
      // Pick the oldest-synced YouTube channels — channels.list can
      // batch up to 50 ids per call so 200 IDs costs 4 units.
      const stale = await deps.prisma.kol.findMany({
        where: {
          tenantId: tenant.id,
          platform: "youtube",
          externalId: { not: null },
        },
        orderBy: [{ lastSyncedAt: "asc" }],
        take: deps.refreshBatch,
        select: { externalId: true },
      });
      const staleIds = stale
        .map((r) => r.externalId)
        .filter((id): id is string => Boolean(id));
      if (staleIds.length > 0) {
        const refreshReport = await dispatcher.runRefresh({
          perAdapterIds: { youtube: staleIds },
          retry: deps.retry ?? {
            backoffsMs: DEFAULT_BACKOFFS_MS,
            onRetry: (attempt, err) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(
                `[kol-sync-daily] refresh retry #${attempt}: ${msg.slice(0, 200)}`
              );
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
        const refreshedRaws = refreshReport.outcomes.flatMap((o) =>
          o.ok ? o.data : []
        );
        if (refreshedRaws.length > 0) {
          try {
            refreshImportStats = await importRawKolData(
              deps.prisma,
              refreshedRaws,
              {
                tenantId: tenant.id,
                source: "youtube-api-daily",
                isDemo: false,
                now: deps.now,
              }
            );
          } catch (err) {
            errors.push(
              `refresh-import: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }
    }
  }

  return {
    date: todayUtc(),
    startedAt,
    endedAt: new Date().toISOString(),
    health,
    discover: discover
      ? { outcomes: discover.outcomes, totals: discover.totals }
      : null,
    refresh,
    importStats,
    refreshImportStats,
    errors,
    estimatedQuotaConsumed,
  };
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

const REPORT_DIR_REL = "docs/test-reports";
const STRUCTURED_LOG_PATH =
  process.env.KOL_SYNC_LOG_PATH ?? "/var/log/kolmatrix-kol-sync.log";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-sync-daily] starting (dryRun=${args.dryRun} refreshBatch=${args.refreshBatch} noRefresh=${args.noRefresh})`
  );

  const apiKey = process.env.YOUTUBE_API_KEY;
  const adapters: KolSyncAdapter[] = [
    new YouTubeKolSyncAdapter({ apiKey }),
  ];

  let prisma: PrismaClient | null = null;
  if (!args.dryRun) {
    const conn =
      process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
    if (!conn) {
      console.error(
        "[kol-sync-daily] DATABASE_URL not set — refusing to run without a DB"
      );
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
    });
  } catch (err) {
    // Outermost guard so cron always sees exit 0. F004 will pipe the
    // error into the structured log + alerting.
    console.error(
      `[kol-sync-daily] fatal: ${err instanceof Error ? err.message : err}`
    );
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
      priorStreak = countTrailingZeroDiscoverStreak(
        readFileSync(STRUCTURED_LOG_PATH, "utf8")
      );
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
  const reportPath = resolve(
    __dirname,
    "..",
    REPORT_DIR_REL,
    `kol-sync-daily-${report.date}.md`
  );
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
