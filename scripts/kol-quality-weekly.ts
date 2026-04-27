/**
 * B6-kol-daily-sync F005 · Weekly KOL data-quality report.
 *
 * Runs Mondays at 09:00 BJ via /etc/cron.d/kolmatrix-kol-quality.
 * Walks the demo tenant's kol table, summarises:
 *   - new KOLs added this week (`metadata.seeded_at` within window)
 *   - region distribution (country code histogram)
 *   - categories distribution
 *   - anomaly counts (`metadata.flags.suspicious_growth/declining`)
 *   - rough quality grade (A/B/C/D scale per spec §F005)
 *
 * Output: docs/test-reports/kol-quality-weekly-{YYYY-MM-DD}.md
 * (gitignored; generated per host).
 */
import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

interface CliArgs {
  dryRun: boolean;
  windowDays: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, windowDays: 7 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--window-days") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1 || n > 90) {
        throw new Error(`--window-days must be 1..90, got "${argv[i]}"`);
      }
      args.windowDays = n;
    }
  }
  return args;
}

interface KolSnapshot {
  countryCode: string | null;
  categories: string[];
  followerCount: number;
  metadata: unknown;
}

export interface WeeklyReport {
  generatedAt: string;
  windowDays: number;
  total: number;
  addedThisWindow: number;
  byRegion: Record<string, number>;
  byCategory: Record<string, number>;
  anomalies: {
    suspicious_growth: number;
    declining: number;
  };
  followers: {
    median: number;
    max: number;
    min: number;
  };
  grade: "A" | "B" | "C" | "D";
}

export function summarize(rows: KolSnapshot[], windowDays: number): WeeklyReport {
  const generatedAt = new Date().toISOString();
  const cutoff = Date.now() - windowDays * 24 * 3600_000;
  const followerCounts = rows
    .map((r) => r.followerCount)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const median = followerCounts.length
    ? followerCounts[Math.floor(followerCounts.length / 2)]!
    : 0;

  const byRegion: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let addedThisWindow = 0;
  let suspiciousGrowth = 0;
  let declining = 0;

  for (const r of rows) {
    const region = r.countryCode ?? "(null)";
    byRegion[region] = (byRegion[region] ?? 0) + 1;
    for (const c of r.categories) {
      byCategory[c] = (byCategory[c] ?? 0) + 1;
    }
    const meta = r.metadata as
      | {
          seeded_at?: string;
          flags?: { suspicious_growth?: boolean; declining?: boolean };
        }
      | null;
    if (meta?.seeded_at) {
      const seededAt = new Date(meta.seeded_at).getTime();
      if (Number.isFinite(seededAt) && seededAt >= cutoff) {
        addedThisWindow += 1;
      }
    }
    if (meta?.flags?.suspicious_growth === true) suspiciousGrowth += 1;
    if (meta?.flags?.declining === true) declining += 1;
  }

  // Grading heuristic: based on anomaly rate over total. <1% A, 1-3% B,
  // 3-7% C, >7% D. A blank dataset grades A by convention.
  const anomalyRate = rows.length === 0 ? 0 : (suspiciousGrowth + declining) / rows.length;
  let grade: WeeklyReport["grade"] = "A";
  if (anomalyRate >= 0.07) grade = "D";
  else if (anomalyRate >= 0.03) grade = "C";
  else if (anomalyRate >= 0.01) grade = "B";

  return {
    generatedAt,
    windowDays,
    total: rows.length,
    addedThisWindow,
    byRegion,
    byCategory,
    anomalies: { suspicious_growth: suspiciousGrowth, declining },
    followers: {
      median,
      max: followerCounts.length ? followerCounts[followerCounts.length - 1]! : 0,
      min: followerCounts.length ? followerCounts[0]! : 0,
    },
    grade,
  };
}

export function formatMarkdown(report: WeeklyReport): string {
  const sortedRegion = Object.entries(report.byRegion)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);
  const sortedCategory = Object.entries(report.byCategory)
    .sort(([, a], [, b]) => b - a);

  const lines: string[] = [];
  lines.push(`# kol-quality weekly — ${report.generatedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Window: trailing ${report.windowDays} days`);
  lines.push(`- **Grade: ${report.grade}**`);
  lines.push("");
  lines.push("## Headline counts");
  lines.push(`- Total KOLs in tenant: ${report.total}`);
  lines.push(`- Added in window:      ${report.addedThisWindow}`);
  lines.push(`- Followers median:     ${report.followers.median.toLocaleString()}`);
  lines.push(`- Followers max:        ${report.followers.max.toLocaleString()}`);
  lines.push(`- Followers min:        ${report.followers.min.toLocaleString()}`);
  lines.push("");
  lines.push("## Anomalies (B6-F005 flags)");
  lines.push(`- suspicious_growth: ${report.anomalies.suspicious_growth}`);
  lines.push(`- declining:         ${report.anomalies.declining}`);
  lines.push("");
  lines.push("## Region distribution (top 15 by count)");
  lines.push("| country | count |");
  lines.push("|---|---:|");
  for (const [r, n] of sortedRegion) lines.push(`| ${r} | ${n} |`);
  lines.push("");
  lines.push("## Category distribution");
  lines.push("| category | count |");
  lines.push("|---|---:|");
  for (const [c, n] of sortedCategory) lines.push(`| ${c} | ${n} |`);
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-quality-weekly] starting (dryRun=${args.dryRun} windowDays=${args.windowDays})`
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[kol-quality-weekly] DATABASE_URL not set — exiting cleanly");
    process.exitCode = 0;
    return;
  }
  const tenantSlug = process.env.KOL_SYNC_DEMO_TENANT_SLUG ?? "demo";
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: conn }),
  });

  let report: WeeklyReport;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      throw new Error(`tenant not found: ${tenantSlug}`);
    }
    const rows = await prisma.kol.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: {
        countryCode: true,
        categories: true,
        followerCount: true,
        metadata: true,
      },
    });
    report = summarize(rows, args.windowDays);
  } catch (err) {
    console.error(
      `[kol-quality-weekly] fatal: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 0;
    return;
  } finally {
    await prisma.$disconnect();
  }

  const date = report.generatedAt.slice(0, 10);
  const path = resolve(
    __dirname,
    "..",
    `docs/test-reports/kol-quality-weekly-${date}.md`
  );
  if (args.dryRun) {
    console.log(`[kol-quality-weekly] DRY-RUN — would write ${path}`);
    console.log(formatMarkdown(report));
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatMarkdown(report), "utf8");
  console.log(`[kol-quality-weekly] DONE — ${path}`);
  console.log(
    `[kol-quality-weekly] grade=${report.grade} total=${report.total} added=${report.addedThisWindow} suspicious_growth=${report.anomalies.suspicious_growth} declining=${report.anomalies.declining}`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-quality-weekly] outer-guard: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 0;
  });
}
