/**
 * BM1-F005 + MVP-vf-F003 · Filter strip for /database (server component).
 *
 * Two horizontal rows that mirror the Stitch kol-database prototype:
 *
 *   [ All | Active | Negotiating | Long-term | Paused | Terminated ]
 *   ─────────────────────────────────────────────────────────────
 *   [ Search …… ] [ Category ▾ ] [ Region ▾ ] [ Tier ▾ ] [ Game ▾ ] [ Tags …… ] [ Apply ] [ Clear ]
 *
 * URL-driven GET form, identical pattern to /discovery and BM1.
 */
import { getTranslations } from "next-intl/server";

import { ChipButton } from "@/components/common";
import { Button, Input, Select } from "@/components/ui";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_REGIONS,
  RELATIONSHIP_STATUSES,
  type DiscoveryFilters,
} from "@/lib/kol/filters";

interface Props {
  filters: DiscoveryFilters;
  basePath: string;
}

const STATUS_PILLS = ["all", ...RELATIONSHIP_STATUSES] as const;
const TIER_OPTIONS = ["high", "medium", "low", "unrated"] as const;

export async function DatabaseFilterBar({ filters, basePath }: Props) {
  const t = await getTranslations("database.filters");
  const tStatus = await getTranslations("relationshipStatus");
  const tCategories = await getTranslations("discovery.categories");
  const tRegions = await getTranslations("discovery.regions");

  const currentStatus = filters.relationshipStatuses[0] ?? "all";
  const anyFilter =
    Boolean(filters.search) ||
    filters.categories.length > 0 ||
    filters.regions.length > 0 ||
    filters.relationshipStatuses.length > 0 ||
    filters.tags.length > 0;

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="database-filters"
      className="glass-panel space-y-4 rounded-xl border border-on-surface/5 p-5"
    >
      {/* Status pills (multi-state but URL-driven: each pill is a link
          to /database with its relationshipStatus filter set). The
          submit button is the only true `<form>` action; pills bypass
          the form via plain anchors. */}
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="database-status-pills"
      >
        {STATUS_PILLS.map((s) => {
          const params = new URLSearchParams();
          if (s !== "all") params.append("relationshipStatus", s);
          if (filters.search) params.append("search", filters.search);
          if (filters.sort !== "value") params.append("sort", filters.sort);
          const href = params.toString() ? `${basePath}?${params}` : basePath;
          const pressed = currentStatus === s;
          return (
            <a
              key={s}
              href={href}
              data-testid={`database-status-pill-${s}`}
              aria-current={pressed ? "true" : undefined}
            >
              <ChipButton pressed={pressed} type="button" tabIndex={-1}>
                {s === "all" ? t("statusAll") : tStatus(s)}
              </ChipButton>
            </a>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7 lg:items-end">
        <Field label={t("search")} className="lg:col-span-2">
          <Input
            type="search"
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder={t("searchPlaceholder")}
            maxLength={200}
          />
        </Field>

        <Field label={t("category")}>
          <Select name="categories" defaultValue={filters.categories[0] ?? ""}>
            <option value="">—</option>
            {DISCOVERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCategories(c)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("region")}>
          <Select name="regions" defaultValue={filters.regions[0] ?? ""}>
            <option value="">—</option>
            {DISCOVERY_REGIONS.map((r) => (
              <option key={r} value={r}>
                {tRegions(r)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("tier")}>
          <Select name="tiers" defaultValue={filters.tiers?.[0] ?? ""}>
            <option value="">—</option>
            {TIER_OPTIONS.map((tier) => (
              <option key={tier} value={tier}>
                {t(`tier${tier[0].toUpperCase()}${tier.slice(1)}` as
                  | "tierHigh"
                  | "tierMedium"
                  | "tierLow"
                  | "tierUnrated")}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("game")}>
          <Select name="categories" defaultValue={filters.categories[0] ?? ""}>
            <option value="">—</option>
            {DISCOVERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCategories(c)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("tags")}>
          <Input
            type="text"
            name="tags"
            defaultValue={filters.tags.join(",")}
            placeholder={t("tagsPlaceholder")}
            maxLength={120}
          />
        </Field>
      </div>

      <input type="hidden" name="sort" value={filters.sort} />
      {filters.relationshipStatuses[0] ? (
        <input
          type="hidden"
          name="relationshipStatus"
          value={filters.relationshipStatuses[0]}
        />
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {anyFilter ? (
          <a
            href={basePath}
            className="text-xs font-medium text-on-surface-variant transition-colors hover:text-cyan"
          >
            {t("clearAll")}
          </a>
        ) : null}
        <Button type="submit" variant="primary-gradient">
          {t("apply")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}
