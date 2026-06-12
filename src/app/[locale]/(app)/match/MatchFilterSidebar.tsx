/**
 * BL-065-F002 · Unified filter sidebar for the /match workbench.
 *
 * Merges the BM1 /discovery FilterSidebar (15 dims) with the BM1
 * /database DatabaseFilterBar (status pills + tier dropdown), drops the
 * /database "Game" duplicate (it bound to the same `categories` param
 * as the Category select — verified in DatabaseFilterBar.tsx L131-140),
 * and keeps the AdvancedToggleCookie persistence so the advanced
 * <details> section's open/closed state survives reloads.
 *
 * Layout (top-to-bottom):
 *   1. Heading + clearAll
 *   2. Relationship-status pill row (BM1 /database — All / Prospect /
 *      First contact / Negotiating / Long-term / Paused / Terminated).
 *      URL-driven anchors so the form submit doesn't reset them.
 *   3. Basic 4 (Discovery): search / followers / regions chips /
 *      categories chips.
 *   4. Advanced <details> (collapsed): tier (Database) + 11 Discovery
 *      advanced dimensions (platforms / languages / engagement /
 *      avgViews / uploads / lastUpload / monetization / brandSafety /
 *      knownCollabs / tags / channelAge / uploadFrequency / regionGroup /
 *      includeNonGaming).
 *
 * URL-driven GET form; parseFilters rebuilds DiscoveryFilters on every
 * render. No client state — checkbox chips that aren't ticked are
 * simply absent from the next URL.
 */
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { ChipButton } from "@/components/common";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  BRAND_SAFETY_RATINGS,
  CHANNEL_AGE_TIERS,
  DISCOVERY_CATEGORIES,
  DISCOVERY_PLATFORMS,
  DISCOVERY_REGIONS,
  LAST_UPLOAD_WINDOWS,
  MONETIZATION_STATUSES,
  REGION_GROUPS,
  RELATIONSHIP_STATUSES,
  UPLOAD_FREQUENCY_TIERS,
  type DataCoverage,
  type DataFillRates,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { AdvancedToggleCookie } from "./AdvancedToggleCookie";

const ADVANCED_COOKIE_NAME = "kolm_match_advanced";
const STATUS_PILLS = ["all", ...RELATIONSHIP_STATUSES] as const;
const TIER_OPTIONS = ["high", "medium", "low", "unrated"] as const;

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
  /** BL-073-F006 — per-dimension non-NULL distinct values in the
   * tenant's live KOL pool. A facet with `coverage[dim] === 0` is
   * rendered with reduced affordance + a "no data" hint so the user
   * never gets blamed for selecting a filter the pool can't satisfy.
   * Optional for backward-compat with legacy callers (defaults to
   * all-positive coverage = nothing is greyed).
   *
   * BL-075-F005 scope narrowing: the country (regions) + language dims
   * are no longer hard-disabled when coverage>0; they show a
   * "Coverage: N%" hint instead via `fillRates`. Coverage is still
   * consulted for the other dims (platform / category / monetization)
   * because BL-075 does not backfill those columns. */
  coverage?: DataCoverage;
  /** BL-075-F005 — per-dimension fill rate (0-1) used to surface the
   *  "Coverage: N%" hint on country + language so the marketer can
   *  see that BL-075 enriched a fraction of the pool, not all of it.
   *  Optional so older callers can omit it without breaking. */
  fillRates?: DataFillRates;
}

