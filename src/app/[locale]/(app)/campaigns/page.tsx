/**
 * BM2-F003 + MVP-vf-F004 · /campaigns list page (server component).
 *
 * Layout per the Stitch campaigns-list prototype:
 *   ┌───────────────────────────────────────────────────────┐
 *   │ Header (title + Import disabled + New Campaign CTA)   │
 *   ├───────────────────────────────────────────────────────┤
 *   │ KPI strip — 4 cards (Active / Pipeline / Reply / Reach) │
 *   ├───────────────────────────────────────────────────────┤
 *   │ Filter strip — status chips row + 6-input grid         │
 *   ├───────────────────────────────────────────────────────┤
 *   │ Table OR empty-state OR no-matches hint                │
 *   ├───────────────────────────────────────────────────────┤
 *   │ Pagination + AI Suggestions card                       │
 *   └───────────────────────────────────────────────────────┘
 *
 * Pure server component; the existing F003 distinction between
 * "tenant has 0 campaigns" (empty-state CTA) and "filter misses"
 * (gentle hint) is preserved.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui";
import {
  parseCampaignFilters,
  serializeCampaignFilters,
} from "@/lib/campaigns/filters";
import {
  loadCampaignsListKpis,
  loadKnownGames,
} from "@/lib/campaigns/list-kpis";
import { runCampaignListSearch } from "@/lib/campaigns/search";

import { AiSuggestionsCard } from "./AiSuggestionsCard";
import { CampaignsFilterBar } from "./CampaignsFilterBar";
import { CampaignsKpiStrip } from "./CampaignsKpiStrip";
import { CampaignsTable } from "./CampaignsTable";
import { EmptyTenantState } from "./EmptyTenantState";

export const metadata = { title: "Campaigns — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampaignsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const filters = parseCampaignFilters(rawParams);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const [result, kpis, knownGames] = await Promise.all([
    runCampaignListSearch(tenantId, filters),
    loadCampaignsListKpis(tenantId),
    loadKnownGames(tenantId),
  ]);

  const t = await getTranslations("campaigns");
  const tHeader = await getTranslations("campaigns.header");
  const tEmpty = await getTranslations("campaigns.emptyState");
  const tNoMatches = await getTranslations("campaigns.noMatches");
  const tPager = await getTranslations("discovery.pagination");

  const basePath = `/${locale}/campaigns`;
  const newCampaignHref = `/${locale}/campaigns/new`;

  const withFilter = (
    overrides: Parameters<typeof serializeCampaignFilters>[1]
  ) => {
    const q = serializeCampaignFilters(filters, overrides).toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const tenantIsEmpty = result.tenantTotalCount === 0;
  const filteredEmpty = !tenantIsEmpty && result.items.length === 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            data-testid="campaigns-page-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled
            title={tHeader("importTooltip")}
            className="border-purple/40 text-purple"
            data-testid="campaigns-import"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              upload_file
            </span>
            {tHeader("import")}
          </Button>
          <Link
            href={newCampaignHref}
            data-testid="campaigns-new-button"
            className="gradient-cta inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              add
            </span>
            {t("newCampaign")}
          </Link>
        </div>
      </header>

      <CampaignsKpiStrip kpis={kpis} />
      <CampaignsFilterBar
        filters={filters}
        basePath={basePath}
        knownGames={knownGames}
      />

      {tenantIsEmpty ? (
        <EmptyTenantState
          title={tEmpty("title")}
          body={tEmpty("body")}
          cta={tEmpty("cta")}
          ctaHref={newCampaignHref}
        />
      ) : (
        <>
          <p
            className="text-sm font-semibold text-on-surface"
            data-testid="campaigns-summary"
          >
            {t("summary", { count: result.items.length })}
          </p>

          {filteredEmpty ? (
            <div
              className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
              data-testid="campaigns-no-matches"
            >
              <h2 className="text-lg font-semibold text-white">
                {tNoMatches("title")}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {tNoMatches("body")}
              </p>
            </div>
          ) : (
            <CampaignsTable rows={result.items} locale={locale} />
          )}

          <nav
            className="flex items-center justify-end gap-2 pt-2 text-sm"
            aria-label="Pagination"
          >
            {filters.cursor ? (
              <a
                href={withFilter({ cursor: undefined })}
                className="rounded-lg border border-outline-variant px-4 py-2 font-medium text-on-surface-variant hover:border-cyan/40 hover:text-cyan"
                data-testid="campaigns-pagination-first"
              >
                « {tPager("previous")}
              </a>
            ) : null}
            {result.hasMore && result.nextCursor ? (
              <a
                href={withFilter({ cursor: result.nextCursor })}
                className="gradient-cta rounded-lg px-4 py-2 font-semibold text-on-primary"
                data-testid="campaigns-pagination-next"
              >
                {tPager("next")} »
              </a>
            ) : null}
          </nav>

          <AiSuggestionsCard locale={locale} />
        </>
      )}
    </div>
  );
}
