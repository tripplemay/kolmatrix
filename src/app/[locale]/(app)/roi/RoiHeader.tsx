/**
 * BM2-F009 · /roi page header (Planner adjudication §13 #A:A3 Hybrid).
 *
 * - Breadcrumb (Analytics → ROI Tracking)
 * - Page title + subtitle
 * - Time-range toggle: 7D / 30D / 90D / All-time, all active. Renders
 *   as `<Link>`s pointing at `?range=...`; the page Server Component
 *   reads `searchParams.range` and re-aggregates per BL-024-F002.
 * - "AI Insights" top-bar button → smooth-scroll to panel + trigger
 *   first-time generate (button is client-side; see RoiHeaderAiButton)
 * - "Record revenue → /campaigns" link (active link, not disabled)
 *   per §3.1 row 5 — revenue recording lives on the campaign detail page
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { RoiRange } from "@/lib/roi/range";

import { RoiHeaderAiButton } from "./RoiHeaderAiButton";

interface Props {
  locale: string;
  range: RoiRange;
}

const RANGES: ReadonlyArray<{ key: RoiRange; i18nKey: "7d" | "30d" | "90d" | "all" }> = [
  { key: "7d", i18nKey: "7d" },
  { key: "30d", i18nKey: "30d" },
  { key: "90d", i18nKey: "90d" },
  { key: "allTime", i18nKey: "all" },
];

export async function RoiHeader({ locale, range }: Props) {
  const t = await getTranslations("roi.header");

  return (
    <header
      data-testid="roi-page-header"
      className="flex flex-col gap-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-on-surface-variant"
      >
        <Link
          href={`/${locale}/insight`}
          className="hover:text-on-surface"
        >
          {t("crumbAnalytics")}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-on-surface">
          {t("crumbCurrent")}
        </span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            data-testid="roi-page-title"
            className="text-3xl font-bold tracking-tight text-white"
          >
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex rounded-xl bg-surface-container p-1"
            data-testid="roi-time-toggle"
          >
            {RANGES.map((r) => {
              const active = r.key === range;
              return (
                <Link
                  key={r.key}
                  href={`/${locale}/roi?range=${r.key}`}
                  data-testid={`roi-range-${r.i18nKey}`}
                  aria-current={active ? "page" : undefined}
                  prefetch={false}
                  className={
                    active
                      ? "rounded-lg bg-surface-high px-4 py-1.5 text-xs font-semibold text-cyan shadow-sm"
                      : "rounded-lg px-4 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  }
                >
                  {t(`range.${r.i18nKey}` as Parameters<typeof t>[0])}
                </Link>
              );
            })}
          </div>

          <RoiHeaderAiButton label={t("aiInsights")} />

          <Link
            href={`/${locale}/campaigns`}
            data-testid="roi-record-revenue"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-5 py-2 text-xs font-bold text-on-primary"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden>
              payments
            </span>
            {t("recordRevenue")}
          </Link>
        </div>
      </div>
    </header>
  );
}