export async function MatchFilterSidebar({
  filters,
  basePath,
  coverage,
  fillRates,
}: Props) {
  const t = await getTranslations("match.filters");
  const tRegions = await getTranslations("match.regions");
  const tCategories = await getTranslations("match.categories");
  const tPlatforms = await getTranslations("match.platforms");
  const tStatus = await getTranslations("relationshipStatus");
  const tDbFilters = await getTranslations("match.filters");
  // BL-073-F006 — disabled-facet copy. Single short label rendered
  // next to a greyed-out chip group when the underlying column has
  // zero coverage in the tenant's live pool.
  const noDataLabel = t.has("noData") ? t("noData") : "(no data)";
  // BL-075-F005 — the country (regions) + language dims drop their
  // hard-disable now that backfill populates a fractional share of the
  // pool. Other dims (platform / category / monetization) still
  // disable on zero coverage because BL-075 does not touch those
  // columns; their "(no data)" branch from BL-073-F006 stays exactly
  // as it was.
  const platformsDisabled = coverage ? coverage.platforms === 0 : false;
  const categoriesDisabled = coverage ? coverage.categories === 0 : false;
  const monetizationDisabled = coverage ? coverage.monetizationStatuses === 0 : false;

  // BL-075-F005 — "Coverage: N%" hint copy. Translated via next-intl
  // ICU placeholder so the percent renders inline in 5 locales. The
  // fillRates struct may be omitted (legacy callers); in that case we
  // render no hint and the chip group looks identical to pre-BL-075.
  function coverageHintFor(
    dim: keyof Pick<DataFillRates, "country" | "language">,
  ): string | undefined {
    if (!fillRates) return undefined;
    if (fillRates.total === 0) return undefined;
    const pct = Math.round(fillRates[dim] * 100);
    return t("coverageHint", { pct });
  }
  const regionsCoverageHint = coverageHintFor("country");
  const languagesCoverageHint = coverageHintFor("language");

  const cookieJar = await cookies();
  const advancedCookie = cookieJar.get(ADVANCED_COOKIE_NAME)?.value;
  const advancedOpen = advancedCookie === "1" || hasAnyAdvanced(filters);

  const currentStatus = filters.relationshipStatuses[0] ?? "all";

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="match-filters"
      className="glass-panel border-on-surface/5 flex flex-col gap-6 rounded-xl border p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{t("heading")}</h2>
        <a
          href={basePath}
          className="text-on-surface-variant hover:text-cyan text-xs transition-colors"
        >
          {t("clearAll")}
        </a>
      </div>

      {/* Relationship-status pills — anchors so they bypass the form
          submit. Each pill carries the rest of the active filter state
          via serializeFilters so clicking doesn't clear sidebar work. */}
      <div className="space-y-2" data-testid="match-status-pills">
        <Label>{tDbFilters("status")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map((s) => {
            const overrides: Partial<DiscoveryFilters> = {
              relationshipStatuses:
                s === "all"
                  ? []
                  : [s as DiscoveryFilters["relationshipStatuses"][number]],
              cursor: undefined,
            };
            const params = serializeFiltersInline(filters, overrides);
            const href = params ? `${basePath}?${params}` : basePath;
            const pressed = currentStatus === s;
            return (
              <a
                key={s}
                href={href}
                data-testid={`match-status-pill-${s}`}
                aria-current={pressed ? "true" : undefined}
              >
                <ChipButton pressed={pressed} type="button" tabIndex={-1}>
                  {s === "all" ? tDbFilters("statusAll") : tStatus(s)}
                </ChipButton>
              </a>
            );
          })}
        </div>
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

      <ChipGroup
        label={t("region")}
        dimensionId="region"
        coverageHint={regionsCoverageHint}
      >
        {DISCOVERY_REGIONS.map((code) => (
          <ChipCheckbox
            key={code}
            name="regions"
            value={code}
            label={tRegions(code)}
            checked={filters.regions.includes(code)}
            dataTestid={`match-filter-region-${code}`}
          />
        ))}
      </ChipGroup>

      <ChipGroup
        label={t("category")}
        dimensionId="category"
        disabledLabel={categoriesDisabled ? noDataLabel : undefined}
      >
        {DISCOVERY_CATEGORIES.map((c) => (
          <ChipCheckbox
            key={c}
            name="categories"
            value={c}
            label={tCategories(c)}
            checked={filters.categories.includes(c)}
            dataTestid={`match-filter-category-${c}`}
            disabled={categoriesDisabled}
          />
        ))}
      </ChipGroup>

      <details
        data-match-advanced
        className="border-outline-variant/30 -mx-1 rounded-lg border px-3 py-2 open:pb-4"
        {...(advancedOpen ? { open: true } : {})}
      >
        <summary className="text-cyan-fixed cursor-pointer text-xs font-semibold tracking-wider uppercase select-none">
          {t("advancedToggle")}
        </summary>

        <div className="mt-4 flex flex-col gap-6">
          <Field label={tDbFilters("tier")}>
            <Select name="tiers" defaultValue={filters.tiers?.[0] ?? ""}>
              <option value="">—</option>
              {TIER_OPTIONS.map((tier) => (
                <option key={tier} value={tier} data-testid={`match-tier-option-${tier}`}>
                  {tDbFilters(
                    `tier${tier[0].toUpperCase()}${tier.slice(1)}` as
                      | "tierHigh"
                      | "tierMedium"
                      | "tierLow"
                      | "tierUnrated",
                  )}
                </option>
              ))}
            </Select>
          </Field>

          <ChipGroup
            label={t("platform")}
            dimensionId="platform"
            disabledLabel={platformsDisabled ? noDataLabel : undefined}
          >
            {DISCOVERY_PLATFORMS.map((p) => (
              <ChipCheckbox
                key={p}
                name="platforms"
                value={p}
                label={tPlatforms(p)}
                checked={filters.platforms.includes(p)}
                disabled={platformsDisabled}
              />
            ))}
          </ChipGroup>

          <Field label={t("language")}>
            <Input
              type="text"
              name="languages"
              defaultValue={filters.languages.join(",")}
              placeholder="en, zh, ja"
              data-testid="match-filter-languages"
            />
            {languagesCoverageHint ? (
              <span
                className="text-on-surface-variant/60 mt-1 block text-[10px]"
                data-testid="match-filter-languages-coverage-hint"
              >
                {languagesCoverageHint}
              </span>
            ) : null}
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

          <ChipGroup
            label={t("monetization")}
            dimensionId="monetization"
            disabledLabel={monetizationDisabled ? noDataLabel : undefined}
          >
            {MONETIZATION_STATUSES.map((m) => (
              <ChipCheckbox
                key={m}
                name="monetization"
                value={m}
                label={t(
                  `monetization${m[0]}${m.slice(1).toLowerCase()}` as
                    | "monetizationVerified"
                    | "monetizationMonetized"
                    | "monetizationNone",
                )}
                checked={filters.monetizationStatuses.includes(m)}
                disabled={monetizationDisabled}
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
                    | "brandSafetyR",
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
                    | "channelAge_veteran",
                )}
                checked={filters.channelAge.includes(tier)}
                dataTestid={`match-filter-channel-age-${tier}`}
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
                    | "uploadFrequency_inactive",
                )}
                checked={filters.uploadFrequency.includes(tier)}
                dataTestid={`match-filter-upload-freq-${tier}`}
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
                    | "regionGroup_oceania",
                )}
                checked={filters.regionGroup.includes(grp)}
                dataTestid={`match-filter-region-group-${grp}`}
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
              <span className="text-on-surface block text-sm">
                {t("includeNonGaming")}
              </span>
              <span className="text-on-surface-variant/70 block text-[11px]">
                {t("includeNonGamingHelper")}
              </span>
            </span>
          </label>

          {/* BL-083-F004 — "has business email" facet. Restricts the list
              to KOLs the fork unlocked a YT business email for. */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="hasBusinessEmail"
              defaultChecked={filters.hasBusinessEmail}
              data-testid="match-filter-has-business-email"
              className="border-outline-variant bg-surface-high text-cyan mt-1 h-4 w-4 rounded"
            />
            <span>
              <span className="text-on-surface block text-sm">
                {t("hasBusinessEmail")}
              </span>
              <span className="text-on-surface-variant/70 block text-[11px]">
                {t("hasBusinessEmailHelper")}
              </span>
            </span>
          </label>
        </div>
      </details>

      <AdvancedToggleCookie cookieName={ADVANCED_COOKIE_NAME} />

      <input type="hidden" name="sort" value={filters.sort} />

      <Button type="submit" variant="primary-gradient" className="mt-2 w-full">
        {t("apply")}
      </Button>
    </form>
  );
}

