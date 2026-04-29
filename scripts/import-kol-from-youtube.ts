/**
 * MVP-kol-seed-redo F003 · Import the YouTube-seeded JSON into the
 * `kol` table.
 *
 * Reads `docs/kol-seed-youtube-{date}.json` (output of F002), maps
 * each EnrichedChannel into the Prisma Kol shape, and upserts under
 * the demo tenant by (tenantId, platform, handle). Every row carries
 * `metadata.is_demo=true` plus per-row provenance so a single
 * `DELETE FROM kol WHERE metadata->>'is_demo'='true'` will retire the
 * seed when BL-012's crawler dataset arrives.
 *
 * Categories are derived from `topicCategories` via a static mapping
 * table — no AI call. The eight Wikipedia URLs YouTube actually
 * returns for gaming channels collapse onto seven KOLMatrix categories
 * (Action / Strategy / RPG / Sports / Casual / Racing / Esports).
 *
 * Usage:
 *   npm run import:kol-youtube                    (live, writes to DB)
 *   npm run import:kol-youtube:dry                (no DB writes)
 *   npm run import:kol-youtube -- --input <path>  (override JSON path)
 *
 * Env:
 *   DATABASE_ADMIN_URL or DATABASE_URL — same as seed-kol-from-enriched.ts
 */
import "dotenv/config";

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { computeKolValueScore } from "../src/lib/kol/value-score";

import type { EnrichedChannel } from "./seed-kol-from-youtube";

// ---------------------------------------------------------------------
// Mapping: YouTube Wikipedia topic URL → KOLMatrix category names.
// ---------------------------------------------------------------------

export const TOPIC_CATEGORY_MAP: Record<string, readonly string[]> = {
  Action_game: ["Action", "FPS"],
  "Action-adventure_game": ["Action", "Adventure"],
  Adventure_game: ["Adventure"],
  Casual_game: ["Casual"],
  Music_video_game: ["Casual"],
  Puzzle_video_game: ["Casual"],
  Racing_video_game: ["Racing"],
  "Role-playing_video_game": ["RPG"],
  Simulation_video_game: ["Simulation"],
  Sports_game: ["Sports"],
  Strategy_video_game: ["Strategy"],
  ESports: ["Esports"],
  Esports: ["Esports"],
  Video_game: ["Gaming"],
  Video_game_culture: ["Gaming"],
};

/** Default fallback when a channel exposes no recognised gaming topic. */
const DEFAULT_CATEGORIES: readonly string[] = ["Gaming"];

/**
 * Pure, fully tested. Walks every Wikipedia URL on the channel,
 * extracts the trailing slug, and unions the category names produced
 * by the mapping. Falls back to ['Gaming'] when no slug matches.
 */
export function deriveCategories(topicCategories: readonly string[]): string[] {
  const acc = new Set<string>();
  for (const url of topicCategories) {
    const slug = url.split("/").pop() ?? "";
    const mapped = TOPIC_CATEGORY_MAP[slug];
    if (mapped) for (const c of mapped) acc.add(c);
  }
  if (acc.size === 0) return [...DEFAULT_CATEGORIES];
  return Array.from(acc).sort();
}

// ---------------------------------------------------------------------
// Pure mapping: EnrichedChannel → Prisma Kol create/update payload.
// ---------------------------------------------------------------------

export interface KolRow {
  platform: string;
  handle: string;
  externalId: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
  avgViews: number | null;
  categories: string[];
  isGaming: boolean;
  // B5-F001 / F002 — promoted from metadata.youtube.* into dedicated
  // columns. New code (this seed import + the daily sync mapper) only
  // writes these; legacy rows keep their metadata.youtube.* payload
  // for historical reads (A2 — no double-write, see B5 spec §F002).
  channelCreatedAt: Date | null;
  videoCount: number | null;
  totalViewCount: bigint | null;
  bannerUrl: string | null;
  metadata: {
    is_demo: true;
    source: "youtube-api";
    seeded_at: string;
    matrix_region: string;
    matrix_keyword: string;
    /** Wikipedia topic URLs preserved here for the BL-012 crawler
     *  team to map against once their dataset lands. The other
     *  YouTube fields moved up to top-level columns above. */
    youtube: {
      channelId: string;
      topicCategories: string[];
      scrapedAt: string;
    };
  };
  valueScore: number;
}

/**
 * @param channel  one row from F002's docs/kol-seed-youtube-{date}.json
 * @param now      ISO string used for metadata.seeded_at — overridable
 *                 for tests so snapshots stay deterministic.
 */
export function mapToKolRow(
  channel: EnrichedChannel,
  now: string = new Date().toISOString()
): KolRow | null {
  // The matrix run already enforced `subscriberCount ≥ 10K`, but the
  // import is the second line of defence — handle is the unique key,
  // so we cannot create a row without one.
  const handle = channel.handle ?? `@${channel.id}`;
  if (!channel.id) return null;
  const avgViews =
    channel.videoCount > 0 ? Math.round(channel.viewCount / channel.videoCount) : null;
  const categories = deriveCategories(channel.topicCategories);
  const { total: valueScore } = computeKolValueScore({
    followerCount: channel.subscriberCount,
    categories,
  });
  // B5-F001 / F002 — column-side YouTube fields. publishedAt is an
  // ISO-8601 string from F002's seed JSON; convert to Date for the
  // @db.Timestamptz column. Invalid strings produce Invalid Date,
  // which we filter via isFinite on getTime().
  let channelCreatedAt: Date | null = null;
  if (channel.publishedAt) {
    const d = new Date(channel.publishedAt);
    if (Number.isFinite(d.getTime())) channelCreatedAt = d;
  }
  return {
    platform: "youtube",
    handle,
    externalId: channel.id,
    displayName: channel.title,
    bio: channel.description,
    avatarUrl: channel.thumbnailUrl,
    countryCode: channel.country,
    language: channel.defaultLanguage,
    followerCount: channel.subscriberCount,
    avgViews,
    categories,
    isGaming: true,
    channelCreatedAt,
    videoCount: channel.videoCount,
    totalViewCount: BigInt(channel.viewCount),
    bannerUrl: channel.bannerUrl,
    metadata: {
      is_demo: true,
      source: "youtube-api",
      seeded_at: now,
      matrix_region: channel.matrixRegion,
      matrix_keyword: channel.matrixKeyword,
      youtube: {
        channelId: channel.id,
        topicCategories: [...channel.topicCategories],
        scrapedAt: channel.scrapedAt,
      },
    },
    valueScore,
  };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

export interface CliArgs {
  dryRun: boolean;
  input?: string;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--input") {
      args.input = argv[++i];
    }
  }
  return args;
}

