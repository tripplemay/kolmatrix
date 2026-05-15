/**
 * BL-067-F002 · Per-day cron: delete BL-067 explanation cache rows older
 * than 24h. Avoids unbounded growth of the `asset` table over the batch's
 * lifetime (decision point #2 = pre-warm top 30 × 5 locale × N campaigns
 * per day → 150 rows/day/campaign).
 *
 * Scope strictly limited to the two enum values introduced by F002:
 *   - ai_recommendation_explanation_short
 *   - ai_recommendation_explanation_detailed
 * Other AssetType rows (email, video_script) are untouched.
 *
 * Schedule: 06:30 BJT (22:30 UTC) via `.github/workflows/cron-cleanup-explanation-assets.yml`,
 * choosing the gap between the kol-sync-daily 04:00-06:00 BJT window and
 * any future maintenance jobs (per F001 audit §5:A discussion).
 *
 * Run path:
 *   npx tsx scripts/cleanup-expired-explanation-assets.ts [--dry-run]
 *
 * The script uses the admin Prisma client (no withTenant pin) because:
 *   (a) RLS would otherwise restrict deletes to a single tenant per call,
 *       multiplying the cron count by N tenants
 *   (b) The WHERE filter is type-scoped to BL-067 rows only, so there is
 *       no cross-tenant data risk — every row touched is BL-067 cache,
 *       and we delete only those past TTL.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const TTL_MS = 24 * 60 * 60 * 1000;
const EXPLANATION_TYPES = [
  "ai_recommendation_explanation_short",
  "ai_recommendation_explanation_detailed",
] as const;

interface CliArgs {
  dryRun: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[cleanup] DATABASE_URL missing — set in .env before running");
    process.exit(1);
  }
  // Use the admin role connection (DATABASE_URL = kolmatrix superuser) so we
  // bypass RLS and delete across all tenants in a single pass.
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const expireBefore = new Date(Date.now() - TTL_MS);
    const whereClause = {
      type: { in: [...EXPLANATION_TYPES] },
      createdAt: { lt: expireBefore },
    };

    if (args.dryRun) {
      const count = await prisma.asset.count({ where: whereClause });
      console.log(
        `[cleanup] DRY RUN — would delete ${count} expired explanation assets (createdAt < ${expireBefore.toISOString()})`,
      );
    } else {
      const result = await prisma.asset.deleteMany({ where: whereClause });
      console.log(
        `[cleanup] deleted ${result.count} expired explanation assets (createdAt < ${expireBefore.toISOString()})`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[cleanup] failed:", err);
  process.exit(1);
});
