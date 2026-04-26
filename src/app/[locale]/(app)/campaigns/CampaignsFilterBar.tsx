/**
 * BM2-F003 + MVP-vf-F004 · Campaigns list filter strip (server component).
 *
 * Two horizontal rows that mirror the Stitch campaigns-list prototype:
 *
 *   [ All | Active | Draft | Completed ]    (status chip multi-select)
 *   ─────────────────────────────────────────────────────────────
 *   [ Search …… ]  [ Game ▾ ]  [ Region ▾ ]  [ Owner ▾* ]  [ Date from … to ]  [ Apply ] [ Clear ]
 *
 * (* Owner stays disabled in MVP solo-tenant mode — only one owner
 * exists, so the dropdown has nothing meaningful to switch between.
 * Date range is real and validated server-side.)
 *
 * URL-driven GET form. Status chips are anchor links that toggle the
 * single chip's state without resubmitting the form, keeping the
 * primary "Apply" button focused on text + dropdown changes.
 */
import { getTranslations } from "next-intl/server";

import { ChipButton } from "@/components/common";
import { Button, Input, Select } from "@/components/ui";
import {
  CAMPAIGN_STATUS_VALUES,
  type CampaignStatus,
} from "@/lib/campaigns/status";
import {
  serializeCampaignFilters,
  type CampaignListFilters,
} from "@/lib/campaigns/filters";
import { DISCOVERY_REGIONS } from "@/lib/kol/filters";

interface Props {
  filters: CampaignListFilters;
  basePath: string;
  /** Distinct game values seen in the tenant's campaigns — feeds the dropdown. */
  knownGames: string[];
}

export async function CampaignsFilterBar({ filters, basePath, knownGames }: Props) {
  const t = await getTranslations("campaigns.filters");
  const tStatus = await getTranslations("campaigns.status");
  const tRegions = await getTranslations("discovery.regions");

  const anyFilter =
    Boolean(filters.search) ||
    filters.statuses.length > 0 ||
    filters.games.length > 0 ||
    filters.regions.length > 0 ||
    filters.dateFrom != null ||
    filters.dateTo != null;

  // Build status chip URLs that toggle the chip on/off without losing
  // other filters. "All" clears the status array; each named chip is a
  // single-select link (clicking on already-pressed → clears).
  function statusChipHref(status: CampaignStatus | "all"): string {
    let nextStatuses: CampaignStatus[];
    if (status === "all") {
      nextStatuses = [];
    } else if (filters.statuses.length === 1 && filters.statuses[0] === status) {
      nextStatuses = [];
    } else {
      nextStatuses = [status];
    }
    const params = serializeCampaignFilters(filters, {
      statuses: nextStatuses,
      cursor: undefined,
    });
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="campaigns-filters"
      className="glass-panel space-y-4 rounded-xl border border-on-surface/5 p-5"
    >
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="campaigns-status-chips"
      >
        {(["all", ...CAMPAIGN_STATUS_VALUES] as const).map((s) => {
          const pressed =
            s === "all"
              ? filters.statuses.length === 0
              : filters.statuses.length === 1 && filters.statuses[0] === s;
          return (
            <a
              key={s}
              href={statusChipHref(s)}
              data-testid={`campaigns-status-chip-${s}`}
              aria-current={pressed ? "true" : undefined}
            >
              <ChipButton pressed={pressed} type="button" tabIndex={-1}>
                {tStatus(s)}
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
            data-testid="campaigns-search-input"
          />
        </Field>

        <Field label={t("game")}>
          <Select
            name="game"
            defaultValue={filters.games[0] ?? ""}
            data-testid="campaigns-game-select"
            disabled={knownGames.length === 0}
            title={knownGames.length === 0 ? t("gameTooltipEmpty") : undefined}
          >
            <option value="">{t("anyGame")}</option>
            {knownGames.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("region")}>
          <Select
            name="region"
            defaultValue={filters.regions[0] ?? ""}
            data-testid="campaigns-region-select"
          >
            <option value="">{t("anyRegion")}</option>
            {DISCOVERY_REGIONS.map((r) => (
              <option key={r} value={r}>
                {tRegions(r)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("owner")}>
          <Select
            disabled
            title={t("ownerTooltip")}
            defaultValue=""
            data-testid="campaigns-owner-select"
          >
            <option value="">{t("ownerSoloTenant")}</option>
          </Select>
        </Field>

        <Field label={t("dateFrom")}>
          <Input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            data-testid="campaigns-date-from"
          />
        </Field>

        <Field label={t("dateTo")}>
          <Input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            data-testid="campaigns-date-to"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        {anyFilter ? (
          <a
            href={basePath}
            data-testid="campaigns-filters-clear"
            className="text-xs font-medium text-on-surface-variant transition-colors hover:text-cyan"
          >
            {t("clearAll")}
          </a>
        ) : null}
        <Button
          type="submit"
          variant="primary-gradient"
          data-testid="campaigns-filters-apply"
        >
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
