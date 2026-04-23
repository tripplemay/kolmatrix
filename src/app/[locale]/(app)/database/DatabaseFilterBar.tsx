/**
 * BM1-F005 · Simplified filter bar (server component).
 *
 * 4 dims laid out inline across the top of the table — no advanced
 * collapse (that stays on /discovery). Same URL-driven GET form pattern
 * as /discovery: unchecked boxes drop out of the URL, `parseFilters`
 * reconstructs the shape on the next request.
 */
import { getTranslations } from "next-intl/server";

import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_REGIONS,
  RELATIONSHIP_STATUSES,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

export async function DatabaseFilterBar({ filters, basePath }: Props) {
  const t = await getTranslations("database.filters");
  const tRegions = await getTranslations("discovery.regions");
  const tCategories = await getTranslations("discovery.categories");
  const tStatus = await getTranslations("relationshipStatus");

  const anyFilter =
    Boolean(filters.search) ||
    filters.regions.length > 0 ||
    filters.categories.length > 0 ||
    filters.relationshipStatuses.length > 0;

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="database-filters"
      className="glass-panel flex flex-col gap-4 rounded-xl border border-on-surface/5 p-5 lg:flex-row lg:items-end lg:gap-6"
    >
      <div className="min-w-0 flex-1 lg:max-w-sm">
        <Label>{t("search")}</Label>
        <input
          type="search"
          name="search"
          defaultValue={filters.search ?? ""}
          placeholder={t("searchPlaceholder")}
          maxLength={200}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex-1">
        <Label>{t("category")}</Label>
        <select
          name="categories"
          defaultValue={filters.categories[0] ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">—</option>
          {DISCOVERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tCategories(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <Label>{t("region")}</Label>
        <select
          name="regions"
          defaultValue={filters.regions[0] ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">—</option>
          {DISCOVERY_REGIONS.map((r) => (
            <option key={r} value={r}>
              {tRegions(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <Label>{t("status")}</Label>
        <select
          name="relationshipStatus"
          defaultValue={filters.relationshipStatuses[0] ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">{t("statusAny")}</option>
          {RELATIONSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Preserve sort across filter submissions */}
      <input type="hidden" name="sort" value={filters.sort} />

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className={cn(
            "gradient-cta h-10 rounded-lg px-5 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          )}
        >
          {t("apply")}
        </button>
        {anyFilter ? (
          <a
            href={basePath}
            className="h-10 rounded-lg border border-outline-variant px-4 text-sm font-medium text-on-surface-variant leading-[2.35rem] transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            {t("clearAll")}
          </a>
        ) : null}
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </span>
  );
}
