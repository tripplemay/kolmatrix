/**
 * BM2-F010 · Header `<select>` controls for AI locale + history
 * (Planner adjudication §13 #A:A3 + #H:A).
 *
 * Both selects update the URL: `?id=...` for history, `?aiLocale=...`
 * for the AI generation locale (defaults to page locale).
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface RecentOption {
  id: string;
  label: string;
}

interface Props {
  locale: string;
  pageLocale: "en" | "zh";
  recentOptions: RecentOption[];
  selectedReportId: string | null;
  historyEmptyLabel: string;
  historyLabel: string;
  localeLabel: string;
  localeOptionEn: string;
  localeOptionZh: string;
}

const SELECT_CLS =
  "rounded-xl border border-white/10 bg-surface-container/80 px-3 py-2 text-xs font-semibold text-on-surface focus:border-cyan focus:outline-none";

export function WeeklyReportNavSelectors({
  locale,
  pageLocale,
  recentOptions,
  selectedReportId,
  historyEmptyLabel,
  historyLabel,
  localeLabel,
  localeOptionEn,
  localeOptionZh,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAiLocale = searchParams.get("aiLocale") ?? pageLocale;

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      const qs = next.toString();
      router.push(`/${locale}/insight/weekly-report${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams, locale]
  );

  return (
    <>
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <span>{localeLabel}</span>
        <select
          value={currentAiLocale}
          onChange={(e) => updateParam("aiLocale", e.target.value)}
          data-testid="weekly-report-locale-select"
          className={SELECT_CLS}
        >
          <option value="en">{localeOptionEn}</option>
          <option value="zh">{localeOptionZh}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        <span>{historyLabel}</span>
        <select
          value={selectedReportId ?? ""}
          onChange={(e) => updateParam("id", e.target.value || null)}
          disabled={recentOptions.length === 0}
          data-testid="weekly-report-history-select"
          className={SELECT_CLS}
        >
          {recentOptions.length === 0 ? (
            <option value="">{historyEmptyLabel}</option>
          ) : (
            recentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          )}
        </select>
      </label>
    </>
  );
}
