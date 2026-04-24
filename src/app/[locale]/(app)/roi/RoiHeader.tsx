/**
 * BM2-F009 · /roi page header (Planner adjudication §13 #A:A3 Hybrid).
 *
 * - Breadcrumb (Analytics → ROI Tracking)
 * - Page title + subtitle
 * - Time-range toggle: only "30D" active; 7D / 90D / All-time
 *   disabled+tooltip "B4" per §3.1 row 2 ghost-control rule
 * - "AI Insights" top-bar button → smooth-scroll to panel + trigger
 *   first-time generate (button is client-side; see RoiHeaderAiButton)
 * - "Record revenue → /campaigns" link (active link, not disabled)
 *   per §3.1 row 5 — revenue recording lives on the campaign detail page
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { RoiHeaderAiButton } from "./RoiHeaderAiButton";

interface Props {
  locale: string;
}

export async function RoiHeader({ locale }: Props) {
  const t = await getTranslations("roi.header");
  const ranges: Array<{
    key: "7d" | "30d" | "90d" | "all";
    active?: boolean;
  }> = [
    { key: "7d" },
    { key: "30d", active: true },
    { key: "90d" },
    { key: "all" },
  ];

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
          href={`/${locale}/dashboard`}
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
            {ranges.map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={!r.active}
                title={!r.active ? t("rangeDisabledTooltip") : undefined}
                data-testid={`roi-range-${r.key}`}
                className={
                  r.active
                    ? "rounded-lg bg-surface-high px-4 py-1.5 text-xs font-semibold text-cyan shadow-sm"
                    : "rounded-lg px-4 py-1.5 text-xs font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
                }
              >
                {t(`range.${r.key}` as Parameters<typeof t>[0])}
              </button>
            ))}
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
