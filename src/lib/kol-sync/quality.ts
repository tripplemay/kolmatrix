/**
 * B6-kol-daily-sync F005 · Pre-write quality filters + post-write
 * anomaly flags.
 *
 * Five spec-mandated rules (§F005):
 *   1. Dedupe — owned by the unique index on (tenantId, platform,
 *      externalId); the import path always upserts so this is a
 *      structural guarantee, not a runtime check here.
 *   2. Spam: subscriberCount < 1,000 → skip.
 *   3. Zombie: lastUploadAt > 90 days → skip. The current YouTube
 *      adapter doesn't surface lastUploadAt (channels.list doesn't
 *      return it without a second playlistItems hop). The check is
 *      armed for future adapters / B5 enrichment — when raw
 *      doesn't carry the field the rule is a no-op.
 *   4. NSFW: brandSafetyRating === "questionable" / "unsafe" → skip.
 *      YouTube doesn't expose this; same future-adapter shape.
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

export type QualitySkipReason =
  | "spam"
  | "zombie"
  | "nsfw"
  | "missing-id";

export interface QualityFlags {
  suspicious_growth?: true;
  declining?: true;
}

export interface QualityCheckExisting {
  followerCount: number;
  lastSyncedAt: Date | null;
}

export type QualityVerdict =
  | { keep: true; flags: QualityFlags }
  | { keep: false; reason: QualitySkipReason; flags: QualityFlags };

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
  now: Date
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
  // is a no-op when adapters can't surface it (current YouTube path).
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

  return { keep: true, flags };
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
