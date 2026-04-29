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
import { Prisma, type PrismaClient } from "@prisma/client";

import { computeKolValueScore } from "../kol/value-score";

import { checkQuality, type QualityFlags, type QualitySkipReason } from "./quality";
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
  // B5-F001 / F002 — promoted from metadata.youtube.*. New code only
  // writes these columns; legacy rows keep their metadata.youtube.*
  // payload for historical reads (A2 — no double-write, see B5 spec
  // §F002). bigint for totalViewCount because top channels exceed
  // INT32_MAX. Set to null for non-YouTube platforms or when the
  // adapter didn't surface a value.
  channelCreatedAt: Date | null;
  videoCount: number | null;
  totalViewCount: bigint | null;
  bannerUrl: string | null;
  metadata: {
    is_demo: boolean;
    source: string;
    seeded_at: string;
    matrix_region: string | null;
    matrix_keyword: string | null;
    /** F005 anomaly flags — `flags.suspicious_growth=true` rows are
     *  hidden by the Discovery / Database UI. Only present when at
     *  least one anomaly fires on the current pass. */
    flags?: QualityFlags;
    /** Wikipedia topic URLs preserved here for the BL-012 crawler
     *  team to map against once their dataset lands; keeping them in
     *  metadata avoids a second column for what is otherwise just
     *  source provenance. */
    youtube?: {
      topicCategories: string[];
      scrapedAt: string;
    };
  };
  valueScore: number;
}

export function mapToUpsertPayload(
  raw: RawKolData,
  opts: {
    source: string;
    isDemo: boolean;
    nowIso: string;
    /** F005 flags computed by checkQuality on the current row. When
     *  the verdict is empty (no anomaly), this stays undefined and
     *  metadata.flags doesn't get serialised — keeps the JSON tight
     *  for the 99% of normal rows. */
    flags?: QualityFlags;
  }
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
      ? ((raw.raw?.matrixRegion as string | null) ?? null)
      : null;
  const matrixKeyword =
    typeof raw.raw?.matrixKeyword === "string" || raw.raw?.matrixKeyword === null
      ? ((raw.raw?.matrixKeyword as string | null) ?? null)
      : null;
  // B5-F001 / F002 — column-side YouTube fields. publishedAt comes
  // through as an ISO-8601 string from the adapter; convert to Date for
  // the @db.Timestamptz column. Invalid strings produce Invalid Date,
  // so we skip those by checking isFinite on getTime().
  let channelCreatedAt: Date | null = null;
  if (raw.platform === "youtube" && raw.publishedAt) {
    const d = new Date(raw.publishedAt);
    if (Number.isFinite(d.getTime())) channelCreatedAt = d;
  }
  const videoCount =
    raw.platform === "youtube" && typeof raw.videoCount === "number" ? raw.videoCount : null;
  const totalViewCount =
    raw.platform === "youtube" &&
    typeof raw.viewCount === "number" &&
    Number.isFinite(raw.viewCount)
      ? BigInt(raw.viewCount)
      : null;
  const bannerUrl = raw.platform === "youtube" ? (raw.bannerUrl ?? null) : null;
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
    channelCreatedAt,
    videoCount,
    totalViewCount,
    bannerUrl,
    metadata: {
      is_demo: opts.isDemo,
      source: opts.source,
      seeded_at: opts.nowIso,
      matrix_region: matrixRegion,
      matrix_keyword: matrixKeyword,
      ...(opts.flags && Object.keys(opts.flags).length > 0 ? { flags: opts.flags } : {}),
      youtube:
        raw.platform === "youtube"
          ? {
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
  /** Per-skip-reason counter so the daily report shows what the
   *  quality module rejected. */
  skippedByReason: Partial<Record<QualitySkipReason, number>>;
  /** Rows that were kept but ended up flagged by F005 anomaly
   *  detection. Counted once per fired flag. */
  flaggedByKind: Partial<Record<keyof QualityFlags, number>>;
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
    skippedByReason: {},
    flaggedByKind: {},
    categoriesHistogram: {},
  };
  for (const raw of raws) {
    if (!raw.externalId) {
      stats.skipped += 1;
      stats.skippedByReason["missing-id"] = (stats.skippedByReason["missing-id"] ?? 0) + 1;
      continue;
    }
    // Look the existing row up first — quality checks need
    // (followerCount, lastSyncedAt) to compute growth / decline flags.
    const existing = await prisma.kol.findUnique({
      where: {
        tenantId_platform_externalId: {
          tenantId: opts.tenantId,
          platform: raw.platform,
          externalId: raw.externalId,
        },
      },
      select: { id: true, followerCount: true, lastSyncedAt: true },
    });

    const nowDate = now();
    const verdict = checkQuality(
      raw,
      existing
        ? { followerCount: existing.followerCount, lastSyncedAt: existing.lastSyncedAt }
        : null,
      nowDate
    );

    if (!verdict.keep) {
      stats.skipped += 1;
      stats.skippedByReason[verdict.reason] = (stats.skippedByReason[verdict.reason] ?? 0) + 1;
      continue;
    }

    const nowIso = nowDate.toISOString();
    const payload = mapToUpsertPayload(raw, {
      source: opts.source,
      isDemo: opts.isDemo,
      nowIso,
      flags: verdict.flags,
    });
    if (!payload) {
      stats.skipped += 1;
      continue;
    }
    for (const c of payload.categories) {
      stats.categoriesHistogram[c] = (stats.categoriesHistogram[c] ?? 0) + 1;
    }
    for (const flag of Object.keys(verdict.flags) as Array<keyof QualityFlags>) {
      stats.flaggedByKind[flag] = (stats.flaggedByKind[flag] ?? 0) + 1;
    }
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
      // B5-F001 / F002 — promoted from metadata.youtube.*. Existing
      // rows from before this batch keep NULL here until the
      // enrich-kol-from-youtube one-shot script (or the next daily
      // sync) backfills them.
      channelCreatedAt: payload.channelCreatedAt,
      videoCount: payload.videoCount,
      totalViewCount: payload.totalViewCount,
      bannerUrl: payload.bannerUrl,
      // Prisma's InputJsonObject requires an index signature; the
      // narrowly-typed QualityFlags doesn't satisfy that purely
      // structurally, so widen at the boundary.
      metadata: payload.metadata as unknown as Prisma.InputJsonValue,
      // F005 canonical "hide me from Discovery / Database" bit.
      // Audit trail stays in metadata.flags; this column is what
      // buildKolWhere reads.
      isSuspicious: verdict.flags.suspicious_growth === true,
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
