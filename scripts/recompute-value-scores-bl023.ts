/**
 * BL-023 one-shot · recompute valueScore for KOL with real engagement_rate.
 *
 * Replays the new computeKolValueScore (BL-023-F001/F002) over every
 * KOL whose engagement_rate >= 1 (i.e. the seed 12 + the BL-023-F008
 * backfilled 126 = 138 rows in prod as of 2026-05-07). Equivalent to
 * what tomorrow morning's kol-sync-daily cron would do for any KOL that
 * happens to be in its top-100 batch — but immediate, scoped, and
 * zero YouTube quota.
 *
 * Usage:
 *   # local (against any DB the env vars point at)
 *   npx tsx scripts/recompute-value-scores-bl023.ts --dry-run
 *   npx tsx scripts/recompute-value-scores-bl023.ts
 *
 *   # prod (recommended invocation — DATABASE_ADMIN_URL bypasses RLS)
 *   ssh tripplezhou@34.180.93.185
 *   cd /opt/kolmatrix
 *   set -a && source .env.production && set +a
 *   DATABASE_ADMIN_URL="$DATABASE_ADMIN_URL" npx tsx scripts/recompute-value-scores-bl023.ts --dry-run
 *   DATABASE_ADMIN_URL="$DATABASE_ADMIN_URL" npx tsx scripts/recompute-value-scores-bl023.ts
 *
 * One-shot: delete this file after both prod + staging have been
 * recomputed (same convention as scripts/admin-reset-password.ts).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { computeKolValueScore } from "../src/lib/kol/value-score";

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  return { dryRun: argv.includes("--dry-run") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[recompute] DATABASE_URL / DATABASE_ADMIN_URL not set");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: conn }),
  });

  console.log(`[recompute] mode=${args.dryRun ? "DRY-RUN" : "WRITE"} — fetching KOL with engagement_rate >= 1 ...`);

  const kols = await prisma.kol.findMany({
    where: {
      engagementRate: { gte: 1 },
      deletedAt: null,
    },
    select: {
      id: true,
      handle: true,
      followerCount: true,
      categories: true,
      engagementRate: true,
      engagementAuthenticity: true,
      valueScore: true,
    },
    orderBy: { valueScore: "desc" },
  });

  console.log(`[recompute] candidates: ${kols.length} KOL`);

  const buckets = new Map<string, number>();
  const deltaBuckets = new Map<string, number>();
  let totalDelta = 0;
  let unchanged = 0;
  let written = 0;
  let writeFailed = 0;
  const samples: Array<{
    handle: string;
    rate: number;
    before: number | null;
    after: number;
    delta: number;
  }> = [];

  for (const k of kols) {
    const rateNum = k.engagementRate == null ? null : Number(k.engagementRate.toString());
    const { total } = computeKolValueScore({
      followerCount: k.followerCount ?? 0,
      categories: k.categories ?? [],
      engagementRate: rateNum,
      engagementAuthenticity: k.engagementAuthenticity,
    });
    const before = k.valueScore;
    const delta = before == null ? total : total - before;

    if (before === total) unchanged += 1;
    totalDelta += delta;

    // Bucket the new score for distribution print
    const decade = `${Math.floor(total / 10) * 10}-${Math.floor(total / 10) * 10 + 9}`;
    buckets.set(decade, (buckets.get(decade) ?? 0) + 1);

    // Bucket the delta
    const dKey =
      delta === 0
        ? " 0"
        : delta > 0
          ? `+${delta < 5 ? "1-4" : delta < 10 ? "5-9" : delta < 20 ? "10-19" : "20+"}`
          : `-${-delta < 5 ? "1-4" : -delta < 10 ? "5-9" : -delta < 20 ? "10-19" : "20+"}`;
    deltaBuckets.set(dKey, (deltaBuckets.get(dKey) ?? 0) + 1);

    if (samples.length < 5 && rateNum != null) {
      samples.push({
        handle: k.handle,
        rate: rateNum,
        before,
        after: total,
        delta,
      });
    }

    if (!args.dryRun) {
      try {
        await prisma.kol.update({
          where: { id: k.id },
          data: { valueScore: total },
        });
        written += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[recompute] update ${k.id} (${k.handle}) failed: ${msg.slice(0, 200)}`);
        writeFailed += 1;
      }
    }
  }

  console.log("");
  console.log("=== Distribution of new valueScore (decade buckets) ===");
  const sortedBuckets = Array.from(buckets.entries()).sort((a, b) =>
    Number(a[0].split("-")[0]) - Number(b[0].split("-")[0])
  );
  for (const [k, v] of sortedBuckets) console.log(`  ${k.padStart(7)}: ${v}`);

  console.log("");
  console.log("=== Delta vs current valueScore ===");
  const sortedDelta = Array.from(deltaBuckets.entries()).sort();
  for (const [k, v] of sortedDelta) console.log(`  ${k.padStart(7)}: ${v}`);

  console.log("");
  console.log("=== Samples (top 5 by current valueScore) ===");
  for (const s of samples) {
    console.log(
      `  ${s.handle.padEnd(28)} rate=${s.rate.toFixed(2)}% before=${String(s.before ?? "null").padStart(3)} → after=${String(s.after).padStart(3)} (Δ${s.delta >= 0 ? "+" : ""}${s.delta})`
    );
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`  total candidates: ${kols.length}`);
  console.log(`  unchanged:        ${unchanged}`);
  console.log(`  avg delta:        ${(totalDelta / kols.length).toFixed(2)}`);
  if (!args.dryRun) {
    console.log(`  written:          ${written}`);
    console.log(`  write_failed:     ${writeFailed}`);
  } else {
    console.log(`  (dry-run — no DB writes)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`[recompute] fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
