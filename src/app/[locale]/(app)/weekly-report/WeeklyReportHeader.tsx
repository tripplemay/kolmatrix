/**
 * BM2-F010 · Page header (Planner adjudication §13 #A:A3 + #H:A).
 *
 * Breadcrumb + title + range toggle (Last Week active, Last Month
 * disabled+tooltip "B4") + locale `<select>` + history `<select>`.
 * The two `<select>`s are vanilla HTML so RSC can render and a small
 * client child handles navigation.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { WeeklyReportNavSelectors } from "./WeeklyReportNavSelectors";

interface RecentRow {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  locale: string;
}

interface Props {
  locale: string;
  pageLocale: "en" | "zh";
  recent: RecentRow[];
  selectedReportId: string | null;
}

function formatWeekOption(row: RecentRow): string {
  const start = row.weekStart.toISOString().slice(0, 10);
  const end = row.weekEnd.toISOString().slice(0, 10);
  return `${start} → ${end} (${row.locale})`;
}

export async function WeeklyReportHeader({
  locale,
  pageLocale,
  recent,
  selectedReportId,
}: Props) {
  const t = await getTranslations("weeklyReport.header");
  const ranges: Array<{ key: "lastWeek" | "lastMonth"; active?: boolean }> = [
    { key: "lastWeek", active: true },
    { key: "lastMonth" },
  ];

  return (
    <header
      data-testid="weekly-report-page-header"
      className="flex flex-col gap-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-on-surface-variant"
      >
        <Link href={`/${locale}/dashboard`} className="hover:text-on-surface">
          {t("crumbReports")}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-semibold text-on-surface">
          {t("crumbCurrent")}
        </span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            data-testid="weekly-report-page-title"
            className="text-3xl font-bold tracking-tight text-white"
          >
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-3"
          data-testid="weekly-report-print-hide"
        >
          <div
            className="flex rounded-xl bg-surface-container p-1"
            data-testid="weekly-report-range-toggle"
          >
            {ranges.map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={!r.active}
                title={!r.active ? t("rangeDisabledTooltip") : undefined}
                data-testid={`weekly-report-range-${r.key}`}
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

          <WeeklyReportNavSelectors
            locale={locale}
            pageLocale={pageLocale}
            recentOptions={recent.map((r) => ({
              id: r.id,
              label: formatWeekOption(r),
            }))}
            selectedReportId={selectedReportId}
            historyEmptyLabel={t("historyEmpty")}
            historyLabel={t("history")}
            localeLabel={t("aiLocale")}
            localeOptionEn={t("localeOptionEn")}
            localeOptionZh={t("localeOptionZh")}
          />
        </div>
      </div>
    </header>
  );
}
