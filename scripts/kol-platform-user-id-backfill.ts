/**
 * BL-082-F002 · One-shot `platform_user_id` backfill.
 *
 * BL-082-F001 added the `platform_user_id` column + made the mapper
 * persist the fork's `platformUserId`, but existing rows (synced before
 * F001) have it NULL. The daily refresh phase (F003) keys on
 * `<platform>:<platform_user_id>`, so without this backfill only rows
 * re-discovered after F001 ships would be refreshable.
 *
 * Strategy: walk the fork's discover feed per platform via the
 * `ApifyKolSyncAdapter` (which now maps `platformUserId`), match each
 * item to an existing KOL row by `external_id = String(item.id)`, and
 * stamp `platform_user_id`. Pure read-from-fork + DB UPDATE — no LLM.
 *
 * Idempotent: the UPDATE's WHERE includes `platform_user_id IS NULL`, so
 * a second run touches 0 rows and never overwrites an existing value.
 *
 * Usage:
 *   npx tsx scripts/kol-platform-user-id-backfill.ts --dry-run
 *   npx tsx scripts/kol-platform-user-id-backfill.ts
 *   npx tsx scripts/kol-platform-user-id-backfill.ts --tenant=<uuid>
 *
 * Env: DATABASE_ADMIN_URL (preferred) or DATABASE_URL, plus
 * APIFY_KOL_BASE_URL + APIFY_KOL_BUSINESS_API_KEY (fork read API).
 * Exit 0 always (operator reads report); exit 1 on missing env.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { ApifyKolSyncAdapter } from "../src/lib/kol-sync/adapters/apify-kol";

export interface PuidBackfillArgs {
  dryRun: boolean;
  tenantId: string | null;
}

export function parseArgs(argv: readonly string[]): PuidBackfillArgs {
  const args: PuidBackfillArgs = { dryRun: false, tenantId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a.startsWith("--tenant=")) args.tenantId = a.slice("--tenant=".length);
    else if (a === "--tenant") args.tenantId = argv[++i] ?? null;
  }
  return args;
}

export const BACKFILL_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;

/** One discovered candidate: the fork row id + its platform-native id. */
export interface DiscoveredPuid {
  externalId: string;
  platformUserId: string | null;
  platform: string;
}

export interface PuidBackfillDeps {
  /** Narrow Prisma surface (fake-able in tests). */
  prisma: {
    $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  };
  /** Walk the fork discover feed for one platform → candidates. */
  discover: (platform: string) => Promise<DiscoveredPuid[]>;
  tenantId: string;
  platforms?: readonly string[];
  dryRun: boolean;
  logger?: (msg: string) => void;
}

export interface PuidBackfillResult {
  scanned: number; // discovered candidates with a non-null platformUserId
  updated: number; // rows actually stamped (0 in dry-run)
  perPlatform: Record<string, { scanned: number; updated: number }>;
  dryRun: boolean;
}

export async function runPlatformUserIdBackfill(
  deps: PuidBackfillDeps,
): Promise<PuidBackfillResult> {
  const log = deps.logger ?? (() => {});
  const platforms = deps.platforms ?? BACKFILL_PLATFORMS;
  const result: PuidBackfillResult = {
    scanned: 0,
    updated: 0,
    perPlatform: {},
    dryRun: deps.dryRun,
  };

  for (const platform of platforms) {
    const candidates = await deps.discover(platform);
    let scanned = 0;
    let updated = 0;
    for (const c of candidates) {
      // Only rows the fork gives us a platform-native id for are useful;
      // the mapper already null-guards empty strings.
      if (!c.platformUserId) continue;
      scanned += 1;
      if (deps.dryRun) continue;
      // Idempotent: only fill NULL, never overwrite. Match by the fork
      // row id (external_id) within the tenant + platform.
      const n = await deps.prisma.$executeRawUnsafe(
        `UPDATE kol SET platform_user_id = $1
         WHERE tenant_id = $2::uuid AND platform = $3
           AND external_id = $4 AND platform_user_id IS NULL`,
        c.platformUserId,
        deps.tenantId,
        c.platform,
        c.externalId,
      );
      updated += Number(n);
    }
    result.perPlatform[platform] = { scanned, updated };
    result.scanned += scanned;
    result.updated += updated;
    log(
      `[puid-backfill] platform=${platform} discovered=${candidates.length} with_puid=${scanned} stamped=${updated}`,
    );
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-platform-user-id-backfill] starting (dryRun=${args.dryRun} tenant=${args.tenantId ?? "demo"})`,
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const apifyBase = process.env.APIFY_KOL_BASE_URL;
  const apifyKey = process.env.APIFY_KOL_BUSINESS_API_KEY;
  if (!conn) {
    console.error("[kol-platform-user-id-backfill] DATABASE_URL not set, refusing to run");
    process.exitCode = 1;
    return;
  }
  if (!apifyBase || !apifyKey) {
    console.error(
      "[kol-platform-user-id-backfill] APIFY_KOL_BASE_URL / APIFY_KOL_BUSINESS_API_KEY missing",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });
  const adapter = new ApifyKolSyncAdapter({ baseUrl: apifyBase, apiKey: apifyKey });

  try {
    const tenantSlug = process.env.KOL_SYNC_DEMO_TENANT_SLUG ?? "demo";
    let tenantId = args.tenantId;
    if (!tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        console.error(`[kol-platform-user-id-backfill] tenant not found: ${tenantSlug}`);
        process.exitCode = 1;
        return;
      }
      tenantId = tenant.id;
    }

    const result = await runPlatformUserIdBackfill({
      prisma,
      discover: async (platform) => {
        const rows = await adapter.discover({ region: platform });
        return rows.map((r) => ({
          externalId: r.externalId,
          platformUserId: r.platformUserId ?? null,
          platform: r.platform,
        }));
      },
      tenantId,
      dryRun: args.dryRun,
      logger: (m) => console.log(m),
    });

    console.log("");
    console.log("== BL-082-F002 platform_user_id backfill report ==");
    console.log(`dryRun:   ${result.dryRun}`);
    console.log(`scanned (with platformUserId): ${result.scanned}`);
    console.log(`stamped:  ${result.updated}`);
    for (const [p, s] of Object.entries(result.perPlatform)) {
      console.log(`  ${p}: scanned=${s.scanned} stamped=${s.updated}`);
    }
    if (result.dryRun) {
      console.log("(dry-run — no rows written. Re-run without --dry-run to apply.)");
    } else {
      console.log("(idempotent — re-running stamps 0 additional rows.)");
    }
  } catch (err) {
    console.error(
      `[kol-platform-user-id-backfill] fatal: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-platform-user-id-backfill] outer-guard: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  });
}
