/**
 * B6-kol-daily-sync F005 · Pre-write quality filters + post-write
 * anomaly flags.
 *
 * Five spec-mandated rules (§F005):
 *   1. Dedupe — owned by the unique index on (tenantId, platform,
 *      externalId); the import path always upserts so this is a
 *      structural guarantee, not a runtime check here.
 *   2. Spam: subscriberCount < 1,000 → skip.
 *   3. Zombie: lastUploadAt > 90 days → skip. The rule is a no-op when
 *      the adapter can't surface lastUploadAt (the apify-kol fork
 *      currently doesn't); armed for future enrichment.
 *   4. NSFW: brandSafetyRating === "questionable" / "unsafe" → skip.
 *      The fork doesn't expose this today; same future-adapter shape.
 *   5. Same channel.id different handle: handled by the writer —
 *      the upsert key is (tenant, platform, externalId), so a renamed
 *      handle just refreshes the existing row's `handle` column. Spec
 *      acceptance was added for kol-seed-redo F003 fix-round 1; this
 *      rule is a no-op here, kept as a comment for traceability.
 *
 * Post-write flags (written into `metadata.flags`):
 *   - suspicious_growth: a sudden 10× jump vs the previous synced
 *     follower count (likely fake-follower buy).
 *   - declining: 30-day trailing -50% drop (channel deteriorating).
 */
import type { RawKolData } from "./types";

export const FILTER_MIN_SUBSCRIBERS_QUALITY = 1_000;
export const ZOMBIE_INACTIVE_DAYS = 90;
export const SUSPICIOUS_GROWTH_MULTIPLIER = 10;
export const DECLINING_DROP_RATIO = 0.5;
export const DECLINING_LOOKBACK_DAYS = 30;
const NSFW_RATINGS = new Set(["questionable", "unsafe", "nsfw"]);

/** BL-012-F010 — apify-kol fork ships 4 dimension scores per row
 *  (relevance / influence / quality / reachability). The pre-write
 *  rule for this source skips any row where BOTH relevance AND
 *  influence are < 0.2 — these are "double-low" rows the fork's own
 *  scorer flagged as borderline noise. Single-low rows still pass
 *  (lots of legit creators score ≤0.2 on one dimension); only the
 *  combined signal is strong enough to skip. */
export const APIFY_KOL_DOUBLE_LOW_THRESHOLD = 0.2;

export type QualitySkipReason =
  | "spam"
  | "zombie"
  | "nsfw"
  | "missing-id"
  | "low-score";

export interface QualityFlags {
  suspicious_growth?: true;
  declining?: true;
  /** BL-076-F002 — set on apify-kol rows when the adapter's raw
   *  engagement_rate calculation exceeds 100% (a noise signal for
   *  view-based proxy KOL with low followers per BL-061 fork §3.3).
   *  Stored as a true/false boolean — `false` is meaningful ("we
   *  evaluated this row and it isn't an outlier") whereas an absent
   *  key means the upstream adapter doesn't compute outlier signals
   *  (e.g. the deprecated YouTube path). */
  engagement_outlier?: boolean;
}

export interface QualityCheckExisting {
  followerCount: number;
  lastSyncedAt: Date | null;
}

export type QualityVerdict =
  | { keep: true; flags: QualityFlags }
  | { keep: false; reason: QualitySkipReason; flags: QualityFlags };

export interface QualityCheckOpts {
  /** `metadata.source` value the import path will write. Used by rules
   *  that only apply to a specific upstream — currently the apify-kol
   *  double-low score skip. Omit for adapters that don't need source-
   *  scoped filtering. */
  source?: string;
}

/**
 * Apply all 5 pre-write rules and compute post-write anomaly flags
 * in one pass. The caller hands in the existing Kol row (if any) so
 * the growth / decline checks have something to compare against.
 *
 * Pure — no Prisma, no IO, no clock surprises (caller passes `now`).
 */
export function checkQuality(
  raw: RawKolData,
  existing: QualityCheckExisting | null,
  now: Date,
  opts: QualityCheckOpts = {}
): QualityVerdict {
  const flags = computeFlags(raw, existing, now);

  if (!raw.externalId) {
    return { keep: false, reason: "missing-id", flags };
  }

  // Rule 2 — spam.
  if (raw.subscriberCount < FILTER_MIN_SUBSCRIBERS_QUALITY) {
    return { keep: false, reason: "spam", flags };
  }

  // Rule 3 — zombie. lastUploadAt is optional on RawKolData; the rule
  // is a no-op when adapters can't surface it (current apify-kol path).
  if (raw.lastUploadAt) {
    const last = new Date(raw.lastUploadAt).getTime();
    const cutoff = now.getTime() - ZOMBIE_INACTIVE_DAYS * 24 * 3600_000;
    if (last < cutoff) {
      return { keep: false, reason: "zombie", flags };
    }
  }

  // Rule 4 — NSFW.
  if (raw.brandSafetyRating && NSFW_RATINGS.has(raw.brandSafetyRating.toLowerCase())) {
    return { keep: false, reason: "nsfw", flags };
  }

  // BL-012-F010 — apify-kol source rule: skip the double-low rows
  // (relevance < 0.2 AND influence < 0.2) per spec §2.2. Only fires
  // when the source matches.
  if (opts.source === "apify-kol") {
    const scores = readApifyKolScores(raw);
    if (
      scores.relevance !== null &&
      scores.influence !== null &&
      scores.relevance < APIFY_KOL_DOUBLE_LOW_THRESHOLD &&
      scores.influence < APIFY_KOL_DOUBLE_LOW_THRESHOLD
    ) {
      return { keep: false, reason: "low-score", flags };
    }
  }

  return { keep: true, flags };
}

function readApifyKolScores(raw: RawKolData): {
  relevance: number | null;
  influence: number | null;
} {
  const r = raw.raw;
  if (!r || typeof r !== "object") return { relevance: null, influence: null };
  const rel = (r as Record<string, unknown>).relevanceScore;
  const inf = (r as Record<string, unknown>).influenceScore;
  return {
    relevance: typeof rel === "number" && Number.isFinite(rel) ? rel : null,
    influence: typeof inf === "number" && Number.isFinite(inf) ? inf : null,
  };
}

function computeFlags(
  raw: RawKolData,
  existing: QualityCheckExisting | null,
  now: Date
): QualityFlags {
  const flags: QualityFlags = {};
  if (!existing) return flags;

  const prev = existing.followerCount;
  const next = raw.subscriberCount;

  if (prev > 0 && next >= prev * SUSPICIOUS_GROWTH_MULTIPLIER) {
    flags.suspicious_growth = true;
  }

  // Decline check needs a meaningful baseline — only meaningful when
  // we have a prior sync at least DECLINING_LOOKBACK_DAYS old. A
  // shorter window would produce too many false positives on
  // creators who do seasonal cleanup.
  if (existing.lastSyncedAt) {
    const lookbackMs = DECLINING_LOOKBACK_DAYS * 24 * 3600_000;
    const elapsed = now.getTime() - existing.lastSyncedAt.getTime();
    if (
      prev > 0 &&
      elapsed >= lookbackMs &&
      next <= prev * DECLINING_DROP_RATIO
    ) {
      flags.declining = true;
    }
  }

  return flags;
}
