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
 *
 * The pure aggregation logic lives in @/lib/admin/apify-preview-stats so
 * server-side render + integration tests can re-use it without going
 * through React.
 */
import { useTranslations } from "next-intl";

import type { ApifyKolItem } from "@/lib/admin/apify-preview-client";
import {
  describeFieldCompleteness,
  describeFreshness,
  describePlatformCoverage,
  describeScoreDistribution,
  type DimensionResult,
  type ThresholdDescriptor,
} from "@/lib/admin/apify-preview-stats";

interface CardResult {
  pass: boolean;
  measurements: Array<{ label: string; value: string; pass: boolean }>;
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
  descriptor: DimensionResult
): CardResult {
  return {
    pass: descriptor.pass,
    measurements: descriptor.thresholds.map((th: ThresholdDescriptor) => ({
      label: t(`${cardKey}.${th.labelKey}`),
      pass: th.pass,
      value: th.value,
    })),
  };
}