interface InputJson {
  channels: EnrichedChannel[];
}

function findLatestInputPath(): string {
  // Default to the most recent docs/kol-seed-youtube-*.json so callers
  // don't have to pass --input on the happy path.
  const dir = resolve(__dirname, "..", "docs");
  const candidates = readdirSync(dir)
    .filter((f) => /^kol-seed-youtube-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  if (candidates.length === 0) {
    throw new Error(
      "no docs/kol-seed-youtube-{date}.json found — run `npm run seed:kol-youtube` first or pass --input <path>"
    );
  }
  return resolve(dir, candidates[0]!);
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

export interface ImportStats {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Categories histogram so we can spot-check coverage. */
  categoriesHistogram: Record<string, number>;
}

export interface ImportClient {
  upsertKol(tenantId: string, row: KolRow, now: Date): Promise<"inserted" | "updated" | "skipped">;
}

export async function runImport(
  channels: EnrichedChannel[],
  tenantId: string,
  client: ImportClient,
  opts: { dryRun: boolean; now?: () => Date } = { dryRun: false }
): Promise<ImportStats> {
  const now = opts.now ?? (() => new Date());
  const stats: ImportStats = {
    total: channels.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    categoriesHistogram: {},
  };
  for (const ch of channels) {
    const row = mapToKolRow(ch, now().toISOString());
    if (!row) {
      stats.skipped += 1;
      continue;
    }
    for (const c of row.categories) {
      stats.categoriesHistogram[c] = (stats.categoriesHistogram[c] ?? 0) + 1;
    }
    if (opts.dryRun) {
      stats.inserted += 1;
      continue;
    }
    const result = await client.upsertKol(tenantId, row, now());
    stats[result] += 1;
  }
  return stats;
}

// ---------------------------------------------------------------------
// Real Prisma client wiring
// ---------------------------------------------------------------------

export function createPrismaImportClient(prisma: PrismaClient): ImportClient {
  return {
    async upsertKol(tenantId, row, now) {
      // Spec calls for dedupe by (tenantId, platform, externalId) —
      // YouTube channel.id is the permanent identifier; the handle is
      // mutable (creators rename their @customUrl) and would silently
      // create duplicate rows if used as the upsert key. The migration
      // 20260427230000_kol_external_id_unique adds the matching unique
      // constraint behind this lookup.
      const existing = await prisma.kol.findUnique({
        where: {
          tenantId_platform_externalId: {
            tenantId,
            platform: row.platform,
            externalId: row.externalId,
          },
        },
        select: { id: true, handle: true },
      });
      const data = {
        displayName: row.displayName,
        bio: row.bio,
        avatarUrl: row.avatarUrl,
        countryCode: row.countryCode,
        language: row.language,
        followerCount: row.followerCount,
        avgViews: row.avgViews,
        categories: row.categories,
        isGaming: row.isGaming,
        // Track the latest handle each pass — channels rename, and the
        // canonical column should follow.
        handle: row.handle,
        externalId: row.externalId,
        // B5-F001 / F002 — promoted from metadata.youtube.* (A2 — no
        // double-write).
        channelCreatedAt: row.channelCreatedAt,
        videoCount: row.videoCount,
        totalViewCount: row.totalViewCount,
        bannerUrl: row.bannerUrl,
        metadata: row.metadata,
        valueScore: row.valueScore,
        lastSyncedAt: now,
      };
      await prisma.kol.upsert({
        where: {
          tenantId_platform_externalId: {
            tenantId,
            platform: row.platform,
            externalId: row.externalId,
          },
        },
        create: {
          tenantId,
          platform: row.platform,
          ...data,
        },
        update: data,
      });
      return existing ? "updated" : "inserted";
    },
  };
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ? resolve(args.input) : findLatestInputPath();
  console.log(`[import-kol-youtube] reading ${inputPath}`);
  const data = JSON.parse(readFileSync(inputPath, "utf8")) as InputJson;
  console.log(`[import-kol-youtube] channels in input: ${data.channels.length}`);

  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set to run the import");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
    if (!tenant) {
      throw new Error(
        "demo tenant not found — run `npx prisma db seed` first to bootstrap the base tenant"
      );
    }
    const client = createPrismaImportClient(prisma);
    const stats = await runImport(data.channels, tenant.id, client, {
      dryRun: args.dryRun,
    });
    console.log(
      `\n[import-kol-youtube] DONE — total=${stats.total} inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped}`
    );
    console.log(`[import-kol-youtube] categories:`, stats.categoriesHistogram);
    if (args.dryRun) {
      console.log(`[import-kol-youtube] DRY-RUN (no DB writes)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[import-kol-youtube] fatal: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
