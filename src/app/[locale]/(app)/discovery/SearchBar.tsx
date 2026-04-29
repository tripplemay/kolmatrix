/**
 * MVP-vf-F002 · Discovery main search bar (server component).
 *
 * Top-of-page search experience matching the Stitch kol-discovery
 * prototype:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ All platforms ▾ | 🔍 Search input ……………………………………… │
 *   └───────────────────────────────────────────────────────────┘
 *   [🎮 FPS creators…]  [📈 High-growth Twitch…]  [🎯 RPG mobile…]
 *
 * The platform selector is wired to the existing `platforms` filter:
 * choosing a platform here applies the same filter the sidebar exposes
 * under Advanced filters. AI Chips are static suggested-search shortcuts
 * that prefill `?search=`.
 *
 * Stays a server component — submission goes through a native GET form
 * targeted at /discovery, the page itself re-renders off the URL.
 */
import { getTranslations } from "next-intl/server";

import { DISCOVERY_PLATFORMS, type DiscoveryFilters } from "@/lib/kol/filters";

interface Props {
  basePath: string;
  filters: DiscoveryFilters;
}

export async function SearchBar({ basePath, filters }: Props) {
  const t = await getTranslations("discovery.searchBar");
  const tPlatforms = await getTranslations("discovery.platforms");

  // Hidden inputs roundtrip the existing filter state so the search
  // submission inherits sidebar-side filter selections.
  const carryover = buildCarryoverFields(filters);

  return (
    <section
      data-testid="discovery-search-bar"
      className="space-y-3"
      aria-label="Search KOLs"
    >
      <form
        action={basePath}
        method="get"
        role="search"
        className="glass-panel flex h-14 items-center overflow-hidden rounded-xl border border-on-surface/5 px-4 transition-colors focus-within:border-cyan/30 focus-within:ring-1 focus-within:ring-cyan/30"
      >
        <label className="flex items-center gap-2 border-r border-white/10 pr-4 text-sm font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-base" aria-hidden>
            public
          </span>
          <span className="sr-only">{t("platformAll")}</span>
          <select
            name="platforms"
            defaultValue={filters.platforms[0] ?? ""}
            className="cursor-pointer appearance-none border-0 bg-transparent pr-2 text-sm font-medium text-on-surface-variant focus:outline-none"
            data-testid="search-platform-select"
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
          className="material-symbols-outlined ml-4 text-on-surface-variant"
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
          className="h-full flex-1 border-0 bg-transparent px-4 text-sm text-on-surface placeholder-on-surface-variant/60 outline-none focus:ring-0"
          data-testid="search-main-input"
        />
        {carryover}
        <button type="submit" className="sr-only">
          {t("submit")}
        </button>
      </form>

      <div
        className="flex flex-wrap items-center gap-2 pb-1"
        data-testid="discovery-ai-chips"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {t("aiChipsHeading")}
        </span>
        {(["chip1", "chip2", "chip3"] as const).map((key, i) => {
          const label = t(key);
          const href = `${basePath}?search=${encodeURIComponent(label)}`;
          return (
            <a
              key={key}
              href={href}
              data-testid={`ai-chip-${i + 1}`}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-cyan/30 bg-cyan/5 px-4 py-2 text-xs font-medium text-cyan-fixed transition-colors hover:bg-cyan/10"
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden
              >
                auto_awesome
              </span>
              {label}
            </a>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Carry forward every active filter as a hidden input so the search
 * submission preserves sidebar selections. Without these, submitting
 * the search bar would wipe the user's carefully-chosen filter set.
 *
 * Skip `search` and `platforms` — those two are owned by the bar's
 * own visible inputs and already submit by name. Skip `cursor` so a
 * new search starts from page 1.
 */
function buildCarryoverFields(f: DiscoveryFilters): React.ReactNode[] {
  const fields: React.ReactNode[] = [];
  let i = 0;
  const add = (name: string, value: string | number | boolean | null) => {
    if (value == null || value === "" || value === false) return;
    fields.push(<input key={i++} type="hidden" name={name} value={String(value)} />);
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
  addAll("knownCollabs", f.knownCollabs);
  addAll("tags", f.tags);
  // B5-F003 — carry the three new advanced filter dimensions so the
  // search bar's submit doesn't drop them.
  addAll("channelAge", f.channelAge);
  addAll("uploadFrequency", f.uploadFrequency);
  addAll("regionGroup", f.regionGroup);
  if (f.includeNonGaming) add("includeNonGaming", "on");
  add("sort", f.sort);

  return fields;
}
