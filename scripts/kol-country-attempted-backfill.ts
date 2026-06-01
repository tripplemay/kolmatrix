/**
 * BL-081-F005 · One-shot `country_enrichment_attempted_at` backfill.
 *
 * Stamps `country_enrichment_attempted_at = NOW()` on every existing KOL
 * that has a NULL/blank `country_code` and has never been marked. This
 * is the immediate kill-switch for the silent LLM retry storm (BL-081
 * root cause R3): without it, the ~2081 country-NULL prod rows would
 * each need to be picked up by the daily enrichment stage once before
 * F003's gate excludes them — i.e. the storm would taper over days
 * rather than stop at once. Stamping them in one UPDATE makes the daily
 * `enrichKolsForTenant` scan skip them immediately (the F003 gate:
 * `country_enrichment_attempted_at IS NULL OR last_synced_at > it`).
 *
 * Pure DB UPDATE — NO LLM calls, so it costs ~$0 and runs in one query.
 * A row only re-enters the enrichment scan when it is later re-synced
 * (last_synced_at moves past the stamped marker), giving it exactly one
 * fresh attempt instead of a daily retry.
 *
 * Idempotent: the WHERE includes `country_enrichment_attempted_at IS
 * NULL`, so a second run updates 0 rows and never overwrites an existing
 * marker (BL-081 invariant §2.3 #3 / F005 acceptance).
 *
 * Usage:
 *   npx tsx scripts/kol-country-attempted-backfill.ts --dry-run
 *   npx tsx scripts/kol-country-attempted-backfill.ts
 *   npx tsx scripts/kol-country-attempted-backfill.ts --tenant=<uuid>
 *
 * Env: DATABASE_ADMIN_URL (preferred) or DATABASE_URL. No aigcgateway
 * env needed — this script never calls the LLM.
 *
 * Exit code 0 always (operator reads the report), except exit 1 when
 * DATABASE_URL is missing so deploy automation surfaces the misconfig.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export interface BackfillArgs {
  dryRun: boolean;
  tenantId: string | null;
}

export function parseArgs(argv: readonly string[]): BackfillArgs {
  const args: BackfillArgs = { dryRun: false, tenantId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") {
      args.dryRun = true;
    } else if (a.startsWith("--tenant=")) {
      args.tenantId = a.slice("--tenant=".length);
    } else if (a === "--tenant") {
      args.tenantId = argv[++i] ?? null;
    }
  }
  return args;
}

export interface BackfillResult {
  /** Rows matching the backfill predicate before applying. */
  eligible: number;
  /** Rows actually stamped (0 in dry-run, == eligible on a fresh apply,
   *  0 on a second idempotent run). */
  updated: number;
  dryRun: boolean;
}

/**
 * Minimal Prisma surface the backfill needs — kept narrow so unit tests
 * can supply a fake without standing up a testcontainer.
 */
export interface BackfillPrisma {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

// Shared predicate: country-NULL/blank, not-yet-attempted, live rows that
// the enrichment stage would otherwise scan (matches enrichment-stage's
// deleted_at / is_suspicious filters so we stamp exactly the storm set).
const PREDICATE = `
  deleted_at IS NULL
  AND is_suspicious = false
  AND (country_code IS NULL OR length(btrim(country_code)) = 0)
  AND country_enrichment_attempted_at IS NULL
`;

export async function runCountryAttemptedBackfill(
  prisma: BackfillPrisma,
  args: BackfillArgs,
): Promise<BackfillResult> {
  const params: unknown[] = [];
  let tenantClause = "";
  if (args.tenantId) {
    tenantClause = " AND tenant_id = $1::uuid ";
    params.push(args.tenantId);
  }

  const countRows = await prisma.$queryRawUnsafe<Array<{ eligible: number }>>(
    `SELECT COUNT(*)::int AS eligible FROM kol WHERE ${PREDICATE} ${tenantClause}`,
    ...params,
  );
  const eligible = Number(countRows[0]?.eligible ?? 0);

  if (args.dryRun) {
    return { eligible, updated: 0, dryRun: true };
  }

  // DB-side NOW() so the stamp is a single consistent server timestamp,
  // independent of the client clock.
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE kol SET country_enrichment_attempted_at = NOW() WHERE ${PREDICATE} ${tenantClause}`,
    ...params,
  );

  return { eligible, updated: Number(updated), dryRun: false };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-country-attempted-backfill] starting (dryRun=${args.dryRun}` +
      ` tenant=${args.tenantId ?? "ALL"})`,
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error(
      "[kol-country-attempted-backfill] DATABASE_URL not set, refusing to run",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: conn }),
  });

  try {
    const result = await runCountryAttemptedBackfill(prisma, args);
    console.log("");
    console.log("== BL-081-F005 country-attempted backfill report ==");
    console.log(`dryRun:   ${result.dryRun}`);
    console.log(`tenant:   ${args.tenantId ?? "ALL"}`);
    console.log(`eligible: ${result.eligible} (country NULL/blank, attempted_at NULL, live)`);
    console.log(`stamped:  ${result.updated}`);
    if (result.dryRun) {
      console.log(
        "(dry-run — no rows written. Re-run without --dry-run to apply.)",
      );
    } else {
      console.log(
        "(idempotent — re-running stamps 0 additional rows; existing markers untouched.)",
      );
    }
  } catch (err) {
    console.error(
      `[kol-country-attempted-backfill] fatal: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-country-attempted-backfill] outer-guard: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  });
}
