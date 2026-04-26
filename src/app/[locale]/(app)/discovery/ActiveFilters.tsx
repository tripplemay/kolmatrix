/**
 * MVP-vf-F002 · Active filter chips bar (server component).
 *
 * Surfaces every filter the user has selected as a closeable rounded-
 * full pill. Clicking the × link reloads the page with that single
 * filter dropped — driven by the same serializeFilters() helper the
 * pagination uses, so the rest of the URL state stays intact.
 *
 * Pure server component: no useState, no hydration cost. Each chip
 * is an `<a href>` that the browser navigates natively.
 */
import { getTranslations } from "next-intl/server";

import {
  type DiscoveryFilters,
  serializeFilters,
} from "@/lib/kol/filters";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
}

interface ChipDescriptor {
  key: string;
  label: string;
  /** Override DiscoveryFilters slice so this filter clears on click. */
  clear: Partial<DiscoveryFilters>;
}

export async function ActiveFilters({ filters, basePath }: Props) {
  const t = await getTranslations("discovery.activeFilters");
  const tFilters = await getTranslations("discovery.filters");
  const tRegions = await getTranslations("discovery.regions");
  const tCategories = await getTranslations("discovery.categories");
  const tPlatforms = await getTranslations("discovery.platforms");

  const chips: ChipDescriptor[] = [];

  if (filters.search) {
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
      clear: { followersMin: undefined, followersMax: undefined, cursor: undefined },
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
          | "lastUpload180"
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
          | "monetizationNone"
      ),
      clear: {
        monetizationStatuses: filters.monetizationStatuses.filter((m) => m !== status),
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
          | "brandSafetyR"
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

  if (filters.includeNonGaming) {
    chips.push({
      key: "includeNonGaming",
      label: tFilters("includeNonGaming"),
      clear: { includeNonGaming: false, cursor: undefined },
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="discovery-active-filters"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        {t("heading")}
      </span>
      {chips.map((chip) => {
        const q = serializeFilters(filters, chip.clear).toString();
        const href = q ? `${basePath}?${q}` : basePath;
        return (
          <a
            key={chip.key}
            href={href}
            data-testid={`active-filter-chip-${chip.key}`}
            aria-label={t("clearAria", { label: chip.label })}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-surface-high/40 px-3 py-1 text-xs text-on-surface transition-colors hover:border-cyan/40 hover:text-cyan"
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
  );
}
