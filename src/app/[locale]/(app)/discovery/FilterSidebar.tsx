/**
 * BM1-F004 · Filter sidebar (server component).
 *
 * Pure HTML GET form — checkboxes that aren't ticked are simply absent
 * in the next URL, so we don't need client state to track the filter
 * object. The page re-renders off the URL; parseFilters rebuilds the
 * DiscoveryFilters from searchParams. No "use client" needed.
 */
import { getTranslations } from "next-intl/server";

import {
  BRAND_SAFETY_RATINGS,
  DISCOVERY_CATEGORIES,
  DISCOVERY_PLATFORMS,
  DISCOVERY_REGIONS,
  LAST_UPLOAD_WINDOWS,
  MONETIZATION_STATUSES,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
}

const CHIP_BASE =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors select-none";
const CHIP_OFF =
  "border-outline-variant bg-surface/40 text-on-surface-variant hover:border-cyan/40";
const INPUT_CLASS =
  "w-full rounded-lg border border-outline-variant bg-surface/40 px-3 py-2 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

export async function FilterSidebar({ filters, basePath }: Props) {
  const t = await getTranslations("discovery.filters");
  const tRegions = await getTranslations("discovery.regions");
  const tCategories = await getTranslations("discovery.categories");
  const tPlatforms = await getTranslations("discovery.platforms");

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="discovery-filters"
      className="glass-panel flex flex-col gap-6 rounded-xl border border-on-surface/5 p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{t("heading")}</h2>
        <a
          href={basePath}
          className="text-xs text-on-surface-variant transition-colors hover:text-cyan"
        >
          {t("clearAll")}
        </a>
      </div>

      {/* Basic 4: search / followers / region / category */}
      <div className="space-y-2">
        <Label>{t("search")}</Label>
        <input
          type="search"
          name="search"
          defaultValue={filters.search ?? ""}
          placeholder={t("searchPlaceholder")}
          className={INPUT_CLASS}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("followers")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            name="followersMin"
            defaultValue={filters.followersMin ?? ""}
            min={0}
            placeholder={t("followersMin")}
            className={INPUT_CLASS}
          />
          <input
            type="number"
            name="followersMax"
            defaultValue={filters.followersMax ?? ""}
            min={0}
            placeholder={t("followersMax")}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <ChipGroup label={t("region")}>
        {DISCOVERY_REGIONS.map((code) => (
          <ChipCheckbox
            key={code}
            name="regions"
            value={code}
            label={tRegions(code)}
            checked={filters.regions.includes(code)}
            dataTestid={`filter-region-${code}`}
          />
        ))}
      </ChipGroup>

      <ChipGroup label={t("category")}>
        {DISCOVERY_CATEGORIES.map((c) => (
          <ChipCheckbox
            key={c}
            name="categories"
            value={c}
            label={tCategories(c)}
            checked={filters.categories.includes(c)}
            dataTestid={`filter-category-${c}`}
          />
        ))}
      </ChipGroup>

      {/* Advanced 11, collapsed by default using native <details> */}
      <details
        className="-mx-1 rounded-lg border border-outline-variant/30 px-3 py-2 open:pb-4"
        {...(hasAnyAdvanced(filters) ? { open: true } : {})}
      >
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-cyan-fixed">
          {t("advancedToggle")}
        </summary>

        <div className="mt-4 flex flex-col gap-6">
          <ChipGroup label={t("platform")}>
            {DISCOVERY_PLATFORMS.map((p) => (
              <ChipCheckbox
                key={p}
                name="platforms"
                value={p}
                label={tPlatforms(p)}
                checked={filters.platforms.includes(p)}
              />
            ))}
          </ChipGroup>

          <div className="space-y-2">
            <Label>{t("language")}</Label>
            <input
              type="text"
              name="languages"
              defaultValue={filters.languages.join(",")}
              placeholder="en, zh, ja"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("engagement")}</Label>
              <input
                type="number"
                name="engagementMin"
                defaultValue={filters.engagementMin ?? ""}
                min={0}
                max={100}
                step="0.1"
                placeholder={t("engagementPlaceholder")}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("avgViews")}</Label>
              <input
                type="number"
                name="avgViewsMin"
                defaultValue={filters.avgViewsMin ?? ""}
                min={0}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("uploads")}</Label>
              <input
                type="number"
                name="uploadsPerMonthMin"
                defaultValue={filters.uploadsPerMonthMin ?? ""}
                min={0}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("lastUpload")}</Label>
              <select
                name="lastUpload"
                defaultValue={filters.lastUploadWithinDays?.toString() ?? ""}
                className={INPUT_CLASS}
              >
                <option value="">{t("lastUploadAny")}</option>
                {LAST_UPLOAD_WINDOWS.map((d) => (
                  <option key={d} value={d}>
                    {t(`lastUpload${d}` as `lastUpload${30 | 90 | 180}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ChipGroup label={t("monetization")}>
            {MONETIZATION_STATUSES.map((m) => (
              <ChipCheckbox
                key={m}
                name="monetization"
                value={m}
                label={t(
                  `monetization${m[0]}${m.slice(1).toLowerCase()}` as
                    | "monetizationVerified"
                    | "monetizationMonetized"
                    | "monetizationNone"
                )}
                checked={filters.monetizationStatuses.includes(m)}
              />
            ))}
          </ChipGroup>

          <ChipGroup label={t("brandSafety")}>
            {BRAND_SAFETY_RATINGS.map((b) => (
              <ChipCheckbox
                key={b}
                name="brandSafety"
                value={b}
                label={t(
                  `brandSafety${b}` as
                    | "brandSafetyG"
                    | "brandSafetyPG"
                    | "brandSafetyPG13"
                    | "brandSafetyR"
                )}
                checked={filters.brandSafety.includes(b)}
              />
            ))}
          </ChipGroup>

          <div className="space-y-2">
            <Label>{t("knownCollabs")}</Label>
            <input
              type="text"
              name="knownCollabs"
              defaultValue={filters.knownCollabs.join(",")}
              placeholder={t("knownCollabsPlaceholder")}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("tags")}</Label>
            <input
              type="text"
              name="tags"
              defaultValue={filters.tags.join(",")}
              placeholder={t("tagsPlaceholder")}
              className={INPUT_CLASS}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="includeNonGaming"
              defaultChecked={filters.includeNonGaming}
              className="mt-1 h-4 w-4 rounded border-outline-variant bg-surface-high text-cyan"
            />
            <span>
              <span className="block text-sm text-on-surface">
                {t("includeNonGaming")}
              </span>
              <span className="block text-[11px] text-on-surface-variant/70">
                {t("includeNonGamingHelper")}
              </span>
            </span>
          </label>
        </div>
      </details>

      {/* Keep sort sticky across filter submissions */}
      <input type="hidden" name="sort" value={filters.sort} />

      <button
        type="submit"
        className="gradient-cta mt-2 rounded-lg py-2.5 text-sm font-bold text-on-primary shadow-[0_0_15px_rgba(0,229,255,0.2)]"
      >
        {t("apply")}
      </button>
    </form>
  );
}

function hasAnyAdvanced(f: DiscoveryFilters): boolean {
  return (
    f.platforms.length > 0 ||
    f.languages.length > 0 ||
    f.engagementMin != null ||
    f.avgViewsMin != null ||
    f.uploadsPerMonthMin != null ||
    f.lastUploadWithinDays != null ||
    f.monetizationStatuses.length > 0 ||
    f.brandSafety.length > 0 ||
    f.knownCollabs.length > 0 ||
    f.tags.length > 0 ||
    f.includeNonGaming
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </span>
  );
}

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

interface ChipCheckboxProps {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  dataTestid?: string;
}

function ChipCheckbox({
  name,
  value,
  label,
  checked,
  dataTestid,
}: ChipCheckboxProps) {
  return (
    <label className="inline-flex">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer sr-only"
        data-testid={dataTestid}
      />
      <span
        className={cn(
          CHIP_BASE,
          CHIP_OFF,
          "peer-checked:border-cyan/60 peer-checked:bg-cyan/20 peer-checked:text-cyan peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/50"
        )}
      >
        {label}
      </span>
    </label>
  );
}
