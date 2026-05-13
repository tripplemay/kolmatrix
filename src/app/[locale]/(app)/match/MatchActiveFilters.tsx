/**
 * BL-065-F002 · Active-filter chip strip for the /match workbench.
 *
 * Copy of the BM1 /discovery ActiveFilters with two additions that come
 * with the merged sidebar (BL-065-F002 spec §F002 acceptance):
 *   - Relationship-status chips (BM1 /database — the sidebar status
 *     pills now flow through to ActiveFilters so the user can see + clear
 *     a chosen status from the chip strip).
 *   - Tier chips (BM1 /database — the new Advanced→Tier dropdown
 *     surfaces here too).
 *
 * Pure server component; same `serializeFilters` driven anchor → clear
 * pattern as Discovery's ActiveFilters.
 */
import { getTranslations } from "next-intl/server";

import { type DiscoveryFilters, serializeFilters } from "@/lib/kol/filters";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
  aiFallbackActive?: boolean;
}

interface ChipDescriptor {
  key: string;
  label: string;
  clear: Partial<DiscoveryFilters>;
}

export async function MatchActiveFilters({
  filters,
  basePath,
  aiFallbackActive = false,
}: Props) {
  const t = await getTranslations("match.activeFilters");
  const tFilters = await getTranslations("match.filters");
  const tRegions = await getTranslations("match.regions");
  const tCategories = await getTranslations("match.categories");
  const tPlatforms = await getTranslations("match.platforms");
  const tStatus = await getTranslations("relationshipStatus");
  const tDbFilters = await getTranslations("match.filters");

  const chips: ChipDescriptor[] = [];

  if (filters.aiQuery) {
    chips.push({
      key: "aiQuery",
      label: `${t("aiPrefix")}${filters.aiQuery}`,
      clear: { aiQuery: undefined, cursor: undefined },
    });
  } else if (filters.search) {
    chips.push({
      key: "search",
      label: `"${filters.search}"`,
      clear: { search: undefined, cursor: undefined },
    });
  }

  if (filters.followersMin != null || filters.followersMax != null) {
    const min = filters.followersMin ?? "0";
    const max = filters.followersMax ?? "∞";
    chips.push({
      key: "followers",
      label: `${tFilters("followers")}: ${min} – ${max}`,
      clear: {
        followersMin: undefined,
        followersMax: undefined,
        cursor: undefined,
      },
    });
  }

  for (const region of filters.regions) {
    chips.push({
      key: `region-${region}`,
      label: tRegions(region as Parameters<typeof tRegions>[0]),
      clear: {
        regions: filters.regions.filter((r) => r !== region),
        cursor: undefined,
      },
    });
  }

  for (const category of filters.categories) {
    chips.push({
      key: `category-${category}`,
      label: tCategories(category as Parameters<typeof tCategories>[0]),
      clear: {
        categories: filters.categories.filter((c) => c !== category),
        cursor: undefined,
      },
    });
  }

  for (const platform of filters.platforms) {
    chips.push({
      key: `platform-${platform}`,
      label: tPlatforms(platform as Parameters<typeof tPlatforms>[0]),
      clear: {
        platforms: filters.platforms.filter((p) => p !== platform),
        cursor: undefined,
      },
    });
  }

  if (filters.languages.length > 0) {
    chips.push({
      key: "languages",
      label: `${tFilters("language")}: ${filters.languages.join(", ")}`,
      clear: { languages: [], cursor: undefined },
    });
  }

  if (filters.engagementMin != null) {
    chips.push({
      key: "engagement",
      label: `${tFilters("engagement")} ≥ ${filters.engagementMin}`,
      clear: { engagementMin: undefined, cursor: undefined },
    });
  }

  if (filters.avgViewsMin != null) {
    chips.push({
      key: "avgViews",
      label: `${tFilters("avgViews")} ≥ ${filters.avgViewsMin}`,
      clear: { avgViewsMin: undefined, cursor: undefined },
    });
  }

  if (filters.uploadsPerMonthMin != null) {
    chips.push({
      key: "uploadsPerMonthMin",
      label: `${tFilters("uploads")} ≥ ${filters.uploadsPerMonthMin}`,
      clear: { uploadsPerMonthMin: undefined, cursor: undefined },
    });
  }

  if (filters.lastUploadWithinDays != null) {
    chips.push({
      key: "lastUpload",
      label: tFilters(
        `lastUpload${filters.lastUploadWithinDays}` as
          | "lastUpload30"
          | "lastUpload90"
          | "lastUpload180",
      ),
      clear: { lastUploadWithinDays: undefined, cursor: undefined },
    });
  }

  for (const status of filters.monetizationStatuses) {
    chips.push({
      key: `monetization-${status}`,
      label: tFilters(
        `monetization${status[0]}${status.slice(1).toLowerCase()}` as
          | "monetizationVerified"
          | "monetizationMonetized"
          | "monetizationNone",
      ),
      clear: {
        monetizationStatuses: filters.monetizationStatuses.filter(
          (m) => m !== status,
        ),
        cursor: undefined,
      },
    });
  }

  for (const rating of filters.brandSafety) {
    chips.push({
      key: `brandSafety-${rating}`,
      label: `${tFilters("brandSafety")}: ${tFilters(
        `brandSafety${rating}` as
          | "brandSafetyG"
          | "brandSafetyPG"
          | "brandSafetyPG13"
          | "brandSafetyR",
      )}`,
      clear: {
        brandSafety: filters.brandSafety.filter((b) => b !== rating),
        cursor: undefined,
      },
    });
  }

  if (filters.knownCollabs.length > 0) {
    chips.push({
      key: "knownCollabs",
      label: `${tFilters("knownCollabs")}: ${filters.knownCollabs.join(", ")}`,
      clear: { knownCollabs: [], cursor: undefined },
    });
  }

  if (filters.tags.length > 0) {
    chips.push({
      key: "tags",
      label: `${tFilters("tags")}: ${filters.tags.join(", ")}`,
      clear: { tags: [], cursor: undefined },
    });
  }

  for (const tier of filters.channelAge) {
    chips.push({
      key: `channelAge-${tier}`,
      label: `${tFilters("channelAge")}: ${tFilters(
        `channelAge_${tier}` as
          | "channelAge_new"
          | "channelAge_established"
          | "channelAge_veteran",
      )}`,
      clear: {
        channelAge: filters.channelAge.filter((t) => t !== tier),
        cursor: undefined,
      },
    });
  }

  for (const tier of filters.uploadFrequency) {
    chips.push({
      key: `uploadFrequency-${tier}`,
      label: `${tFilters("uploadFrequency")}: ${tFilters(
        `uploadFrequency_${tier}` as
          | "uploadFrequency_active"
          | "uploadFrequency_semi-active"
          | "uploadFrequency_inactive",
      )}`,
      clear: {
        uploadFrequency: filters.uploadFrequency.filter((t) => t !== tier),
        cursor: undefined,
      },
    });
  }

  for (const grp of filters.regionGroup) {
    chips.push({
      key: `regionGroup-${grp}`,
      label: `${tFilters("regionGroup")}: ${tFilters(
        `regionGroup_${grp}` as
          | "regionGroup_asia"
          | "regionGroup_europe"
          | "regionGroup_americas"
          | "regionGroup_latam"
          | "regionGroup_oceania",
      )}`,
      clear: {
        regionGroup: filters.regionGroup.filter((g) => g !== grp),
        cursor: undefined,
      },
    });
  }

  if (filters.includeNonGaming) {
    chips.push({
      key: "includeNonGaming",
      label: tFilters("includeNonGaming"),
      clear: { includeNonGaming: false, cursor: undefined },
    });
  }

  // BL-065-F002 additions: relationshipStatus + tier chips, surfacing
  // the two BM1 /database dimensions that the merged sidebar pulls in.
  for (const status of filters.relationshipStatuses) {
    chips.push({
      key: `relationshipStatus-${status}`,
      label: `${tDbFilters("status")}: ${tStatus(status)}`,
      clear: {
        relationshipStatuses: filters.relationshipStatuses.filter(
          (s) => s !== status,
        ),
        cursor: undefined,
      },
    });
  }

  for (const tier of filters.tiers ?? []) {
    chips.push({
      key: `tier-${tier}`,
      label: `${tDbFilters("tier")}: ${tDbFilters(
        `tier${tier[0].toUpperCase()}${tier.slice(1)}` as
          | "tierHigh"
          | "tierMedium"
          | "tierLow"
          | "tierUnrated",
      )}`,
      clear: {
        tiers: (filters.tiers ?? []).filter((t) => t !== tier),
        cursor: undefined,
      },
    });
  }

  if (chips.length === 0 && !aiFallbackActive) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="match-active-filters-wrapper">
      {aiFallbackActive ? (
        <div
          role="status"
          data-testid="match-ai-fallback-banner"
          className="border-amber/40 bg-amber/10 text-amber-fixed flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            info
          </span>
          <span>{t("aiFallbackBanner")}</span>
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div
          data-testid="match-active-filters"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-on-surface-variant/70 text-[11px] font-semibold tracking-wider uppercase">
            {t("heading")}
          </span>
          {chips.map((chip) => {
            const q = serializeFilters(filters, chip.clear).toString();
            const href = q ? `${basePath}?${q}` : basePath;
            return (
              <a
                key={chip.key}
                href={href}
                data-testid={`match-active-filter-chip-${chip.key}`}
                aria-label={t("clearAria", { label: chip.label })}
                className="bg-surface-high/40 text-on-surface hover:border-cyan/40 hover:text-cyan inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs transition-colors"
              >
                <span>{chip.label}</span>
                <span
                  aria-hidden
                  className="material-symbols-outlined text-[14px] opacity-70"
                >
                  close
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
