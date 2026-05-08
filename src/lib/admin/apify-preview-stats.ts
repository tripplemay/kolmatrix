/**
 * BL-012-F004 / F006 · pure 4-dimension decision-gate aggregations.
 *
 * Lifted out of StatsCards.tsx so the math can run server-side (Stage 1.5
 * preview page is a server component) and be unit/integration tested
 * without React render plumbing. Imports nothing from kol-sync or Prisma —
 * the data-flow isolation rule (spec §2.2) applies here too.
 */
import type { ApifyKolItem } from "./apify-preview-client";

export const REQUIRED_FIELDS: ReadonlyArray<keyof ApifyKolItem> = [
  "username",
  "displayName",
  "followers",
  "platform",
  "profileUrl",
];

export const PLATFORM_VOLUME_FLOOR = 100;
export const GAMING_TAG_PATTERNS: ReadonlyArray<RegExp> = [
  /game/i,
  /gaming/i,
  /esport/i,
  /mobilegame/i,
  /streamer/i,
];

export interface ThresholdDescriptor {
  labelKey: string;
  pass: boolean;
  /** Pre-formatted measurement value, e.g. "35.2% / ≥40%" */
  value: string;
}

export interface DimensionResult {
  pass: boolean;
  thresholds: ThresholdDescriptor[];
}

function safeRate(num: number, denom: number): number {
  if (denom === 0) return 0;
  return num / denom;
}

function isFieldPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function describeFieldCompleteness(items: ApifyKolItem[]): DimensionResult {
  const total = items.length;
  let allRequiredPresent = total > 0;
  for (const item of items) {
    for (const field of REQUIRED_FIELDS) {
      if (!isFieldPresent(item[field])) {
        allRequiredPresent = false;
        break;
      }
    }
    if (!allRequiredPresent) break;
  }
  const emailHits = items.filter(
    (item) =>
      (item.emails?.length ?? 0) > 0 || (item.aggregatorEmails?.length ?? 0) > 0
  ).length;
  const emailRate = safeRate(emailHits, total);
  const emailPass = total > 0 && emailRate >= 0.4;

  return {
    pass: total > 0 && allRequiredPresent && emailPass,
    thresholds: [
      {
        labelKey: "thresholds.requiredFields",
        pass: total > 0 && allRequiredPresent,
        value: allRequiredPresent ? "100%" : "<100%",
      },
      {
        labelKey: "thresholds.emailRate",
        pass: emailPass,
        value: `${(emailRate * 100).toFixed(1)}% / ≥40%`,
      },
    ],
  };
}

export function describeScoreDistribution(items: ApifyKolItem[]): DimensionResult {
  const total = items.length;
  let scoreSum = 0;
  let scoreSamples = 0;
  let qualityCovered = 0;
  let reachabilityCovered = 0;
  let allZero = true;
  let allOne = true;

  for (const item of items) {
    if (typeof item.relevanceScore === "number") {
      scoreSum += item.relevanceScore;
      scoreSamples += 1;
      if (item.relevanceScore !== 0) allZero = false;
      if (item.relevanceScore !== 1) allOne = false;
    }
    if (typeof item.influenceScore === "number") {
      scoreSum += item.influenceScore;
      scoreSamples += 1;
      if (item.influenceScore !== 0) allZero = false;
      if (item.influenceScore !== 1) allOne = false;
    }
    if (typeof item.qualityScore === "number") {
      qualityCovered += 1;
      if (item.qualityScore !== 0) allZero = false;
      if (item.qualityScore !== 1) allOne = false;
    }
    if (typeof item.reachabilityScore === "number") {
      reachabilityCovered += 1;
      if (item.reachabilityScore !== 0) allZero = false;
      if (item.reachabilityScore !== 1) allOne = false;
    }
  }

  const avgScore = scoreSamples === 0 ? 0 : scoreSum / scoreSamples;
  const qualityRate = safeRate(qualityCovered, total);
  const reachabilityRate = safeRate(reachabilityCovered, total);
  const avgPass = total > 0 && avgScore >= 0.5;
  const coveragePass = total > 0 && qualityRate >= 0.6 && reachabilityRate >= 0.6;
  const distributionPass = total > 0 && !allZero && !allOne;

  return {
    pass: avgPass && coveragePass && distributionPass,
    thresholds: [
      {
        labelKey: "thresholds.scoreAvg",
        pass: avgPass,
        value: `${avgScore.toFixed(2)} / ≥0.50`,
      },
      {
        labelKey: "thresholds.qrCoverage",
        pass: coveragePass,
        value: `${(qualityRate * 100).toFixed(0)}% Q / ${(reachabilityRate * 100).toFixed(0)}% Re / ≥60%`,
      },
      {
        labelKey: "thresholds.distribution",
        pass: distributionPass,
        value: distributionPass ? "spread" : allZero ? "all 0" : "all 1",
      },
    ],
  };
}

