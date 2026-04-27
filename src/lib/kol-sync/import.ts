/**
 * B6-kol-daily-sync F003 · RawKolData → Prisma Kol writer.
 *
 * Mirrors `scripts/import-kol-from-youtube.ts` for kol-seed-redo, but
 * (a) consumes the platform-agnostic `RawKolData` shape produced by
 * any KolSyncAdapter, and (b) writes B6 daily-specific metadata
 * (`is_demo: false`, `source: 'youtube-api-daily'` / etc.) so a
 * future BL-012 cleanup can scope by source string.
 *
 * Unique key: `(tenantId, platform, externalId)` — the kol-seed-redo
 * fix-round 1 added that constraint, F003 here just relies on it.
 */
import type { PrismaClient } from "@prisma/client";

import { computeKolValueScore } from "../kol/value-score";

import type { RawKolData } from "./types";

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

const DEFAULT_CATEGORIES: readonly string[] = ["Gaming"];

export function deriveCategories(topicCategories: readonly string[] | undefined): string[] {
  const acc = new Set<string>();
  for (const url of topicCategories ?? []) {
    const slug = url.split("/").pop() ?? "";
    const mapped = TOPIC_CATEGORY_MAP[slug];
    if (mapped) for (const c of mapped) acc.add(c);
  }
  if (acc.size === 0) return [...DEFAULT_CATEGORIES];
  return Array.from(acc).sort();
}

// ---------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------

export interface ImportOpts {
  tenantId: string;
  /** Goes into `metadata.source`. `'youtube-api-daily'` for the B6
   *  cron; future adapters carry their own tag. */
  source: string;
  /** `metadata.is_demo` flag — `true` for one-shot seed crawls, `false`
   *  for live cron-driven rows. */
  isDemo: boolean;
  /** Wall clock — overridable for tests so snapshots stay stable. */
  now?: () => Date;
}

export interface KolUpsertPayload {
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
  metadata: {
    is_demo: boolean;
    source: string;
    seeded_at: string;
    matrix_region: string | null;
    matrix_keyword: string | null;
    youtube?: {
      videoCount: number | null;
      totalViewCount: number | null;
      channelCreatedAt: string | null;
      bannerUrl: string | null;
      topicCategories: string[];
      scrapedAt: string;
    };
  };
  valueScore: number;
}

export function mapToUpsertPayload(
  raw: RawKolData,
  opts: { source: string; isDemo: boolean; nowIso: string }
): KolUpsertPayload | null {
  if (!raw.externalId) return null;
  const handle = raw.handle ?? `@${raw.externalId}`;
  const avgViews =
    raw.videoCount && raw.videoCount > 0 && raw.viewCount != null
      ? Math.round(raw.viewCount / raw.videoCount)
      : null;
  const categories = deriveCategories(raw.topicCategories);
  const { total: valueScore } = computeKolValueScore({
    followerCount: raw.subscriberCount,
    categories,
  });
  const matrixRegion =
    typeof raw.raw?.matrixRegion === "string" || raw.raw?.matrixRegion === null
      ? (raw.raw?.matrixRegion as string | null) ?? null
      : null;
  const matrixKeyword =
    typeof raw.raw?.matrixKeyword === "string" || raw.raw?.matrixKeyword === null
      ? (raw.raw?.matrixKeyword as string | null) ?? null
      : null;
  return {
    platform: raw.platform,
    handle,
    externalId: raw.externalId,
    displayName: raw.displayName,
    bio: raw.description ?? "",
    avatarUrl: raw.thumbnailUrl ?? null,
    countryCode: raw.country ?? null,
    language: raw.language ?? null,
    followerCount: raw.subscriberCount,
    avgViews,
    categories,
    isGaming: true,
    metadata: {
      is_demo: opts.isDemo,
      source: opts.source,
      seeded_at: opts.nowIso,
      matrix_region: matrixRegion,
      matrix_keyword: matrixKeyword,
      youtube:
        raw.platform === "youtube"
          ? {
              videoCount: raw.videoCount ?? null,
              totalViewCount: raw.viewCount ?? null,
              channelCreatedAt: raw.publishedAt ?? null,
              bannerUrl: raw.bannerUrl ?? null,
              topicCategories: [...(raw.topicCategories ?? [])],
              scrapedAt: raw.scrapedAt,
            }
          : undefined,
    },
    valueScore,
  };
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

export interface ImportStats {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Per-category histogram for the dashboard report. */
  categoriesHistogram: Record<string, number>;
}

export async function importRawKolData(
  prisma: PrismaClient,
  raws: readonly RawKolData[],
  opts: ImportOpts
): Promise<ImportStats> {
  const now = opts.now ?? (() => new Date());
  const stats: ImportStats = {
    total: raws.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    categoriesHistogram: {},
  };
  for (const raw of raws) {
    const nowIso = now().toISOString();
    const payload = mapToUpsertPayload(raw, {
      source: opts.source,
      isDemo: opts.isDemo,
      nowIso,
    });
    if (!payload) {
      stats.skipped += 1;
      continue;
    }
    for (const c of payload.categories) {
      stats.categoriesHistogram[c] = (stats.categoriesHistogram[c] ?? 0) + 1;
    }
    const existing = await prisma.kol.findUnique({
      where: {
        tenantId_platform_externalId: {
          tenantId: opts.tenantId,
          platform: payload.platform,
          externalId: payload.externalId,
        },
      },
      select: { id: true },
    });
    const data = {
      displayName: payload.displayName,
      bio: payload.bio,
      avatarUrl: payload.avatarUrl,
      countryCode: payload.countryCode,
      language: payload.language,
      followerCount: payload.followerCount,
      avgViews: payload.avgViews,
      categories: payload.categories,
      isGaming: payload.isGaming,
      handle: payload.handle,
      externalId: payload.externalId,
      metadata: payload.metadata,
      valueScore: payload.valueScore,
      lastSyncedAt: now(),
    };
    await prisma.kol.upsert({
      where: {
        tenantId_platform_externalId: {
          tenantId: opts.tenantId,
          platform: payload.platform,
          externalId: payload.externalId,
        },
      },
      create: { tenantId: opts.tenantId, platform: payload.platform, ...data },
      update: data,
    });
    if (existing) stats.updated += 1;
    else stats.inserted += 1;
  }
  return stats;
}
