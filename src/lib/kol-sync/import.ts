/**
 * RawKolData → Prisma Kol writer.
 *
 * (a) consumes the platform-agnostic `RawKolData` shape produced by
 * any KolSyncAdapter, and (b) writes adapter-specific metadata
 * (`is_demo: false`, `source: 'apify-kol'` / etc.) so downstream
 * cleanups can scope by source string.
 *
 * Unique key: `(tenantId, platform, externalId)` — the kol-seed-redo
 * fix-round 1 added that constraint; this writer just relies on it.
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

/** BL-083-F003 — email_source value for emails the fork unlocked via its
 *  YouTube business-email Apify actor. The only source the mapper emits
 *  today (bio-regex provenance lives on the 6 legacy `kol.email` rows and
 *  is stamped by F006's backfill, not the live sync path). */
export const EMAIL_SOURCE_BUSINESS_UNLOCK = "business-unlock";

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
  /** Goes into `metadata.source`. Each adapter carries its own tag
   *  (e.g. `'apify-kol'` for the daily fork sync). */
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
  /** BL-082-F001 — platform-native user id for the refresh endpoint. */
  platformUserId: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
  avgViews: number | null;
  /** BL-059 F001 — engagement_rate carried through from the adapter
   *  (apify-kol derives it; sources that don't surface engagement leave
   *  it undefined and the Kol row's column stays untouched). */
  engagementRate: number | null | undefined;
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
  /** BL-083-F003 — business emails surfaced by the F001 mapper from the
   *  fork's `emails: string[]`. Null when the mapper didn't fill it. The
   *  import path writes this onto `kol.emails` (JSONB, F002) ONLY when
   *  non-empty, so a daily refresh where the fork omits emails never
   *  clobbers a previously-unlocked value (same write-only-when-present
   *  discipline as engagementRate). The legacy single `kol.email` column
   *  is never written here — BL-031's 6 bio-regex rows stay put. */
  emails: string[] | null;
  /** BL-083-F003 — provenance for `emails`. 'business-unlock' when the
   *  fork unlocked them via its YT Apify actor (the only source the
   *  mapper produces today). Null when `emails` is null. */
  emailSource: string | null;
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
  // BL-083-F003 — promote the mapper's sanitised business emails. Treat a
  // null OR empty array the same ("mapper didn't fill it"): no write, so
  // the update path can't wipe a previously-unlocked value.
  const emails = raw.emails && raw.emails.length > 0 ? raw.emails : null;
  const emailSource = emails ? EMAIL_SOURCE_BUSINESS_UNLOCK : null;
  // BL-076-F002: promote raw.engagement_outlier (set by apify-kol when
  // the raw engagement_rate exceeds 100%) into metadata.flags so the
  // discovery UI / analytics can filter view-based-proxy noise. Only
  // emit the key when the adapter computes it — adapters that leave
  // raw.engagement_outlier undefined (e.g. deprecated YouTube path)
  // keep the historical metadata.flags shape untouched.
  const mergedFlags: QualityFlags | undefined =
    raw.engagement_outlier !== undefined
      ? { ...(opts.flags ?? {}), engagement_outlier: raw.engagement_outlier }
      : opts.flags;
  return {
    platform: raw.platform,
    handle,
    externalId: raw.externalId,
    platformUserId: raw.platformUserId ?? null,
    displayName: raw.displayName,
    bio: raw.description ?? "",
    avatarUrl: raw.thumbnailUrl ?? null,
    countryCode: raw.country ?? null,
    language: raw.language ?? null,
    followerCount: raw.subscriberCount,
    avgViews,
    engagementRate: raw.engagement_rate,
    categories,
    isGaming: true,
    channelCreatedAt,
    videoCount,
    totalViewCount,
    bannerUrl,
    emails,
    emailSource,
    metadata: {
      is_demo: opts.isDemo,
      source: opts.source,
      seeded_at: opts.nowIso,
      matrix_region: matrixRegion,
      matrix_keyword: matrixKeyword,
      ...(mergedFlags && Object.keys(mergedFlags).length > 0 ? { flags: mergedFlags } : {}),
      youtube:
        raw.platform === "youtube"
          ? {
              topicCategories: [...(raw.topicCategories ?? [])],
              scrapedAt: raw.scrapedAt,
            }
          : undefined,
      // BL-059 F002: preserve the adapter's raw payload for apify-kol
      // so SQL backfills (engagement_rate / future 4-dim score
      // recomputes) and the admin preview can read upstream fields
      // without re-fetching. Other sources keep the existing shape —
      // YouTube already had its own metadata.youtube nest.
      ...(opts.source === "apify-kol" && raw.raw ? { raw: raw.raw } : {}),
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
  /** BL-076-F003 — rows that survived quality.checkQuality + passed
   *  mapToUpsertPayload but threw inside `prisma.kol.upsert(...)`
   *  (e.g. numeric overflow, unique-constraint race, downstream
   *  trigger failure). Each failure is also surfaced into
   *  `audit_log.kol.import_failed` with the offending payload so
   *  forensic search by externalId / displayName works without
   *  re-scraping. Started life as the response to the 5/12-5/26 prod
   *  outage where one bad engagement_rate row aborted the entire
   *  batch via the missing try/catch. */
  failed: number;
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
    failed: 0,
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
      nowDate,
      { source: opts.source }
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
      // BL-059 F001 — only write engagementRate when the adapter
      // surfaced one. Adapters that leave it undefined preserve the
      // existing column value (lets BL-023 backfills + manual edits
      // survive a daily refresh that doesn't re-derive).
      ...(payload.engagementRate !== undefined
        ? { engagementRate: payload.engagementRate }
        : {}),
      categories: payload.categories,
      isGaming: payload.isGaming,
      handle: payload.handle,
      externalId: payload.externalId,
      // BL-082-F001 — persist platform-native id for the refresh phase.
      platformUserId: payload.platformUserId,
      // B5-F001 / F002 — promoted from metadata.youtube.*. Existing
      // rows from before this batch keep NULL here until the
      // enrich-kol-from-youtube one-shot script (or the next daily
      // sync) backfills them.
      channelCreatedAt: payload.channelCreatedAt,
      videoCount: payload.videoCount,
      totalViewCount: payload.totalViewCount,
      bannerUrl: payload.bannerUrl,
      // BL-083-F003 — write the fork-unlocked business emails + provenance
      // ONLY when the mapper surfaced a non-empty array. Omitting the keys
      // on an empty result means a daily refresh that returns no emails
      // leaves an already-unlocked `kol.emails` untouched (and never writes
      // the legacy `kol.email` scalar — the 6 bio-regex rows stay put).
      ...(payload.emails && payload.emails.length > 0
        ? {
            emails: payload.emails as unknown as Prisma.InputJsonValue,
            emailSource: payload.emailSource,
          }
        : {}),
      // Prisma's InputJsonObject requires an index signature; the
      // narrowly-typed QualityFlags doesn't satisfy that purely
      // structurally, so widen at the boundary.
      metadata: payload.metadata as unknown as Prisma.InputJsonValue,
      // F005 canonical "hide me from Discovery / Database" bit.
      // Audit trail stays in metadata.flags; this column is what
      // buildKolWhere reads.
      isSuspicious: verdict.flags.suspicious_growth === true,
      valueScore: payload.valueScore,
      lastSyncedAt: nowDate,
      // BL-081-F003 — when the fork mapper supplied a country (YouTube
      // `location` → ISO alpha-2 via normalizeCountryName, F001), stamp
      // the country-enrichment-attempted marker at sync time so the daily
      // LLM enrichment scan skips this KOL: it already has a country, no
      // LLM call needed. KOLs without a mapper country (TikTok /
      // Instagram leave `location` absent) keep the marker untouched and
      // stay eligible for the enrichment stage's one-shot LLM attempt.
      // Shares `nowDate` with lastSyncedAt so the enrichment-stage gate
      // (`last_synced_at > country_enrichment_attempted_at`) stays false
      // and the row is reliably excluded.
      ...(payload.countryCode
        ? { countryEnrichmentAttemptedAt: nowDate }
        : {}),
    };
    try {
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
    } catch (err) {
      // BL-076-F003: per-row try/catch so a single bad upsert (e.g.
      // numeric field overflow, unique-key race) can't abort the whole
      // batch. The 5/12-5/26 prod outage was a single engagement_rate
      // overflow tripping this exact code path with no catch — 14
      // consecutive daily-sync runs returned inserted=0.
      stats.failed += 1;
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[kol-sync/import] upsert failed for ${payload.platform}/${payload.externalId}: ${errMessage.slice(0, 300)}`,
      );
      try {
        await prisma.auditLog.create({
          data: {
            tenantId: opts.tenantId,
            action: "kol.import_failed",
            resourceType: "kol",
            resourceId: null,
            payload: {
              platform: payload.platform,
              externalId: payload.externalId,
              displayName: payload.displayName,
              followerCount: payload.followerCount,
              engagementRate:
                payload.engagementRate === undefined
                  ? null
                  : payload.engagementRate,
              error: errMessage.slice(0, 500),
            } as Prisma.InputJsonValue,
          },
        });
      } catch (auditErr) {
        // Recursive failure guard — if audit_log itself can't accept
        // the insert, swallow + log so we don't escalate one upsert
        // failure into the dispatcher-level catch in kol-sync-daily.
        const auditMsg =
          auditErr instanceof Error ? auditErr.message : String(auditErr);
        console.error(
          `[kol-sync/import] audit_log write also failed (${payload.platform}/${payload.externalId}): ${auditMsg.slice(0, 300)}`,
        );
      }
    }
  }
  return stats;
}
