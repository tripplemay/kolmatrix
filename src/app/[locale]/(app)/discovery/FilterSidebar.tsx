/**
 * BM1-F004 + MVP-vf-F002 · Filter sidebar (server component).
 *
 * Pure HTML GET form — checkboxes that aren't ticked are simply absent
 * in the next URL, so we don't need client state to track the filter
 * object. The page re-renders off the URL; parseFilters rebuilds the
 * DiscoveryFilters from searchParams.
 *
 * MVP-vf-F002 hotfix: replaced local INPUT_CLASS / CHIP_BASE constants
 * with `<Input>` / `<Select>` / `<Button>` from the public component
 * library so the visuals match the rest of the app and future
 * page-rewrites can copy the pattern.
 *
 * B5-F003: added the three new filter dimensions (channelAge,
 * uploadFrequency, regionGroup) inside the existing <details> advanced
 * section. The advanced section's open/closed state is persisted in a
 * cookie (`kolm_disco_advanced` = "1" / "0") so a marketer who manually
 * expands it once doesn't have to re-expand on every Discovery visit.
 */
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Button, Input, Label, Select } from "@/components/ui";

import { AdvancedToggleCookie } from "./AdvancedToggleCookie";
import {
  BRAND_SAFETY_RATINGS,
  CHANNEL_AGE_TIERS,
  DISCOVERY_CATEGORIES,
  DISCOVERY_PLATFORMS,
  DISCOVERY_REGIONS,
  LAST_UPLOAD_WINDOWS,
  MONETIZATION_STATUSES,
  REGION_GROUPS,
  UPLOAD_FREQUENCY_TIERS,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

const ADVANCED_COOKIE_NAME = "kolm_disco_advanced";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
  /**
   * BL-044 F002 / pre-impl #4:B Soft override — when true, the sidebar
   * stays visible but its inputs are visually disabled with a tooltip,
   * so the user understands their category/region selection has no
   * effect during AI semantic search. The functional bypass lives in
   * page.tsx (which routes to `runSemanticDiscoverySearch` and never
   * threads the sidebar values through `buildKolWhere`).
   */
  disabled?: boolean;
}

