"use client";

/**
 * BL-012-F004 · 4-dimension decision-gate stats cards (Stage 1.5).
 *
 * Reads the currently-visible page of ApifyKolItems and computes the four
 * thresholds the user uses to judge whether the apify-kol fork is producing
 * data fit for Stage 2 wiring. Each card surfaces:
 *   - a pass/fail badge (✓ green / ✗ red)
 *   - the actual measured numbers next to each spec threshold
 *   - the sample size N this card is computed from
 *
 * Caveat: the cards are computed against `items` only (typically a single
 * page = 50 KOLs). The user can widen the sample by setting pageSize=200 in
 * the URL or by walking pages with the filter pinned.
 */
import { useTranslations } from "next-intl";

import type { ApifyKolItem } from "@/lib/admin/apify-preview-client";

const REQUIRED_FIELDS: Array<keyof ApifyKolItem> = [
  "username",
  "displayName",
  "followers",
  "platform",
  "profileUrl",
];

const PLATFORM_VOLUME_FLOOR = 100;
const GAMING_TAG_PATTERNS = [
  /game/i,
  /gaming/i,
  /esport/i,
  /mobilegame/i,
  /streamer/i,
];

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

interface CardResult {
  pass: boolean;
  measurements: Array<{ label: string; value: string; pass: boolean }>;
}

interface ThresholdDescriptor {
  labelKey: string;
  /** True if the measurement satisfied its individual rule. */
  pass: boolean;
  /** Pre-formatted measurement value, e.g. "35.2% / ≥40%" */
  value: string;
}

function describeFieldCompleteness(items: ApifyKolItem[]): {
  pass: boolean;
  thresholds: ThresholdDescriptor[];
} {
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

function describeScoreDistribution(items: ApifyKolItem[]): {
  pass: boolean;
  thresholds: ThresholdDescriptor[];
} {
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

function describePlatformCoverage(items: ApifyKolItem[]): {
  pass: boolean;
  thresholds: ThresholdDescriptor[];
} {
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

function describeFreshness(items: ApifyKolItem[], now: Date = new Date()): {
  pass: boolean;
  thresholds: ThresholdDescriptor[];
} {
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

export interface StatsCardsProps {
  items: ApifyKolItem[];
  total: number;
  /** Optional override for time-based thresholds (test seam). */
  now?: Date;
}

export function StatsCards({ items, total, now }: StatsCardsProps) {
  const t = useTranslations("admin.apifyPreview.statsCards");
  const cards: Array<{ key: string; result: CardResult }> = [
    {
      key: "card1",
      result: cardFromDescriptor(t, "card1", describeFieldCompleteness(items)),
    },
    {
      key: "card2",
      result: cardFromDescriptor(t, "card2", describeScoreDistribution(items)),
    },
    {
      key: "card3",
      result: cardFromDescriptor(t, "card3", describePlatformCoverage(items)),
    },
    {
      key: "card4",
      result: cardFromDescriptor(t, "card4", describeFreshness(items, now)),
    },
  ];
  const passCount = cards.filter((c) => c.result.pass).length;

  return (
    <section className="space-y-4" data-testid="apify-preview-stats">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, result }) => (
          <article
            key={key}
            data-testid={`stats-${key}`}
            data-pass={result.pass ? "true" : "false"}
            className={`rounded-xl bg-surface-low/60 p-4 ring-1 ${
              result.pass ? "ring-cyan/40" : "ring-error/40"
            }`}
          >
            <header className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-on-surface">{t(`${key}.title`)}</h3>
              <span
                aria-label={result.pass ? t("statusPass") : t("statusFail")}
                data-testid={`stats-${key}-badge`}
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-bold ${
                  result.pass ? "bg-cyan/20 text-cyan" : "bg-error/20 text-error"
                }`}
              >
                {result.pass ? "✓" : "✗"}
              </span>
            </header>
            <p className="mt-1 text-xs text-on-surface-variant">{t(`${key}.description`)}</p>
            <ul className="mt-3 space-y-1 text-xs">
              {result.measurements.map((m, idx) => (
                <li
                  key={idx}
                  data-testid={`stats-${key}-measure-${idx}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-on-surface-variant">{m.label}</span>
                  <span
                    className={`font-mono ${m.pass ? "text-cyan" : "text-error"}`}
                  >
                    {m.value} {m.pass ? "✓" : "✗"}
                  </span>
                </li>
              ))}
            </ul>
            <p
              data-testid={`stats-${key}-sample`}
              className="mt-3 text-[10px] uppercase tracking-wide text-on-surface-variant/70"
            >
              {t("sampleSize", { n: items.length })}
            </p>
          </article>
        ))}
      </div>
      <footer
        data-testid="stats-footer"
        data-pass-count={String(passCount)}
        className={`rounded-xl px-4 py-3 text-sm ring-1 ${
          passCount === 4
            ? "bg-cyan/10 text-cyan ring-cyan/40"
            : "bg-warning/10 text-warning ring-warning/40"
        }`}
      >
        {passCount === 4
          ? t("footer.gateOpen")
          : t("footer.gateBlocked", { passCount, total: 4 })}
        <span className="ml-2 text-on-surface-variant">
          {t("footer.sampleNote", { n: items.length, total })}
        </span>
      </footer>
    </section>
  );
}

function cardFromDescriptor(
  t: (key: string) => string,
  cardKey: string,
  descriptor: { pass: boolean; thresholds: ThresholdDescriptor[] }
): CardResult {
  return {
    pass: descriptor.pass,
    measurements: descriptor.thresholds.map((th) => ({
      label: t(`${cardKey}.${th.labelKey}`),
      pass: th.pass,
      value: th.value,
    })),
  };
}
