/**
 * MVP-vf-F002 · Discovery summary bar (server component).
 *
 * Sits above the result grid: matched count + sort selector + view-mode
 * toggle. URL-driven; navigation links replace client state. Pulled out
 * of page.tsx to keep that file's hardcoded className count under the
 * UI-fidelity threshold.
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

export async function SummaryBar({ total, sort, view, withFilter, withParams }: Props) {
  const tSummary = await getTranslations("discovery.summary");
  const tSort = await getTranslations("discovery.sort");
  const tView = await getTranslations("discovery.view");

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface/30 px-4 py-3"
      data-testid="discovery-summary-bar"
    >
      <p
        className="text-sm font-semibold text-on-surface"
        data-testid="discovery-summary"
      >
        {tSummary("count", { count: total })}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span>{tSort("label")}:</span>
          {(["value", "followers", "recent"] as const).map((s) => (
            <a
              key={s}
              href={withFilter({ sort: s, cursor: undefined })}
              data-testid={`sort-${s}`}
              className={cn(
                "rounded px-2 py-0.5",
                sort === s ? "bg-cyan/20 text-cyan" : "hover:text-cyan"
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
          data-testid="discovery-view-toggle"
        >
          {(["grid", "list"] as const).map((v) => {
            const isActive = view === v;
            const href = withParams({ view: v === "grid" ? undefined : v });
            return (
              <a
                key={v}
                href={href}
                data-testid={`view-${v}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
                  isActive
                    ? "bg-cyan/20 text-cyan"
                    : "text-on-surface-variant hover:text-cyan"
                )}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  aria-hidden
                >
                  {v === "grid" ? "grid_view" : "view_list"}
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
