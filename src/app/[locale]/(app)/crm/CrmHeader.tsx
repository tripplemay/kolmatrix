/**
 * BM2-F007 · Page header with disabled time toggle + Export CSV +
 * Manual log buttons (per Planner adjudication §13 #B/#C/#D — all
 * deferred to B4 with disabled+title tooltip).
 */
import { getTranslations } from "next-intl/server";

interface Props {
  title: string;
  subtitle: string;
}

export async function CrmHeader({ title, subtitle }: Props) {
  const t = await getTranslations("crm.header");
  const ranges: Array<{ key: "thisQuarter" | "last90d" | "allTime"; active?: boolean }> = [
    { key: "thisQuarter" },
    { key: "last90d", active: true },
    { key: "allTime" },
  ];

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1
          data-testid="crm-page-title"
          className="text-3xl font-bold tracking-tight text-white"
        >
          {title}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-xl bg-surface-container p-1"
          data-testid="crm-time-toggle"
        >
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={!r.active}
              title={!r.active ? t("rangeDisabledTooltip") : undefined}
              data-testid={`crm-range-${r.key}`}
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
        <button
          type="button"
          disabled
          title={t("exportCsvTooltip")}
          data-testid="crm-export-csv"
          className="flex items-center gap-2 rounded-xl bg-surface-container-high/50 px-4 py-2 text-xs font-bold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            download
          </span>
          {t("exportCsv")}
        </button>
        <button
          type="button"
          disabled
          title={t("manualLogTooltip")}
          data-testid="crm-manual-log"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-5 py-2 text-xs font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            add_circle
          </span>
          {t("manualLog")}
        </button>
      </div>
    </header>
  );
}