function hasAnyAdvanced(f: DiscoveryFilters): boolean {
  return (
    (f.tiers?.length ?? 0) > 0 ||
    f.platforms.length > 0 ||
    f.languages.length > 0 ||
    f.engagementMin != null ||
    f.avgViewsMin != null ||
    f.uploadsPerMonthMin != null ||
    f.lastUploadWithinDays != null ||
    f.channelAge.length > 0 ||
    f.uploadFrequency.length > 0 ||
    f.regionGroup.length > 0 ||
    f.monetizationStatuses.length > 0 ||
    f.brandSafety.length > 0 ||
    f.knownCollabs.length > 0 ||
    f.tags.length > 0 ||
    f.includeNonGaming ||
    f.hasBusinessEmail
  );
}

function serializeFiltersInline(
  f: DiscoveryFilters,
  overrides: Partial<DiscoveryFilters>,
): string {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  // BL-107-F002/M7 — never emit `?ai=` (retired); only the real search term.
  if (merged.search) params.set("search", merged.search);
  if (merged.followersMin != null)
    params.set("followersMin", String(merged.followersMin));
  if (merged.followersMax != null)
    params.set("followersMax", String(merged.followersMax));
  for (const v of merged.regions) params.append("regions", v);
  for (const v of merged.categories) params.append("categories", v);
  for (const v of merged.languages) params.append("languages", v);
  for (const v of merged.platforms) params.append("platforms", v);
  if (merged.engagementMin != null)
    params.set("engagementMin", String(merged.engagementMin));
  if (merged.avgViewsMin != null)
    params.set("avgViewsMin", String(merged.avgViewsMin));
  if (merged.uploadsPerMonthMin != null)
    params.set("uploadsPerMonthMin", String(merged.uploadsPerMonthMin));
  if (merged.lastUploadWithinDays)
    params.set("lastUpload", String(merged.lastUploadWithinDays));
  for (const v of merged.monetizationStatuses) params.append("monetization", v);
  for (const v of merged.brandSafety) params.append("brandSafety", v);
  for (const v of merged.relationshipStatuses)
    params.append("relationshipStatus", v);
  for (const v of merged.knownCollabs) params.append("knownCollabs", v);
  for (const v of merged.tags) params.append("tags", v);
  for (const v of merged.tiers ?? []) params.append("tiers", v);
  for (const v of merged.channelAge) params.append("channelAge", v);
  for (const v of merged.uploadFrequency) params.append("uploadFrequency", v);
  for (const v of merged.regionGroup) params.append("regionGroup", v);
  if (merged.includeNonGaming) params.set("includeNonGaming", "on");
  if (merged.hasBusinessEmail) params.set("hasBusinessEmail", "on");
  if (merged.sort !== "value") params.set("sort", merged.sort);
  return params.toString();
}

