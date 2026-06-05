/**
 * BL-065-F002 · /match top search bar (server component).
 *
 * Inherits the BM1 /discovery SearchBar shell (platform selector +
 * keyword input + URL-driven GET form) but intentionally drops the
 * BL-044 AI chips: free-text semantic search on the /match workbench
 * is BL-068 (B3 natural-language refine) territory, not BL-065. The
 * sidebar `?ai=` chips would silently produce empty results today
 * because runMatchSearch only honours `search`, so cutting them at the
 * UI layer is the safer F002 scope.
 *
 * Same carryover-hidden-input pattern as Discovery's SearchBar so the
 * search submission preserves the sidebar's filter selections.
 */
import { getTranslations } from "next-intl/server";

import { DISCOVERY_PLATFORMS, type DiscoveryFilters } from "@/lib/kol/filters";

interface Props {
  basePath: string;
  filters: DiscoveryFilters;
  /**
   * Stay-in-view-mode signal: "table" carries `?view=table`; BL-084-F007
   * "full-pool" carries `?view=full-pool` so a search inside a campaign
   * context does not bounce back to the AI panel default.
   */
  view?: "card" | "table" | "full-pool";
  /** Stay-in-campaign-context signal: carries `?campaignId=xxx`. */
  campaignId?: string | null;
}

export async function MatchSearchBar({
  basePath,
  filters,
  view,
  campaignId,
}: Props) {
  const t = await getTranslations("match.searchBar");
  const tPlatforms = await getTranslations("match.platforms");

  const carryover = buildCarryoverFields(filters, { view, campaignId });

  return (
    <section
      data-testid="match-search-bar"
      className="space-y-3"
      aria-label={t("ariaSection")}
    >
      <form
        action={basePath}
        method="get"
        role="search"
        className="glass-panel border-on-surface/5 focus-within:border-cyan/30 focus-within:ring-cyan/30 flex h-14 items-center overflow-hidden rounded-xl border px-4 transition-colors focus-within:ring-1"
      >
        <label className="text-on-surface-variant flex items-center gap-2 border-r border-white/10 pr-4 text-sm font-medium">
          <span className="material-symbols-outlined text-base" aria-hidden>
            public
          </span>
          <span className="sr-only">{t("platformAll")}</span>
          <select
            name="platforms"
            defaultValue={filters.platforms[0] ?? ""}
            className="text-on-surface-variant cursor-pointer appearance-none border-0 bg-transparent pr-2 text-sm font-medium focus:outline-none"
            data-testid="match-search-platform-select"
          >
            <option value="">{t("platformAll")}</option>
            {DISCOVERY_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {tPlatforms(p)}
              </option>
            ))}
          </select>
        </label>
        <span
          className="material-symbols-outlined text-on-surface-variant ml-4"
          aria-hidden
        >
          search
        </span>
        <input
          type="search"
          name="search"
          defaultValue={filters.search ?? ""}
          placeholder={t("placeholder")}
          maxLength={200}
          className="text-on-surface placeholder-on-surface-variant/60 h-full flex-1 border-0 bg-transparent px-4 text-sm outline-none focus:ring-0"
          data-testid="match-search-main-input"
        />
        {carryover}
        <button type="submit" className="sr-only">
          {t("submit")}
        </button>
      </form>
    </section>
  );
}

function buildCarryoverFields(
  f: DiscoveryFilters,
  extras: {
    view?: "card" | "table" | "full-pool";
    campaignId?: string | null;
  },
): React.ReactNode[] {
  const fields: React.ReactNode[] = [];
  let i = 0;
  const add = (name: string, value: string | number | boolean | null) => {
    if (value == null || value === "" || value === false) return;
    fields.push(
      <input key={i++} type="hidden" name={name} value={String(value)} />,
    );
  };
  const addAll = (name: string, values: readonly string[]) => {
    for (const v of values) {
      fields.push(<input key={i++} type="hidden" name={name} value={v} />);
    }
  };

  add("followersMin", f.followersMin ?? null);
  add("followersMax", f.followersMax ?? null);
  addAll("regions", f.regions);
  addAll("categories", f.categories);
  addAll("languages", f.languages);
  add("engagementMin", f.engagementMin ?? null);
  add("avgViewsMin", f.avgViewsMin ?? null);
  add("uploadsPerMonthMin", f.uploadsPerMonthMin ?? null);
  add("lastUpload", f.lastUploadWithinDays ?? null);
  addAll("monetization", f.monetizationStatuses);
  addAll("brandSafety", f.brandSafety);
  addAll("relationshipStatus", f.relationshipStatuses);
  addAll("knownCollabs", f.knownCollabs);
  addAll("tags", f.tags);
  addAll("tiers", f.tiers ?? []);
  addAll("channelAge", f.channelAge);
  addAll("uploadFrequency", f.uploadFrequency);
  addAll("regionGroup", f.regionGroup);
  if (f.includeNonGaming) add("includeNonGaming", "on");
  add("sort", f.sort);
  if (extras.view === "table") add("view", "table");
  else if (extras.view === "full-pool") add("view", "full-pool");
  if (extras.campaignId) add("campaignId", extras.campaignId);

  return fields;
}
