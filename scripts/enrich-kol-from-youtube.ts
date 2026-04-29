/**
 * B5-kol-data-enrichment F002 · One-shot enrich script.
 *
 * Backfills the four B5-F001 columns (channelCreatedAt / videoCount /
 * totalViewCount / bannerUrl) on every existing YouTube-platform KOL
 * by calling YouTube Data API channels.list in 50-id batches.
 *
 * Cost: 1 unit per channels.list call. ~1000 KOL ÷ 50 ids/call = 20
 * units (≈ 0.2% of the 10,000 daily free quota). The script is
 * idempotent — re-running just rewrites the same values, so it's safe
 * to invoke after every batch import or whenever a column drifts.
 *
 * The legacy metadata.youtube.* payload is left in place for historical
 * reads (A2 — no double-write, see B5 spec §F002). Going forward, the
 * daily sync mapper (src/lib/kol-sync/import.ts) and the seed import
 * mapper (scripts/import-kol-from-youtube.ts) only write the dedicated
 * columns; this script's role is the one-shot backfill for rows that
 * landed before B5 ever shipped.
 *
 * engagementRate is intentionally NOT touched here — the F004 detail
 * page lazy-loads search.list + videos.list to compute the true
 * engagement rate (likes+comments / views) and writes it back. Channel-
 * level statistics doesn't carry the per-video data needed for a useful
 * estimate, so this script leaves engagement_rate untouched whether
 * NULL or whatever value the BM1 valueScore path wrote earlier.
 *
 * Usage:
 *   npm run enrich:kol-youtube                 (live; writes to DB)
 *   npm run enrich:kol-youtube:dry             (no DB writes)
 *   npm run enrich:kol-youtube -- --tenant <slug>   (limit to one tenant)
 *
 * Env:
 *   YOUTUBE_API_KEY       required for live runs
 *   DATABASE_ADMIN_URL    preferred; falls back to DATABASE_URL
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { youtube_v3 } from "googleapis";

import {
  createYoutubeClient,
  type YoutubeClient,
} from "./seed-kol-from-youtube";

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

export interface CliArgs {
  dryRun: boolean;
  tenantSlug?: string;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--tenant") {
      args.tenantSlug = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------
// Pure mapper — googleapis Channel → column updates.
//
// Unlike the daily-sync adapter (src/lib/kol-sync/adapters/youtube.ts),
// this enrich path does NOT re-apply the discover filters (min subs,
// gaming-topic, description-non-empty). The KOLs are already in the DB
// — we just want to refresh their YouTube facts. Filtering here would
// silently leave rows un-enriched whenever a channel slipped below the
// threshold since seed time, which is exactly the bug we want to avoid.
// ---------------------------------------------------------------------

export interface EnrichmentUpdate {
  channelCreatedAt: Date | null;
  videoCount: number | null;
  totalViewCount: bigint | null;
  bannerUrl: string | null;
}

export function mapToEnrichmentUpdate(
  raw: youtube_v3.Schema$Channel
): EnrichmentUpdate {
  const stats = raw.statistics ?? {};
  const snippet = raw.snippet ?? {};
  const branding = raw.brandingSettings ?? {};

  let channelCreatedAt: Date | null = null;
  if (snippet.publishedAt) {
    const d = new Date(snippet.publishedAt);
    if (Number.isFinite(d.getTime())) channelCreatedAt = d;
  }

  const videoCount = parseIntOrNull(stats.videoCount);
  const totalViewCount = parseBigIntOrNull(stats.viewCount);
  const bannerUrl = branding.image?.bannerExternalUrl ?? null;

  return { channelCreatedAt, videoCount, totalViewCount, bannerUrl };
}

function parseIntOrNull(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBigIntOrNull(
  v: string | number | null | undefined
): bigint | null {
  if (v == null) return null;
  try {
    if (typeof v === "number") {
      return Number.isFinite(v) ? BigInt(Math.trunc(v)) : null;
    }
    return BigInt(v);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------

export interface EnrichStats {
  totalKols: number;
  fetched: number;
  updated: number;
  notFoundUpstream: number;
  errored: number;
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

export interface EnrichClient {
  /** Channels-only fetcher; mirrors the YoutubeClient.fetchChannels
   *  shape so unit tests can stub without pulling in the full adapter. */
  fetchChannels(ids: string[]): Promise<youtube_v3.Schema$Channel[]>;
}

export interface EnrichDeps {
  prisma: Pick<
    PrismaClient,
    "kol" | "tenant" | "$disconnect" | "$transaction"
  >;
  client: EnrichClient;
  tenantSlug?: string;
  dryRun: boolean;
  /** Wall-clock override so snapshots stay deterministic in tests. */
  now?: () => Date;
}

