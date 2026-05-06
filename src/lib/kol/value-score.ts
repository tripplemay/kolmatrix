// BL-023-F001/F002 · KOL value score pure function (BL-040 retroactive
// upgrade — engagement signal is finally real, not the original BM1
// placeholder=15 that lived through B6/BIx F004 untouched).
//
// Raw components (max 90):
//   followerScore ∈ [0, 50]  — log10(max(followerCount, 100)) * 15, capped at 50
//   engagementScore ∈ [0, 20] — engagement_rate stepped 0/1/3/6/10 → 5/10/15/18/20;
//                              null falls back to ENGAGEMENT_PLACEHOLDER=12
//   categoryScore ∈ [0, 20]  — 8 points per listed category, capped at 20
//
// authenticityModifier ∈ [0.85, 1.05] is applied after summing the raw
// components — it nudges suspected fake-engagement KOLs down 15% and
// rewards verified-real ones 5%, without disrupting the broad ordering.
//
// Final total is normalized to 0-100 (clamped) so the surface number
// keeps the Modash/HypeAuditor-style scale users already understand.

const RAW_MAX = 90; // followerScore 50 + engagementScore 20 + categoryScore 20
const ENGAGEMENT_PLACEHOLDER = 12; // when engagement_rate is null/unknown

export interface KolValueScoreResult {
  /** Normalized 0-100 score persisted to kol.value_score. */
  total: number;
  /** Pre-normalization component scores (max 50 + 20 + 20 = 90). */
  rawBreakdown: {
    follower: number;
    engagement: number;
    category: number;
  };
  /** Authenticity modifier applied (1.0 when unknown). */
  authenticityModifier: number;
}

export interface KolValueScoreInput {
  followerCount: number;
  categories: string[];
  /** YouTube/IG engagement rate as a percentage (e.g. 4.2 = 4.2%). */
  engagementRate?: number | null;
  /** 0-100 score from BL-035 (currently unused in prod but plumbed). */
  engagementAuthenticity?: number | null;
}

/**
 * Map engagement_rate (% as a number, e.g. 4.2 = 4.2%) to a 0-20
 * score. Industry baselines: <1% low / 1-3% average / 3-6% strong /
 * >6% top-tier / >10% extreme. Stepped (not linear) so 0.5% and 1%
 * don't collapse into the same bin and so marketers can read the
 * tiers off without a calculator.
 */
export function engagementScoreFromRate(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return ENGAGEMENT_PLACEHOLDER;
  if (rate < 1) return 5;
  if (rate < 3) return 10;
  if (rate < 6) return 15;
  if (rate < 10) return 18;
  return 20;
}

/**
 * Map engagement_authenticity (0-100, from a future bot-detection
 * batch) to a small multiplier on the raw total. 5% boost for clearly
 * legit creators, 15% penalty for those flagged by the heuristics.
 * Range is tight enough not to flip overall ordering.
 */
export function authenticityModifier(authenticity: number | null | undefined): number {
  if (authenticity == null || !Number.isFinite(authenticity)) return 1.0;
  if (authenticity >= 80) return 1.05;
  if (authenticity >= 60) return 1.0;
  return 0.85;
}

export function computeKolValueScore(input: KolValueScoreInput): KolValueScoreResult {
  const followers = Math.max(Number.isFinite(input.followerCount) ? input.followerCount : 0, 100);
  const followerScore = Math.min(50, Math.log10(followers) * 15);
  const engagementScore = engagementScoreFromRate(input.engagementRate);
  const categoryScore = Math.min(20, input.categories.length * 8);

  const raw = followerScore + engagementScore + categoryScore;
  const modifier = authenticityModifier(input.engagementAuthenticity);
  const normalized = (raw * modifier * 100) / RAW_MAX;
  const total = Math.max(0, Math.min(100, Math.round(normalized)));

  return {
    total,
    rawBreakdown: {
      follower: Math.round(followerScore),
      engagement: engagementScore,
      category: categoryScore,
    },
    authenticityModifier: modifier,
  };
}
