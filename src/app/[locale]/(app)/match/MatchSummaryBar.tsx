/**
 * BL-065-F001 · /match summary bar (server component).
 *
 * Sits above the result pane: matched count + sort selector + view-mode
 * toggle (card / table — replaces the BM1 /discovery grid/list pair).
 * URL-driven so all state changes re-render via searchParams; no client
 * state needed.
 *
 * i18n: reuses `discovery.summary` / `discovery.sort` namespaces (still
 * valid through Phase 2 until F006 migrates them under match.*). The
 * card/table labels are new and live under `match.view.*` — BL-064 only
 * grid/list existed, "table" is semantically distinct so it gets a fresh
 * key rather than overloading list.
 */
import { getTranslations } from "next-intl/server";

import { type DiscoveryFilters } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import type { ViewMode } from "./view-mode";

interface Props {
  total: number;
  sort: DiscoveryFilters["sort"];
  view: ViewMode;
  withFilter: (overrides: Partial<DiscoveryFilters>) => string;
  withParams: (extra: Record<string, string | undefined>) => string;
}

export async function MatchSummaryBar({
  total,
  sort,
  view,
  withFilter,
  withParams,
}: Props) {
  const tSummary = await getTranslations("match.summary");
  const tSort = await getTranslations("match.sort");
  const tView = await getTranslations("match.view");

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface/30 px-4 py-3"
      data-testid="match-summary-bar"
    >
      <p
        className="text-sm font-semibold text-on-surface"
        data-testid="match-summary"
      >
        {tSummary("count", { count: total })}
      </p>
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 text-xs text-on-surface-variant"
          data-testid="match-sort"
        >
          <span>{tSort("label")}:</span>
          {(["value", "followers", "recent"] as const).map((s) => (
            <a
              key={s}
              href={withFilter({ sort: s, cursor: undefined })}
              data-testid={`match-sort-${s}`}
              className={cn(
                "rounded px-2 py-0.5",
                sort === s ? "bg-cyan/20 text-cyan" : "hover:text-cyan",
              )}
            >
              {tSort(s)}
            </a>
          ))}
        </div>
        <div
          className="flex items-center gap-1 rounded-md border border-white/10 bg-navy-base/40 p-1"
          role="group"
          aria-label={tView("label")}
          data-testid="match-view-toggle"
        >
          {(["card", "table"] as const).map((v) => {
            const isActive = view === v;
            const href = withParams({ view: v === "card" ? undefined : v });
            return (
              <a
                key={v}
                href={href}
                data-testid={`match-view-${v}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
                  isActive
                    ? "bg-cyan/20 text-cyan"
                    : "text-on-surface-variant hover:text-cyan",
                )}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  aria-hidden
                >
                  {v === "card" ? "grid_view" : "table_rows"}
                </span>
                <span className="sr-only">{tView(v)}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
