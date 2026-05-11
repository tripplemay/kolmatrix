/**
 * BL-065-F001 · /match unified KOL workbench (server component).
 *
 * Phase 2 Match-page internal rewrite: this file no longer re-exports
 * /discovery (the BL-064 A2 embed-old-components occupation strategy is
 * retired). It now owns the layout that merges BM1 /discovery (filter +
 * card grid) with /database (KPI strip + table) into a single workbench:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Header (title + subtitle; actions placeholder for F004 AddKol)  │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ QuickStats KPI strip (full pool: total / active collabs / avg   │
 *   │   value-score / follower reach)                                  │
 *   ├──────────────┬────────────────────────────────────┬─────────────┤
 *   │ FilterSidebar│ MatchSummaryBar                    │ AiSuggestion│
 *   │   (260px)    │ MatchKolCard grid  /  MatchKolTable│   Sidebar   │
 *   │              │                                    │   (320px,   │
 *   │              │ Pagination                         │    only if  │
 *   │              │                                    │    campaign │
 *   │              │                                    │    Id set)  │
 *   └──────────────┴────────────────────────────────────┴─────────────┘
 *
 * Acceptance trace (spec §3 F001):
 *  - 不 import 旧 page.tsx → re-export gone, real component below.
 *  - 三段 layout → header / QuickStats / grid (sidebar | main | optional AI).
 *  - 双视图 → MatchSummaryBar toggles between card / table via ?view= URL param.
 *  - 默认排序 valueScore desc → DiscoveryFilters.sort defaults to "value"
 *    (BM1 parseFilters); apify-kol single-source pool via runMatchSearch
 *    (includeNonGaming forced true).
 *  - ?campaignId=xxx → AiSuggestionsSidebar mounted as shell (F005 wires it).
 *
 * F002 will rebuild FilterSidebar to merge the dual discovery+database
 * filter sets; for F001 we reuse the BM1 /discovery FilterSidebar
 * verbatim with basePath rewired to /match. Same intentional re-use for
 * /database QuickStats / loadDatabaseStats — F006 migrates the imports
 * into /match before deleting the source folders.
 */
import { getFormatter, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FilterSidebar } from "@/app/[locale]/(app)/discovery/FilterSidebar";
import { QuickStats } from "@/app/[locale]/(app)/database/QuickStats";
import { loadDatabaseStats } from "@/app/[locale]/(app)/database/stats";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { AiSuggestionsSidebar } from "./AiSuggestionsSidebar";
import { MatchKolCard } from "./MatchKolCard";
import { MatchKolTable } from "./MatchKolTable";
import { MatchSummaryBar } from "./MatchSummaryBar";
import { runMatchSearch } from "./search";
import { parseView } from "./view-mode";

export const metadata = { title: "Match — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function compactFollowers(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pickCampaignId(
  raw: Record<string, string | string[] | undefined>,
): string | null {
  const v = raw.campaignId;
  const value = Array.isArray(v) ? v[0] : v;
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const view = parseView(raw);
  const campaignId = pickCampaignId(raw);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const [searchResult, stats] = await Promise.all([
    runMatchSearch(tenantId, filters),
    loadDatabaseStats(tenantId),
  ]);

  const t = await getTranslations("match.header");
  const tEmpty = await getTranslations("discovery.emptyState");
  const tPager = await getTranslations("discovery.pagination");
  const tStatus = await getTranslations("relationshipStatus");
  const format = await getFormatter();

  const basePath = `/${locale}/match`;

  function withFilter(overrides: Parameters<typeof serializeFilters>[1]) {
    const merged = serializeFilters(filters, overrides);
    if (view === "table") merged.set("view", "table");
    if (campaignId) merged.set("campaignId", campaignId);
    const q = merged.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  function withParams(extra: Record<string, string | undefined>) {
    const merged = serializeFilters(filters);
    if (view === "table" && !("view" in extra)) merged.set("view", "table");
    if (campaignId && !("campaignId" in extra)) {
      merged.set("campaignId", campaignId);
    }
    for (const [key, value] of Object.entries(extra)) {
      merged.delete(key);
      if (value != null) merged.append(key, value);
    }
    const q = merged.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  const rowFormatted: Record<
    string,
    {
      dateLabel: string;
      statusKey: string;
      statusLabel: string;
      followersLabel: string;
    }
  > = {};
  if (view === "table") {
    for (const r of searchResult.items) {
      rowFormatted[r.id] = {
        dateLabel: format.dateTime(new Date(r.createdAt), {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        statusKey: r.relationshipStatus,
        statusLabel: tStatus(
          r.relationshipStatus as
            | "prospect"
            | "first_contact"
            | "negotiating"
            | "long_term"
            | "paused"
            | "terminated",
        ),
        followersLabel: compactFollowers(r.followerCount),
      };
    }
  }

  const mainColumns = campaignId
    ? "lg:grid-cols-[260px_minmax(0,1fr)_320px]"
    : "lg:grid-cols-[260px_minmax(0,1fr)]";

  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="match-page"
      data-view={view}
      data-campaign-mode={campaignId ? "true" : "false"}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>
      </header>

      <QuickStats stats={stats} />

      <div className={cn("grid gap-6", mainColumns)}>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar filters={filters} basePath={basePath} />
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <MatchSummaryBar
            total={searchResult.total}
            sort={filters.sort}
            view={view}
            withFilter={withFilter}
            withParams={withParams}
          />

          {searchResult.items.length === 0 ? (
            <div
              className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
              data-testid="match-empty"
            >
              <h2 className="text-lg font-semibold text-white">
                {tEmpty("title")}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {tEmpty("body")}
              </p>
            </div>
          ) : view === "table" ? (
            <MatchKolTable
              rows={searchResult.items}
              locale={locale}
              rowFormatted={rowFormatted}
            />
          ) : (
            <div
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
              data-testid="match-grid"
            >
              {searchResult.items.map((k) => (
                <MatchKolCard key={k.id} kol={k} />
              ))}
            </div>
          )}

          <nav
            className="flex items-center justify-end gap-2 pt-4 text-sm"
            aria-label="Pagination"
          >
            {filters.cursor ? (
              <a
                href={withFilter({ cursor: undefined })}
                className="rounded-lg border border-outline-variant px-4 py-2 font-medium text-on-surface-variant transition-colors hover:border-cyan/40 hover:text-cyan"
                data-testid="pagination-first"
              >
                « {tPager("previous")}
              </a>
            ) : null}
            {searchResult.hasMore && searchResult.nextCursor ? (
              <a
                href={withFilter({ cursor: searchResult.nextCursor })}
                className="gradient-cta rounded-lg px-4 py-2 font-semibold text-on-primary"
                data-testid="pagination-next"
              >
                {tPager("next")} »
              </a>
            ) : null}
          </nav>
        </section>

        {campaignId ? <AiSuggestionsSidebar campaignId={campaignId} /> : null}
      </div>
    </div>
  );
}
