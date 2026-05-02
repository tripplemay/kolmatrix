/**
 * BM2-F007 / BIx-mvp-polish-pass F001 · Page header.
 *
 * F001 changes (2026-05-01):
 *   - 3 time-toggle buttons are now real anchor links that swap the
 *     `?range=` URL param. The active branch is inferred from the
 *     current `range` prop.
 *   - Export CSV is a plain <a> pointing at /api/crm/export-csv?range=
 *     — the route handler returns a Content-Disposition response so
 *     the browser triggers a file download natively.
 *   - +Manual log button removed (deferred to B4-extended per PRD
 *     §11.4 — manual webhook ingestion comes with the carrier work).
 */
import { getTranslations } from "next-intl/server";

import type { CrmRange } from "@/lib/crm/overview";

interface Props {
  title: string;
  subtitle: string;
  basePath: string;
  range: CrmRange;
}

const RANGES: readonly CrmRange[] = ["thisQuarter", "last90d", "allTime"] as const;

export async function CrmHeader({ title, subtitle, basePath, range }: Props) {
  const t = await getTranslations("crm.header");

  function rangeHref(target: CrmRange): string {
    if (target === "last90d") return basePath; // default → drop the param
    return `${basePath}?range=${target}`;
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 data-testid="crm-page-title" className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-surface-container flex rounded-xl p-1" data-testid="crm-time-toggle">
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <a
                key={r}
                href={rangeHref(r)}
                aria-current={active ? "true" : undefined}
                data-testid={`crm-range-${r}`}
                className={
                  active
                    ? "bg-surface-high text-cyan rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm"
                    : "text-on-surface-variant rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors hover:text-white"
                }
              >
                {t(`range.${r}` as Parameters<typeof t>[0])}
              </a>
            );
          })}
        </div>
        <a
          href={`/api/crm/export-csv?range=${range}`}
          download
          title={t("exportCsvTooltip")}
          data-testid="crm-export-csv"
          className="bg-surface-container-high/60 text-on-surface hover:bg-surface-container-high flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors hover:text-white"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>
            download
          </span>
          {t("exportCsv")}
        </a>
      </div>
    </header>
  );
}
