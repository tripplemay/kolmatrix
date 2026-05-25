/**
 * BM2-F010 · Page header (Planner adjudication §13 #A:A3 + #H:A).
 *
 * Breadcrumb + title + range toggle + locale `<select>` + history `<select>`.
 * The two `<select>`s are vanilla HTML so RSC can render and a small
 * client child handles navigation.
 *
 * BL-024-F003: range toggle (Last Week / Last Month) is now a 2-link
 * URL nav. lastWeek = current ISO week; lastMonth = trailing 28d.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { WeeklyReportRange } from "@/lib/weekly-report/range";

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
  range: WeeklyReportRange;
  recent: RecentRow[];
  selectedReportId: string | null;
}

const RANGES: ReadonlyArray<{ key: WeeklyReportRange }> = [
  { key: "lastWeek" },
  { key: "lastMonth" },
];

function formatWeekOption(row: RecentRow): string {
  const start = row.weekStart.toISOString().slice(0, 10);
  const end = row.weekEnd.toISOString().slice(0, 10);
  return `${start} → ${end} (${row.locale})`;
}

export async function WeeklyReportHeader({
  locale,
  pageLocale,
  range,
  recent,
  selectedReportId,
}: Props) {
  const t = await getTranslations("weeklyReport.header");

  return (
    <header
      data-testid="weekly-report-page-header"
      className="flex flex-col gap-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-on-surface-variant"
      >
        <Link
          href={`/${locale}/insight?tab=reports`}
          className="hover:text-on-surface"
        >
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
            {RANGES.map((r) => {
              const active = r.key === range;
              return (
                <Link
                  key={r.key}
                  href={`/${locale}/insight/weekly-report?range=${r.key}`}
                  data-testid={`weekly-report-range-${r.key}`}
                  aria-current={active ? "page" : undefined}
                  prefetch={false}
                  className={
                    active
                      ? "rounded-lg bg-surface-high px-4 py-1.5 text-xs font-semibold text-cyan shadow-sm"
                      : "rounded-lg px-4 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  }
                >
                  {t(`range.${r.key}` as Parameters<typeof t>[0])}
                </Link>
              );
            })}
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
