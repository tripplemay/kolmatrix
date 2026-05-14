/**
 * BL-066-F007 / BL-048 · Recompute KOL.value_score with formula v2.
 *
 * Per Planner audit verdict #4=B (TS script over pure SQL) + #5=A (single
 * platform-level audit event with row_count + sample_diffs ≤200).
 *
 * Fetches every active KOL, recomputes value_score by calling the same
 * `computeKolValueScore()` function used at insert-time (zero dual-source
 * drift), UPDATEs per row, and finishes with one logAudit() event.
 *
 * Usage:
 *   ENV=staging npx tsx scripts/bl066-f007-recompute-value-score.ts --env staging
 *   ENV=prod    npx tsx scripts/bl066-f007-recompute-value-score.ts --env prod
 *   (add --dry-run to skip UPDATEs and audit write)
 *
 * Per audit §4.2: avoid the 04:00-06:00 BJT cron window (scripts/kol-sync-daily.ts
 * runs in that window; the daily sync writes fresh rows with the NEW formula
 * — no conflict — but parallel UPDATEs against the same rows create lock churn).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

import { computeKolValueScore } from "../src/lib/kol/value-score";

interface CliArgs {
  dryRun: boolean;
  env: "staging" | "prod" | "local";
  sampleLimit: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, env: "local", sampleLimit: 200 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--env") {
      const v = argv[++i];
      if (v !== "staging" && v !== "prod" && v !== "local") {
        throw new Error(`--env must be staging|prod|local, got "${v}"`);
      }
      args.env = v;
    } else if (a === "--sample-limit") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        throw new Error(`--sample-limit must be 0..1000, got "${argv[i]}"`);
      }
      args.sampleLimit = n;
    }
  }
  return args;
}

interface KolRow {
  id: string;
  handle: string;
  followerCount: number;
  engagementRate: Prisma.Decimal | null;
  categories: string[];
  engagementAuthenticity: number | null;
  valueScore: number | null;
}

interface RecomputeStats {
  rowCount: number;
  minBefore: number | null;
  maxBefore: number | null;
  minAfter: number;
  maxAfter: number;
  unchanged: number;
  sampleDiffs: Array<{
    id: string;
    handle: string;
    followerCount: number;
    engagementRate: number | null;
    before: number | null;
    after: number;
  }>;
}

function decimalToNumber(d: Prisma.Decimal | null): number | null {
  if (d == null) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[bl066-f007-recompute] starting (env=${args.env} dryRun=${args.dryRun} sampleLimit=${args.sampleLimit})`
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[bl066-f007-recompute] DATABASE_URL not set — abort");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });

  try {
    // 1. Resolve admin user UUID for audit actorId (per Planner #5=A shape).
    const adminEmail = process.env.RECOMPUTE_ADMIN_EMAIL ?? "admin@kolmatrix.local";
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      console.error(
        `[bl066-f007-recompute] admin user '${adminEmail}' not found — abort (recompute audit must be traceable)`
      );
      process.exitCode = 1;
      return;
    }
    console.log(`[bl066-f007-recompute] audit actorId=${admin.id} (${adminEmail})`);

    // 2. Fetch all active KOLs (admin role bypasses RLS).
    const rows = (await prisma.kol.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        handle: true,
        followerCount: true,
        engagementRate: true,
        categories: true,
        engagementAuthenticity: true,
        valueScore: true,
      },
    })) as KolRow[];
    console.log(`[bl066-f007-recompute] fetched ${rows.length} KOL rows`);

    if (rows.length === 0) {
      console.warn("[bl066-f007-recompute] no KOL rows to recompute — early exit");
      return;
    }

    // 3. Loop + recompute + UPDATE per row. Track stats.
    const stats: RecomputeStats = {
      rowCount: rows.length,
      minBefore: null,
      maxBefore: null,
      minAfter: Number.POSITIVE_INFINITY,
      maxAfter: Number.NEGATIVE_INFINITY,
      unchanged: 0,
      sampleDiffs: [],
    };

    let processed = 0;
    const startedAt = Date.now();
    for (const r of rows) {
      const rate = decimalToNumber(r.engagementRate);
      const result = computeKolValueScore({
        followerCount: r.followerCount,
        categories: r.categories ?? [],
        engagementRate: rate,
        engagementAuthenticity: r.engagementAuthenticity,
      });
      const after = result.total;
      const before = r.valueScore;

      if (before != null) {
        stats.minBefore = stats.minBefore == null ? before : Math.min(stats.minBefore, before);
        stats.maxBefore = stats.maxBefore == null ? before : Math.max(stats.maxBefore, before);
      }
      stats.minAfter = Math.min(stats.minAfter, after);
      stats.maxAfter = Math.max(stats.maxAfter, after);
      if (before === after) stats.unchanged += 1;

      if (stats.sampleDiffs.length < args.sampleLimit) {
        stats.sampleDiffs.push({
          id: r.id,
          handle: r.handle,
          followerCount: r.followerCount,
          engagementRate: rate,
          before,
          after,
        });
      }

      if (!args.dryRun && before !== after) {
        await prisma.kol.update({ where: { id: r.id }, data: { valueScore: after } });
      }

      processed += 1;
      if (processed % 200 === 0) {
        console.log(
          `[bl066-f007-recompute] progress: ${processed}/${rows.length} (${(
            (Date.now() - startedAt) /
            1000
          ).toFixed(1)}s)`
        );
      }
    }

    console.log(
      `[bl066-f007-recompute] DONE (${processed}/${rows.length} in ${(
        (Date.now() - startedAt) /
        1000
      ).toFixed(1)}s; unchanged=${stats.unchanged})`
    );
    console.log(
      `[bl066-f007-recompute] before: min=${stats.minBefore} max=${stats.maxBefore} | after: min=${stats.minAfter} max=${stats.maxAfter}`
    );

    // 4. Verify top-15 quantitative criterion (per Planner #7=B):
    //    (a) range max-min >= 5 (not all tied at 100)
    //    (b) ordering check — log top-15 for signoff inspection.
    const top15 = await prisma.kol.findMany({
      where: { deletedAt: null },
      select: { id: true, handle: true, followerCount: true, valueScore: true },
      orderBy: { valueScore: "desc" },
      take: 15,
    });
    console.log(`[bl066-f007-recompute] top-15 after recompute:`);
    for (const k of top15) {
      console.log(
        `  ${k.valueScore}  ${k.handle}  followers=${k.followerCount.toLocaleString()}`
      );
    }
    const scores = top15.map((k) => k.valueScore).filter((v): v is number => v != null);
    const range = scores.length > 0 ? Math.max(...scores) - Math.min(...scores) : 0;
    console.log(
      `[bl066-f007-recompute] top-15 valueScore range = ${range} (Planner #7=B requires >= 5)`
    );
    if (range < 5) {
      console.warn(
        `[bl066-f007-recompute] WARNING: top-15 range < 5 — Planner #7=B acceptance not met`
      );
    }

    // 5. Single platform-level audit event (per Planner #5=A shape).
    if (!args.dryRun) {
      const payload = {
        formula_version: "v2",
        env: args.env,
        row_count: stats.rowCount,
        unchanged: stats.unchanged,
        min_before: stats.minBefore,
        max_before: stats.maxBefore,
        min_after: stats.minAfter,
        max_after: stats.maxAfter,
        top15_range: range,
        sample_diffs: stats.sampleDiffs,
      };
      await prisma.auditLog.create({
        data: {
          tenantId: null,
          actorUserId: admin.id,
          action: "value_score.recompute_v2",
          resourceType: "kol",
          resourceId: "__bulk_recompute__",
          payload: payload as Prisma.InputJsonValue,
        },
      });
      console.log(
        `[bl066-f007-recompute] audit_log row written (action=value_score.recompute_v2 env=${args.env} row_count=${stats.rowCount})`
      );
    } else {
      console.log(`[bl066-f007-recompute] DRY-RUN — skipping UPDATE + audit_log`);
    }
  } catch (err) {
    console.error(
      `[bl066-f007-recompute] fatal: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[bl066-f007-recompute] outer-guard: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 1;
  });
}