function Field({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChipGroup({
  label,
  children,
  disabledLabel,
  coverageHint,
  dimensionId,
}: {
  label: string;
  children: React.ReactNode;
  /** BL-073-F006 — when the underlying dimension has zero coverage in
   *  the live tenant pool, the caller passes a short "no data" hint
   *  rendered next to the label so the user can tell the chips are
   *  greyed because the data layer is empty, not because they
   *  mis-clicked. Mutually exclusive with `coverageHint` (if both are
   *  set, `disabledLabel` wins because zero-coverage is strictly
   *  worse than partial coverage). */
  disabledLabel?: string;
  /** BL-075-F005 — positive-coverage hint ("Coverage: 67%") rendered
   *  when the dim is enabled but partially backfilled. Shown only when
   *  `disabledLabel` is absent so the two states never duplicate. */
  coverageHint?: string;
  /** BL-073 fix-round 2 — stable, locale-independent dimension key
   *  embedded in the no-data hint's data-testid so probes can target
   *  e.g. `chip-group-no-data-region` instead of the localised
   *  `chip-group-no-data-区域`. The Reviewer's previous probe attributed
   *  the monetisation hint to "region" because the testid suffix was
   *  the translated label; the stable id eliminates that confusion. */
  dimensionId?: string;
}) {
  const testidSuffix = dimensionId ?? label;
  return (
    <Field label={label}>
      {disabledLabel ? (
        <span
          className="text-on-surface-variant/60 -mt-1 mb-1 block text-[10px]"
          data-testid={`chip-group-no-data-${testidSuffix}`}
        >
          {disabledLabel}
        </span>
      ) : coverageHint ? (
        <span
          className="text-on-surface-variant/60 -mt-1 mb-1 block text-[10px]"
          data-testid={`chip-group-coverage-${testidSuffix}`}
        >
          {coverageHint}
        </span>
      ) : null}
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
  /** BL-073-F006 — render the chip as non-interactive (greyed,
   *  pointer-events-none) when its dimension is empty in the live
   *  pool. The hidden `<input>` is also disabled so a stray form
   *  submit can't smuggle the value back in. */
  disabled?: boolean;
}

function ChipCheckbox({
  name,
  value,
  label,
  checked,
  dataTestid,
  disabled,
}: ChipCheckboxProps) {
  return (
    <label className={cn("inline-flex", disabled && "pointer-events-none opacity-50")}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className="peer sr-only"
        data-testid={dataTestid}
      />
      <span
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors select-none",
          "border-outline-variant bg-surface/40 text-on-surface-variant hover:border-cyan/40 hover:text-cyan",
          "peer-checked:border-cyan/60 peer-checked:bg-cyan/20 peer-checked:text-cyan",
          "peer-focus-visible:ring-cyan/50 peer-focus-visible:ring-2",
          disabled && "cursor-not-allowed",
        )}
      >
        {label}
      </span>
    </label>
  );
}
