/**
 * BM2-F003 · Campaigns list filter bar (server component).
 *
 * Two dims only (status dropdown + search input) per spec §F003 and
 * adjudication §7 #E. URL-driven GET form — unchecked values drop out
 * of the URL, `parseCampaignFilters` reconstructs the shape on the
 * next request. Submitting resets `cursor` so the user lands back on
 * page 1 (handled implicitly by not forwarding the hidden cursor).
 */
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

import {
  CAMPAIGN_STATUS_FILTER_VALUES,
  type CampaignStatusFilter,
} from "@/lib/campaigns/status";
import type { CampaignListFilters } from "@/lib/campaigns/filters";

interface Props {
  filters: CampaignListFilters;
  basePath: string;
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
      {children}
    </label>
  );
}

export async function CampaignsFilterBar({ filters, basePath }: Props) {
  const t = await getTranslations("campaigns.filters");
  const tStatus = await getTranslations("campaigns.status");

  const anyFilter =
    Boolean(filters.search) || filters.status !== "all";

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="campaigns-filters"
      className="glass-panel flex flex-col gap-4 rounded-xl border border-on-surface/5 p-5 lg:flex-row lg:items-end lg:gap-6"
    >
      <div className="min-w-0 flex-1 lg:max-w-md">
        <Label>{t("search")}</Label>
        <input
          type="search"
          name="search"
          defaultValue={filters.search ?? ""}
          placeholder={t("searchPlaceholder")}
          maxLength={200}
          data-testid="campaigns-search-input"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex-1 lg:max-w-xs">
        <Label>{t("status")}</Label>
        <select
          name="status"
          defaultValue={filters.status}
          data-testid="campaigns-status-select"
          className={INPUT_CLASS}
        >
          {CAMPAIGN_STATUS_FILTER_VALUES.map((s: CampaignStatusFilter) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          data-testid="campaigns-filters-apply"
          className={cn(
            "gradient-cta h-10 rounded-lg px-5 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          )}
        >
          {t("apply")}
        </button>
        {anyFilter ? (
          <a
            href={basePath}
            data-testid="campaigns-filters-clear"
            className="flex h-10 items-center rounded-lg border border-outline-variant px-4 text-sm text-on-surface-variant transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            {t("clearAll")}
          </a>
        ) : null}
      </div>
    </form>
  );
}
