/**
 * B7a-F001 · One-time KOL/Product embedding backfill.
 *
 * Reads every Kol/Product row that has no embedding yet (or whose
 * source-text hash drifted) and embeds them in batches via aigcgateway
 * bge-m3. Idempotent — re-running after success is a no-op (every row
 * has a matching hash).
 *
 * Usage:
 *   npm run kol-embed:backfill            # run on prod URL by default
 *   npm run kol-embed:backfill -- --dry   # dry-run, no API + no writes
 *   npm run kol-embed:backfill -- --kol-only
 *   npm run kol-embed:backfill -- --product-only
 *
 * Env requirements:
 *   - AIGCGATEWAY_BASE_URL / AIGCGATEWAY_API_KEY
 *   - DATABASE_ADMIN_URL (preferred) or DATABASE_URL
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  embedAllKols,
  embedProductIfStale,
} from "../src/lib/embedding/kol-embed";

interface CliArgs {
  dry: boolean;
  kolOnly: boolean;
  productOnly: boolean;
  batchSize: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dry: false,
    kolOnly: false,
    productOnly: false,
    batchSize: 100,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry" || a === "--dry-run") args.dry = true;
    else if (a === "--kol-only") args.kolOnly = true;
    else if (a === "--product-only") args.productOnly = true;
    else if (a === "--batch-size") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1 || n > 1000) {
        throw new Error(`--batch-size must be 1..1000, got "${argv[i]}"`);
      }
      args.batchSize = n;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-embed-backfill] starting (dry=${args.dry} batch=${args.batchSize}` +
      ` kolOnly=${args.kolOnly} productOnly=${args.productOnly})`
  );

  if (args.dry) {
    console.log("[kol-embed-backfill] DRY-RUN: would scan + embed; exiting");
    process.exitCode = 0;
    return;
  }

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[kol-embed-backfill] DATABASE_URL not set, refusing to run");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: conn }),
  });

  try {
    if (!args.productOnly) {
      console.log("[kol-embed-backfill] embedding KOLs ...");
      const kolStats = await embedAllKols(prisma, { batchSize: args.batchSize });
      console.log(
        `[kol-embed-backfill] KOL done: scanned=${kolStats.scanned}` +
          ` skipped=${kolStats.skipped} embedded=${kolStats.embedded}` +
          ` failed=${kolStats.failed} batches=${kolStats.batches}` +
          ` tokens=${kolStats.promptTokens}` +
          ` cost=$${kolStats.estimatedCostUsd.toFixed(6)}`
      );
    }

    if (!args.kolOnly) {
      console.log("[kol-embed-backfill] embedding Products ...");
      // Pull all product ids and let embedProductIfStale dedupe via hash.
      const ids = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "product"`
      );
      let totalEmbedded = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let totalTokens = 0;
      let totalCost = 0;
      // Per-product loop is one API call each; throttle to keep us
      // under the 30 RPM gateway cap (audit footnote — discovered
      // 2026-04-28 during staging backfill, RPM cap was undocumented
      // up to this point).
      for (let i = 0; i < ids.length; i += 1) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2_500));
        const s = await embedProductIfStale(prisma, ids[i]!.id);
        totalEmbedded += s.embedded;
        totalSkipped += s.skipped;
        totalFailed += s.failed;
        totalTokens += s.promptTokens;
        totalCost += s.estimatedCostUsd;
      }
      console.log(
        `[kol-embed-backfill] Product done: scanned=${ids.length}` +
          ` skipped=${totalSkipped} embedded=${totalEmbedded}` +
          ` failed=${totalFailed} tokens=${totalTokens}` +
          ` cost=$${totalCost.toFixed(6)}`
      );
    }
  } catch (err) {
    console.error(
      `[kol-embed-backfill] fatal: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-embed-backfill] outer-guard: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 1;
  });
}
