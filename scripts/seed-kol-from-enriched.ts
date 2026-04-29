/**
 * BM1-F002 · KOL seed from AI-enriched JSON.
 *
 * Source: docs/kol-seed-enriched-final.json (2,524 rows, 415 gaming +
 * 2,109 non-gaming, AI-tagged by a two-stage pipeline).
 *
 * Target: the "demo" tenant created in prisma/seed.ts. This script is
 * intentionally separate from the base seed so the B0 Stitch demo KOLs
 * and the enriched real-world KOLs can be rolled in / out independently.
 *
 * Field mapping (per BM1-F002 spec + 2026-04-23 pre-impl adjudication):
 *   platform   "Youtube"        → normalizePlatform() → "youtube"
 *   url        ".../@handle"     → handle
 *   name       string            → display_name
 *   region     中文              → ISO-2 via REGION_MAP
 *   followers  number            → follower_count
 *   is_gaming  bool              → isGaming
 *   categories string[]          → Kol.categories (free-text array)
 *   confidence "high"|"medium"|"low" → aiTagConfidence
 *   (computed) valueScore        → computeKolValueScore().total (0-100)
 *   (computed) aiTaggedAt        → now
 *
 * Idempotency: upsert on (tenantId, platform, handle). Re-running is
 * a no-op in terms of row count.
 *
 * Run:  npm run seed:kol
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizePlatform } from "../src/lib/kol/platform";
import { computeKolValueScore } from "../src/lib/kol/value-score";

const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set to run the seed");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ENRICHED_JSON_PATH = resolve(process.cwd(), "docs/kol-seed-enriched-final.json");

const REGION_MAP: Record<string, string> = {
  美国: "US",
  英国: "GB",
  巴基斯坦: "PK",
  加拿大: "CA",
  德国: "DE",
  越南: "VN",
  台湾: "TW",
  乌克兰: "UA",
  日本: "JP",
  伊拉克: "IQ",
  多米尼加共和国: "DO",
};

interface EnrichedKol {
  idx: number;
  platform: string;
  name: string;
  url: string;
  region: string;
  followers: number;
  is_gaming: boolean;
  categories: string[];
  confidence: "high" | "medium" | "low";
  reasoning?: string;
  stage?: string;
}

interface EnrichedJson {
  total: number;
  gaming_count_final: number;
  results: EnrichedKol[];
}

function parseHandle(url: string): string | null {
  // YouTube channel URLs in this dataset always look like
  //   https://www.youtube.com/@<handle>
  // Reject anything that does not match so row-count invariants stay clean.
  const match = url.match(/\/@([^/?#]+)/);
  return match ? match[1]! : null;
}

interface SeedStats {
  total: number;
  inserted: number;
  updated: number;
  skippedInvalidUrl: number;
  skippedInvalidPlatform: number;
  skippedUnmappedRegion: number;
  gaming: number;
}

export async function runSeed(): Promise<SeedStats> {
  const raw = await readFile(ENRICHED_JSON_PATH, "utf8");
  const data = JSON.parse(raw) as EnrichedJson;

  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) {
    throw new Error(
      "demo tenant not found — run `npx prisma db seed` first to bootstrap the base tenant"
    );
  }

  const now = new Date();
  const stats: SeedStats = {
    total: data.results.length,
    inserted: 0,
    updated: 0,
    skippedInvalidUrl: 0,
    skippedInvalidPlatform: 0,
    skippedUnmappedRegion: 0,
    gaming: 0,
  };

  for (const row of data.results) {
    const platform = normalizePlatform(row.platform);
    if (!platform) {
      stats.skippedInvalidPlatform += 1;
      continue;
    }

    const handle = parseHandle(row.url);
    if (!handle) {
      stats.skippedInvalidUrl += 1;
      continue;
    }

    const countryCode = REGION_MAP[row.region];
    if (row.region && !countryCode) {
      stats.skippedUnmappedRegion += 1;
      continue;
    }

    const { total: valueScore } = computeKolValueScore({
      followerCount: row.followers,
      categories: row.categories,
    });

    const existing = await prisma.kol.findUnique({
      where: {
        tenantId_platform_handle: {
          tenantId: tenant.id,
          platform,
          handle,
        },
      },
      select: { id: true },
    });

    await prisma.kol.upsert({
      where: {
        tenantId_platform_handle: {
          tenantId: tenant.id,
          platform,
          handle,
        },
      },
      update: {
        displayName: row.name,
        countryCode,
        followerCount: row.followers,
        categories: row.categories,
        isGaming: row.is_gaming,
        aiTagConfidence: row.confidence,
        aiTaggedAt: now,
        valueScore,
      },
      create: {
        tenantId: tenant.id,
        platform,
        handle,
        displayName: row.name,
        countryCode,
        followerCount: row.followers,
        categories: row.categories,
        isGaming: row.is_gaming,
        aiTagConfidence: row.confidence,
        aiTaggedAt: now,
        valueScore,
      },
    });

    if (existing) stats.updated += 1;
    else stats.inserted += 1;
    if (row.is_gaming) stats.gaming += 1;
  }

  return stats;
}

async function main() {
  const stats = await runSeed();
  console.log("[seed:kol] done", stats);
}

// Only auto-run when invoked as a script — keep exports tree-shakeable
// for tests that import runSeed() directly.
if (process.argv[1] && process.argv[1].includes("seed-kol-from-enriched")) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
