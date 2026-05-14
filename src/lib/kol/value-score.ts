// BL-066-F007 / BL-048 · KOL value score pure function — formula v2.
// Replaces the BL-023 v1 formula (which let mega-tier and nano-tier
// KOLs tie at total=100 once they cleared a low follower cap). See
// docs/adr/ADR-014-value-score-formula-v2.md for the impact analysis.
//
// Raw components (sub-sum max = 120 by design — RAW_MAX 95 normalises
// so that only a "real" mega + high-engagement + multi-category KOL
// approaches 100; ordinary mega creators land in the 90s):
//   followerScore   ∈ [0, 80]  — log10(max(followerCount, 100)) * 10, capped at 80
//                                (cap reached at ≥100M followers; 1M ≈ 60, 100K = 50)
//   engagementScore ∈ {8, 12, 16, 20, 25}  — stepped, see engagementScoreFromRate
//                                            null falls back to ENGAGEMENT_PLACEHOLDER=12
//   categoryScore   ∈ [0, 15]  — 8 points per listed category, capped at 15
//
// authenticityModifier ∈ [0.85, 1.05] is applied after summing the raw
// components — it nudges suspected fake-engagement KOLs down 15% and
// rewards verified-real ones 5%, without disrupting the broad ordering.
//
// Final total is normalised to 0-100 (clamped) so the surface number
// keeps the Modash/HypeAuditor-style scale users already understand.

const RAW_MAX = 95; // BL-066-F007 / ADR-014: not the literal sub-sum (80+25+15=120);
                    // intentional "over by 1" denominator so true mega+high-engagement+
                    // multi-cat KOLs cap at 100 while ordinary mega land in 90+ band.
const ENGAGEMENT_PLACEHOLDER = 12; // when engagement_rate is null/unknown — neutral
                                   // "we don't know" sits ABOVE the <5% real bucket (8)
                                   // because absence of signal ≠ confirmed low engagement.

export interface KolValueScoreResult {
  /** Normalized 0-100 score persisted to kol.value_score. */
  total: number;
  /** Pre-normalization component scores (sub-sum max = 80 + 25 + 15 = 120). */
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
 * BL-066-F007 / ADR-014 ladder. Industry baselines: <1% low / 1-3%
 * average / 3-6% strong / >6% top-tier / >10% extreme; we redesigned
 * the bins around what marketers actually pay for — anything <5% on
 * apify-kol-sourced channels is "below the bar", 5-8% is the working
 * floor, and the 8/12/16% steps separate the top-tier nano/mid/mega
 * mix. The 25-point top bucket (≥16%) replaces BL-023's 20-cap so
 * truly viral creators can outrank "merely strong" ones — paired with
 * the new followerScore cap of 80, mega-tier accounts no longer tie
 * with nano accounts that happened to clear an old 10% threshold.
 *
 * Null/NaN falls back to ENGAGEMENT_PLACEHOLDER=12 (above <5% real=8)
 * because absence of signal ≠ confirmed low engagement.
 */
export function engagementScoreFromRate(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return ENGAGEMENT_PLACEHOLDER;
  if (rate < 5) return 8;
  if (rate < 8) return 12;
  if (rate < 12) return 16;
  if (rate < 16) return 20;
  return 25;
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
  // BL-066-F007 / ADR-014: cap 80 (reached at log10(1e8)=8 → 80) so
  // 100M+ tops out; 1M ≈ 60, 100K = 50, 10K = 40, 1K = 30, 100 = 20.
  const followerScore = Math.min(80, Math.log10(followers) * 10);
  const engagementScore = engagementScoreFromRate(input.engagementRate);
  // BL-066-F007 / ADR-014: cap 15 (was 20). Slope unchanged at 8/cat —
  // 2+ cats saturate, since most KOL profiles list 3-5 cats anyway and
  // we want the differentiation to live in the follower+engagement axes.
  const categoryScore = Math.min(15, input.categories.length * 8);

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