export async function FilterSidebar({ filters, basePath, disabled = false }: Props) {
  const t = await getTranslations("discovery.filters");
  const tRegions = await getTranslations("discovery.regions");
  const tCategories = await getTranslations("discovery.categories");
  const tPlatforms = await getTranslations("discovery.platforms");

  // B5-F003: open the advanced <details> when (a) any advanced filter
  // is currently active in the URL, or (b) the marketer expanded it on
  // a previous visit (cookie). The cookie is written by the inline
  // toggle script below, so the round-trip is purely client-side ↔
  // server-side via the request cookie header.
  const cookieJar = await cookies();
  const advancedCookie = cookieJar.get(ADVANCED_COOKIE_NAME)?.value;
  const advancedOpen = advancedCookie === "1" || hasAnyAdvanced(filters);

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="discovery-filters"
      data-ai-disabled={disabled ? "true" : undefined}
      title={disabled ? t("disabledByAi") : undefined}
      className={cn(
        "glass-panel border-on-surface/5 flex flex-col gap-6 rounded-xl border p-5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {disabled ? (
        <div
          role="status"
          data-testid="discovery-filters-disabled-banner"
          className="border-amber/40 bg-amber/10 text-amber-fixed -mb-2 rounded-md border px-3 py-2 text-[11px] leading-snug"
        >
          {t("disabledByAi")}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{t("heading")}</h2>
        <a
          href={basePath}
          className="text-on-surface-variant hover:text-cyan text-xs transition-colors"
        >
          {t("clearAll")}
        </a>
      </div>

      {/* Basic 4: search / followers / region / category */}
      <Field label={t("search")}>
        <Input
          type="search"
          name="search"
          defaultValue={filters.search ?? ""}
          placeholder={t("searchPlaceholder")}
          maxLength={200}
        />
      </Field>

      <Field label={t("followers")}>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            name="followersMin"
            defaultValue={filters.followersMin ?? ""}
            min={0}
            placeholder={t("followersMin")}
          />
          <Input
            type="number"
            name="followersMax"
            defaultValue={filters.followersMax ?? ""}
            min={0}
            placeholder={t("followersMax")}
          />
        </div>
      </Field>

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

      {/* Advanced filters, collapsed by default using native <details>.
         B5-F003 added channelAge / uploadFrequency / regionGroup. */}
      <details
        data-disco-advanced
        className="border-outline-variant/30 -mx-1 rounded-lg border px-3 py-2 open:pb-4"
        {...(advancedOpen ? { open: true } : {})}
      >
        <summary className="text-cyan-fixed cursor-pointer text-xs font-semibold tracking-wider uppercase select-none">
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

          <Field label={t("language")}>
            <Input
              type="text"
              name="languages"
              defaultValue={filters.languages.join(",")}
              placeholder="en, zh, ja"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("engagement")} compact>
              <Input
                type="number"
                name="engagementMin"
                defaultValue={filters.engagementMin ?? ""}
                min={0}
                max={100}
                step="0.1"
                placeholder={t("engagementPlaceholder")}
              />
            </Field>
            <Field label={t("avgViews")} compact>
              <Input
                type="number"
                name="avgViewsMin"
                defaultValue={filters.avgViewsMin ?? ""}
                min={0}
              />
            </Field>
            <Field label={t("uploads")} compact>
              <Input
                type="number"
                name="uploadsPerMonthMin"
                defaultValue={filters.uploadsPerMonthMin ?? ""}
                min={0}
              />
            </Field>
            <Field label={t("lastUpload")} compact>
              <Select
                name="lastUpload"
                defaultValue={filters.lastUploadWithinDays?.toString() ?? ""}
              >
                <option value="">{t("lastUploadAny")}</option>
                {LAST_UPLOAD_WINDOWS.map((d) => (
                  <option key={d} value={d}>
                    {t(`lastUpload${d}` as `lastUpload${30 | 90 | 180}`)}
                  </option>
                ))}
              </Select>
            </Field>
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

          <Field label={t("knownCollabs")}>
            <Input
              type="text"
              name="knownCollabs"
              defaultValue={filters.knownCollabs.join(",")}
              placeholder={t("knownCollabsPlaceholder")}
            />
          </Field>

          <Field label={t("tags")}>
            <Input
              type="text"
              name="tags"
              defaultValue={filters.tags.join(",")}
              placeholder={t("tagsPlaceholder")}
            />
          </Field>

          {/* B5-F003 — three new advanced filter chips. Each chip
             group binds onto the same param name as the checkbox value
             so the form GET serializes correctly. */}
          <ChipGroup label={t("channelAge")}>
            {CHANNEL_AGE_TIERS.map((tier) => (
              <ChipCheckbox
                key={tier}
                name="channelAge"
                value={tier}
                label={t(
                  `channelAge_${tier}` as
                    | "channelAge_new"
                    | "channelAge_established"
                    | "channelAge_veteran"
                )}
                checked={filters.channelAge.includes(tier)}
                dataTestid={`filter-channel-age-${tier}`}
              />
            ))}
          </ChipGroup>

          <ChipGroup label={t("uploadFrequency")}>
            {UPLOAD_FREQUENCY_TIERS.map((tier) => (
              <ChipCheckbox
                key={tier}
                name="uploadFrequency"
                value={tier}
                label={t(
                  `uploadFrequency_${tier}` as
                    | "uploadFrequency_active"
                    | "uploadFrequency_semi-active"
                    | "uploadFrequency_inactive"
                )}
                checked={filters.uploadFrequency.includes(tier)}
                dataTestid={`filter-upload-freq-${tier}`}
              />
            ))}
          </ChipGroup>

          <ChipGroup label={t("regionGroup")}>
            {REGION_GROUPS.map((grp) => (
              <ChipCheckbox
                key={grp}
                name="regionGroup"
                value={grp}
                label={t(
                  `regionGroup_${grp}` as
                    | "regionGroup_asia"
                    | "regionGroup_europe"
                    | "regionGroup_americas"
                    | "regionGroup_latam"
                    | "regionGroup_oceania"
                )}
                checked={filters.regionGroup.includes(grp)}
                dataTestid={`filter-region-group-${grp}`}
              />
            ))}
          </ChipGroup>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="includeNonGaming"
              defaultChecked={filters.includeNonGaming}
              className="border-outline-variant bg-surface-high text-cyan mt-1 h-4 w-4 rounded"
            />
            <span>
              <span className="text-on-surface block text-sm">{t("includeNonGaming")}</span>
              <span className="text-on-surface-variant/70 block text-[11px]">
                {t("includeNonGamingHelper")}
              </span>
            </span>
          </label>
        </div>
      </details>

      {/* B5-F003 cookie persistence (BL-020-F003 hardening): the previous
         inline-script IIFE is replaced by a client component that
         attaches a `toggle` listener via useEffect. Behaviour is
         identical — write `kolm_disco_advanced=1|0` on each toggle. */}
      <AdvancedToggleCookie cookieName={ADVANCED_COOKIE_NAME} />

      {/* Keep sort sticky across filter submissions */}
      <input type="hidden" name="sort" value={filters.sort} />

      <Button type="submit" variant="primary-gradient" className="mt-2 w-full">
        {t("apply")}
      </Button>
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
    // B5-F003 — also auto-open when any of the three new advanced
    // filters is in play.
    f.channelAge.length > 0 ||
    f.uploadFrequency.length > 0 ||
    f.regionGroup.length > 0 ||
    f.monetizationStatuses.length > 0 ||
    f.brandSafety.length > 0 ||
    f.knownCollabs.length > 0 ||
    f.tags.length > 0 ||
    f.includeNonGaming
  );
}

function Field({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  /** Tightens the label/control gap for the 2-col grid pairs. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">{children}</div>
    </Field>
  );
}

interface ChipCheckboxProps {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  dataTestid?: string;
}

/**
 * Filter chip rendered as a labeled checkbox so the filter form stays
 * URL-driven (no client state). Visual tokens match `<ChipButton>` —
 * inert/hover/checked all use the same cyan border/background palette
 * — but the shape is rounded-lg (not pill) to match the Stitch
 * filter-sidebar prototype.
 */
function ChipCheckbox({ name, value, label, checked, dataTestid }: ChipCheckboxProps) {
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
          "inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors select-none",
          "border-outline-variant bg-surface/40 text-on-surface-variant hover:border-cyan/40 hover:text-cyan",
          "peer-checked:border-cyan/60 peer-checked:bg-cyan/20 peer-checked:text-cyan",
          "peer-focus-visible:ring-cyan/50 peer-focus-visible:ring-2"
        )}
      >
        {label}
      </span>
    </label>
  );
}