export function describePlatformCoverage(items: ApifyKolItem[]): DimensionResult {
  const total = items.length;
  const counts: Record<string, number> = {};
  let gamingHits = 0;
  for (const item of items) {
    counts[item.platform] = (counts[item.platform] ?? 0) + 1;
    const tags = item.matchedTags ?? [];
    if (tags.some((tag) => GAMING_TAG_PATTERNS.some((re) => re.test(tag)))) {
      gamingHits += 1;
    }
  }
  const platformsWithData = Object.values(counts).filter((c) => c > 0).length;
  const maxPlatformVolume = Math.max(0, ...Object.values(counts));
  const platformsPass = platformsWithData >= 3;
  const volumePass = maxPlatformVolume >= PLATFORM_VOLUME_FLOOR;
  const gamingRate = safeRate(gamingHits, total);
  const gamingPass = total > 0 && gamingRate >= 0.7;

  return {
    pass: platformsPass && volumePass && gamingPass,
    thresholds: [
      {
        labelKey: "thresholds.platforms",
        pass: platformsPass,
        value: `${platformsWithData} / ≥3`,
      },
      {
        labelKey: "thresholds.platformVolume",
        pass: volumePass,
        value: `${maxPlatformVolume} / ≥${PLATFORM_VOLUME_FLOOR}`,
      },
      {
        labelKey: "thresholds.gamingTagRate",
        pass: gamingPass,
        value: `${(gamingRate * 100).toFixed(1)}% / ≥70%`,
      },
    ],
  };
}

export function describeFreshness(
  items: ApifyKolItem[],
  now: Date = new Date()
): DimensionResult {
  const total = items.length;
  if (total === 0) {
    return {
      pass: false,
      thresholds: [
        { labelKey: "thresholds.fresh7d", pass: false, value: "0% / ≥80%" },
        { labelKey: "thresholds.aged7to30d", pass: false, value: "0% / ≤15%" },
        { labelKey: "thresholds.stale30d", pass: false, value: "0% / ≤5%" },
      ],
    };
  }

  const day = 24 * 60 * 60 * 1000;
  let fresh = 0;
  let aged = 0;
  let stale = 0;
  let dated = 0;
  for (const item of items) {
    if (!item.lastScrapedAt) continue;
    const t = new Date(item.lastScrapedAt).getTime();
    if (Number.isNaN(t)) continue;
    dated += 1;
    const ageDays = (now.getTime() - t) / day;
    if (ageDays <= 7) fresh += 1;
    else if (ageDays <= 30) aged += 1;
    else stale += 1;
  }
  const freshRate = safeRate(fresh, total);
  const agedRate = safeRate(aged, total);
  const staleRate = safeRate(stale, total);
  const freshPass = freshRate >= 0.8;
  const agedPass = agedRate <= 0.15;
  const stalePass = staleRate <= 0.05;
  return {
    pass: dated > 0 && freshPass && agedPass && stalePass,
    thresholds: [
      {
        labelKey: "thresholds.fresh7d",
        pass: freshPass,
        value: `${(freshRate * 100).toFixed(1)}% / ≥80%`,
      },
      {
        labelKey: "thresholds.aged7to30d",
        pass: agedPass,
        value: `${(agedRate * 100).toFixed(1)}% / ≤15%`,
      },
      {
        labelKey: "thresholds.stale30d",
        pass: stalePass,
        value: `${(staleRate * 100).toFixed(1)}% / ≤5%`,
      },
    ],
  };
}
