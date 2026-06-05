/**
 * BL-083-F006 · One-shot `kol.emails` backfill from `metadata.raw.emails`.
 *
 * The fork unlocked ~219 YouTube business emails and KOLMatrix retained
 * them only inside `metadata.raw.emails` (untyped JSONB, unreachable by
 * business logic). F001 makes the live mapper surface new ones into the
 * `kol.emails` column going forward; this script promotes the ALREADY
 * stored ones for existing rows so the UI / outreach see them immediately.
 *
 * Pure DB-only — no fork call, no LLM. A single SQL UPDATE copies
 * `metadata->'raw'->'emails'` into `kol.emails` and stamps
 * `email_source='business-unlock'` for the matched rows.
 *
 * Idempotent: the predicate requires `emails IS NULL`, so a second run
 * touches 0 rows and never overwrites an already-filled value (nor the
 * legacy single `email` column — only NULL `emails` rows are touched).
 *
 * Usage:
 *   npx tsx scripts/kol-emails-backfill.ts --dry-run
 *   npx tsx scripts/kol-emails-backfill.ts
 *   npx tsx scripts/kol-emails-backfill.ts --tenant=<uuid>
 *
 * Env: DATABASE_ADMIN_URL (preferred) or DATABASE_URL.
 * Exit 0 always (operator reads report); exit 1 on missing env / tenant.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export interface EmailsBackfillArgs {
  dryRun: boolean;
  tenantId: string | null;
}

export function parseArgs(argv: readonly string[]): EmailsBackfillArgs {
  const args: EmailsBackfillArgs = { dryRun: false, tenantId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a.startsWith("--tenant=")) args.tenantId = a.slice("--tenant=".length);
    else if (a === "--tenant") args.tenantId = argv[++i] ?? null;
  }
  return args;
}

/**
 * Shared row predicate for both the dry-run COUNT and the apply UPDATE so
 * the "how many would change" and "how many did change" can never drift.
 * `$1` is the tenant id.
 *   - youtube only (the only platform with a fork business-email actor)
 *   - metadata.raw.emails present, a JSON array, and non-empty
 *   - emails column still NULL (idempotency + never clobber)
 */
export const EMAILS_BACKFILL_WHERE = `
  WHERE tenant_id = $1::uuid
    AND platform = 'youtube'
    AND metadata -> 'raw' -> 'emails' IS NOT NULL
    AND jsonb_typeof(metadata -> 'raw' -> 'emails') = 'array'
    AND jsonb_array_length(metadata -> 'raw' -> 'emails') > 0
    AND emails IS NULL
`;

export interface EmailsBackfillDeps {
  prisma: {
    $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
    $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  };
  tenantId: string;
  dryRun: boolean;
  logger?: (msg: string) => void;
}

export interface EmailsBackfillResult {
  eligible: number; // rows the predicate matches (would be / were updated)
  updated: number; // rows actually written (0 in dry-run)
  dryRun: boolean;
}

export async function runEmailsBackfill(
  deps: EmailsBackfillDeps,
): Promise<EmailsBackfillResult> {
  const log = deps.logger ?? (() => {});

  const countRows = (await deps.prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS count FROM kol ${EMAILS_BACKFILL_WHERE}`,
    deps.tenantId,
  )) as Array<{ count: unknown }> | undefined;
  const eligible = Number(countRows?.[0]?.count ?? 0);

  let updated = 0;
  if (!deps.dryRun && eligible > 0) {
    updated = Number(
      await deps.prisma.$executeRawUnsafe(
        `UPDATE kol
            SET emails = metadata -> 'raw' -> 'emails',
                email_source = 'business-unlock'
          ${EMAILS_BACKFILL_WHERE}`,
        deps.tenantId,
      ),
    );
  }

  log(
    `[emails-backfill] eligible=${eligible} updated=${updated} dryRun=${deps.dryRun}`,
  );
  return { eligible, updated, dryRun: deps.dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-emails-backfill] starting (dryRun=${args.dryRun} tenant=${args.tenantId ?? "demo"})`,
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[kol-emails-backfill] DATABASE_URL not set, refusing to run");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });

  try {
    const tenantSlug = process.env.KOL_SYNC_DEMO_TENANT_SLUG ?? "demo";
    let tenantId = args.tenantId;
    if (!tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        console.error(`[kol-emails-backfill] tenant not found: ${tenantSlug}`);
        process.exitCode = 1;
        return;
      }
      tenantId = tenant.id;
    }

    const result = await runEmailsBackfill({
      prisma,
      tenantId,
      dryRun: args.dryRun,
      logger: (m) => console.log(m),
    });

    console.log("");
    console.log("== BL-083-F006 kol.emails backfill report ==");
    console.log(`dryRun:   ${result.dryRun}`);
    console.log(`eligible: ${result.eligible}`);
    console.log(`updated:  ${result.updated}`);
    if (result.dryRun) {
      console.log("(dry-run — no rows written. Re-run without --dry-run to apply.)");
    } else {
      console.log("(idempotent — re-running updates 0 additional rows.)");
    }
  } catch (err) {
    console.error(
      `[kol-emails-backfill] fatal: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-emails-backfill] outer-guard: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  });
}
