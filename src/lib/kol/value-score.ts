// BM1-F001/F002 · KOL value score pure function (adjudication #E).
//
// Raw components (max 85):
//   followerScore ∈ [0, 50]  — log10(max(followerCount, 100)) * 15, capped at 50
//   engagementScore          — fixed 15 placeholder; the real YouTube-API
//                              number will replace this once B6 lands
//   categoryScore ∈ [0, 20]  — 8 points per listed category, capped at 20
//
// The raw total is normalized to 0-100 so the surface number lines up
// with Modash/HypeAuditor-style scores users already understand. The
// raw breakdown is returned alongside for UI tooltips that explain
// "where the 78 came from".

export interface KolValueScoreResult {
  /** Normalized 0-100 score persisted to kol.value_score. */
  total: number;
  /** Pre-normalization component scores (max 50 + 15 + 20 = 85). */
  rawBreakdown: {
    follower: number;
    engagement: number;
    category: number;
  };
}

export interface KolValueScoreInput {
  followerCount: number;
  categories: string[];
}

export function computeKolValueScore(input: KolValueScoreInput): KolValueScoreResult {
  const followers = Math.max(Number.isFinite(input.followerCount) ? input.followerCount : 0, 100);
  const followerScore = Math.min(50, Math.log10(followers) * 15);
  const engagementScore = 15;
  const categoryScore = Math.min(20, input.categories.length * 8);

  const raw = followerScore + engagementScore + categoryScore;

  return {
    total: Math.round((raw * 100) / 85),
    rawBreakdown: {
      follower: Math.round(followerScore),
      engagement: engagementScore,
      category: categoryScore,
    },
  };
}