export async function runEnrich(deps: EnrichDeps): Promise<EnrichStats> {
  const stats: EnrichStats = {
    totalKols: 0,
    fetched: 0,
    updated: 0,
    notFoundUpstream: 0,
    errored: 0,
  };
  const where: Record<string, unknown> = {
    platform: "youtube",
    externalId: { not: null },
    deletedAt: null,
  };
  if (deps.tenantSlug) {
    const tenant = await deps.prisma.tenant.findUnique({
      where: { slug: deps.tenantSlug },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error(`tenant not found: ${deps.tenantSlug}`);
    }
    where.tenantId = tenant.id;
  }

  const kols = await deps.prisma.kol.findMany({
    where,
    select: { id: true, externalId: true },
  });
  stats.totalKols = kols.length;
  if (kols.length === 0) return stats;

  const externalIds = kols
    .map((k) => k.externalId)
    .filter((id): id is string => Boolean(id));
  const idToKolId = new Map<string, string>();
  for (const k of kols) {
    if (k.externalId) idToKolId.set(k.externalId, k.id);
  }

  // channels.list batches up to 50 ids per call.
  const batchSize = 50;
  const updatedAt = deps.now ? deps.now() : new Date();
  for (let i = 0; i < externalIds.length; i += batchSize) {
    const slice = externalIds.slice(i, i + batchSize);
    let channels: youtube_v3.Schema$Channel[];
    try {
      channels = await deps.client.fetchChannels(slice);
    } catch (err) {
      stats.errored += slice.length;
      console.error(
        `[enrich-kol-youtube] batch fetch failed (${slice.length} ids):`,
        err
      );
      continue;
    }
    stats.fetched += channels.length;
    const returnedIds = new Set(channels.map((c) => c.id ?? ""));
    stats.notFoundUpstream += slice.length - returnedIds.size;

    if (deps.dryRun) {
      // In dry mode, just log and skip writes.
      for (const ch of channels) {
        if (!ch.id) continue;
        const update = mapToEnrichmentUpdate(ch);
        console.log(
          `[dry-run] ${ch.id} videoCount=${update.videoCount} totalViewCount=${update.totalViewCount} bannerUrl=${
            update.bannerUrl ? "(set)" : "(null)"
          } channelCreatedAt=${update.channelCreatedAt?.toISOString() ?? "(null)"}`
        );
      }
      continue;
    }

    for (const ch of channels) {
      if (!ch.id) continue;
      const kolId = idToKolId.get(ch.id);
      if (!kolId) continue;
      const update = mapToEnrichmentUpdate(ch);
      try {
        await deps.prisma.kol.update({
          where: { id: kolId },
          data: {
            channelCreatedAt: update.channelCreatedAt,
            videoCount: update.videoCount,
            totalViewCount: update.totalViewCount,
            bannerUrl: update.bannerUrl,
            lastSyncedAt: updatedAt,
          },
        });
        stats.updated += 1;
      } catch (err) {
        stats.errored += 1;
        console.error(
          `[enrich-kol-youtube] update failed for ${kolId} (${ch.id}):`,
          err
        );
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[enrich-kol-youtube] YOUTUBE_API_KEY is not set");
    process.exit(1);
  }
  const connectionString =
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "[enrich-kol-youtube] DATABASE_ADMIN_URL / DATABASE_URL is not set"
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  // Cast: createYoutubeClient returns a YoutubeClient with searchChannels
  // + fetchChannels; we only need the latter. Narrow at the boundary.
  const ytClient: YoutubeClient = createYoutubeClient(apiKey);
  const enrichClient: EnrichClient = {
    fetchChannels: (ids) => ytClient.fetchChannels(ids),
  };

  console.log(
    `[enrich-kol-youtube] start ${args.dryRun ? "(dry-run)" : ""} tenant=${args.tenantSlug ?? "<all>"}`
  );
  const stats = await runEnrich({
    prisma,
    client: enrichClient,
    tenantSlug: args.tenantSlug,
    dryRun: args.dryRun,
  });

  console.log(`[enrich-kol-youtube] totals:`, stats);
  if (!args.dryRun && stats.totalKols > 0) {
    // Compute fill-rate per the F002 acceptance criterion (≥ 95% on
    // staging Kol after enrichment).
    const filled = await prisma.kol.count({
      where: {
        platform: "youtube",
        externalId: { not: null },
        deletedAt: null,
        videoCount: { not: null },
      },
    });
    const pct = stats.totalKols > 0 ? (filled / stats.totalKols) * 100 : 0;
    console.log(
      `[enrich-kol-youtube] videoCount fill-rate: ${filled}/${stats.totalKols} = ${pct.toFixed(1)}%`
    );
  }

  await prisma.$disconnect();
}

// `tsx scripts/enrich-kol-from-youtube.ts` invokes main; the
// `import.meta.url === ...` guard mirrors the pattern in
// scripts/import-kol-from-youtube.ts so unit tests can import the
// pure functions without firing the orchestrator.
if (
  process.argv[1] &&
  (process.argv[1].endsWith("/enrich-kol-from-youtube.ts") ||
    process.argv[1].endsWith("/enrich-kol-from-youtube.js"))
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
