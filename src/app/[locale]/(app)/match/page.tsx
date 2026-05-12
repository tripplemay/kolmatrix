/**
 * BL-065-F001 + F002 · /match unified KOL workbench (server component).
 *
 * Phase 2 Match-page internal rewrite. F001 retired the BL-064 A2
 * embed-old-components occupation strategy; F002 then layered on the
 * merged filter + search + save-search + active-filter chip surfaces:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Header (title + SaveSearchControls in actions area)              │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ QuickStats KPI strip                                             │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ MatchSearchBar (platform + keyword, full-width)                  │
 *   ├──────────────┬────────────────────────────────────┬─────────────┤
 *   │ MatchFilter- │ MatchActiveFilters (chip strip)    │ AiSuggestion│
 *   │ Sidebar      │ MatchSummaryBar (count+sort+view)  │   Sidebar   │
 *   │   (260px)    │ [table view] MatchTableSearch      │   (320px,   │
 *   │              │ MatchKolCard grid / MatchKolTable  │    only if  │
 *   │              │ Pagination                          │    campaign │
 *   │              │                                    │    Id set)  │
 *   └──────────────┴────────────────────────────────────┴─────────────┘
 *
 * F002 highlights:
 *  - MatchFilterSidebar merges the BM1 /discovery FilterSidebar (15
 *    dims) with the BM1 /database DatabaseFilterBar (status pills +
 *    tier dropdown). Dropped the /database "Game" duplicate.
 *  - MatchSearchBar inherits the /discovery SearchBar shell minus AI
 *    chips (free-text semantic search is BL-068 territory, not BL-065).
 *  - SaveSearchControls is reused unchanged from /discovery — the
 *    SavedSearch JSON shape is filter-only (BL-044 #11:A), so basePath
 *    rewire is the only change. F006 migrates the file into /match.
 *  - MatchActiveFilters extends Discovery ActiveFilters with
 *    relationshipStatus + tier chips so the two BM1 /database
 *    dimensions also surface in the closable-chip strip.
 *  - MatchTableSearch is the table-view-only inline search input
 *    (acceptance §F002 "表格视图下加 inline column search").
 *
 * F003 onwards still rides /discovery for ImportCsvDialog (until F003
 * moves it to /admin) and /database for QuickStats + loadDatabaseStats
 * (until F006 copies them in and deletes the source folders).
 */
import { getFormatter, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import Link from "next/link";

import { SaveSearchControls } from "@/app/[locale]/(app)/discovery/SaveSearchControls";
import { AddKolDialog } from "@/app/[locale]/(app)/database/AddKolDialog";
import { QuickStats } from "@/app/[locale]/(app)/database/QuickStats";
import { loadDatabaseStats } from "@/app/[locale]/(app)/database/stats";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { withTenant } from "@/lib/db";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { AiSuggestionsSidebar } from "./AiSuggestionsSidebar";
import { MatchActiveFilters } from "./MatchActiveFilters";
import { MatchFilterSidebar } from "./MatchFilterSidebar";
import { MatchKolCard } from "./MatchKolCard";
import { MatchKolTable } from "./MatchKolTable";
import { MatchSearchBar } from "./MatchSearchBar";
import { MatchSummaryBar } from "./MatchSummaryBar";
import { MatchTableSearch } from "./MatchTableSearch";
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
  const userId = session.user.id;

  const [searchResult, stats, savedSearches, campaign] = await Promise.all([
    runMatchSearch(tenantId, filters),
    loadDatabaseStats(tenantId),
    withTenant(tenantId, (tx) =>
      tx.savedSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, filters: true, createdAt: true },
      }),
    ),
    // BL-065-F005 — tenant-scoped campaign lookup for the AI sidebar.
    // Returns null when the URL's campaignId is stale, malformed, or
    // belongs to another tenant (RLS strips it). In that case the
    // sidebar is silently dropped — the marketer still sees the full
    // workbench, just without the campaign-context recommendations.
    campaignId
      ? withTenant(tenantId, (tx) =>
          tx.campaign.findFirst({
            where: { id: campaignId, deletedAt: null },
            select: { id: true, name: true },
          }),
        )
      : Promise.resolve(null),
  ]);

  const t = await getTranslations("match.header");
  const tEmpty = await getTranslations("discovery.emptyState");
  const tPager = await getTranslations("discovery.pagination");
  const tStatus = await getTranslations("relationshipStatus");
  const tHeader = await getTranslations("discovery.header");
  const tAdminEntry = await getTranslations("match.adminEntry");
  const tDbHeader = await getTranslations("database.header");
  const tAddKol = await getTranslations("database.addKolForm");
  const format = await getFormatter();

  const isAdmin = isAdminRole(session.user.role);

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

  // BL-065-F005 — sidebar only mounts when the campaign resolved
  // tenant-scoped. A stale ?campaignId= falls back to the 2-column
  // workbench so the user doesn't see a broken sidebar.
  const showAiSidebar = Boolean(campaign);
  const mainColumns = showAiSidebar
    ? "lg:grid-cols-[260px_minmax(0,1fr)_320px]"
    : "lg:grid-cols-[260px_minmax(0,1fr)]";

  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="match-page"
      data-view={view}
      data-campaign-mode={showAiSidebar ? "true" : "false"}
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
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Link
              href={`/${locale}/admin/kol-csv-import`}
              data-testid="match-admin-csv-import-link"
              title={tAdminEntry("csvImportTooltip")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-purple/40 px-3 text-xs font-semibold text-purple hover:border-purple/60 hover:bg-purple/10"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden
              >
                admin_panel_settings
              </span>
              {tAdminEntry("csvImport")}
            </Link>
          ) : null}
          <SaveSearchControls
            basePath={basePath}
            currentFilters={filters}
            initialItems={savedSearches.map((r) => ({
              id: r.id,
              name: r.name,
              filters: r.filters as Record<string, unknown>,
              createdAt: r.createdAt.toISOString(),
            }))}
            labels={{
              saveSearch: tHeader("saveSearch"),
              savePrompt: tHeader("saveSearchPrompt"),
              saveConfirm: tHeader("saveSearchSaved"),
              mySearches: tHeader("mySearches", {
                count: savedSearches.length,
              }),
              loadPlaceholder: tHeader("loadSearchPlaceholder"),
              saveFailed: tHeader("saveSearchFailed"),
            }}
          />
          <AddKolDialog
            triggerLabel={tDbHeader("addKol")}
            triggerTitle={tDbHeader("addKolTooltip")}
            dialogTitle={tAddKol("title")}
            platformLabel={tAddKol("platformLabel")}
            handleLabel={tAddKol("handleLabel")}
            handlePlaceholder={tAddKol("handlePlaceholder")}
            displayNameLabel={tAddKol("displayNameLabel")}
            urlLabel={tAddKol("urlLabel")}
            emailLabel={tAddKol("emailLabel")}
            followerCountLabel={tAddKol("followerCountLabel")}
            submitLabel={tAddKol("submitLabel")}
            submittingLabel={tAddKol("submittingLabel")}
            cancelLabel={tAddKol("cancelLabel")}
            successLabel={tAddKol("successLabel")}
            errorLabel={tAddKol("errorLabel")}
            duplicateLabel={tAddKol("duplicateLabel")}
            rateLimitLabel={tAddKol("rateLimitLabel")}
            invalidUrlLabel={tAddKol("invalidUrlLabel")}
            invalidEmailLabel={tAddKol("invalidEmailLabel")}
          />
        </div>
      </header>

      <QuickStats stats={stats} />

      <MatchSearchBar
        basePath={basePath}
        filters={filters}
        view={view}
        campaignId={campaignId}
      />

      <div className={cn("grid gap-6", mainColumns)}>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <MatchFilterSidebar filters={filters} basePath={basePath} />
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <MatchActiveFilters filters={filters} basePath={basePath} />

          <MatchSummaryBar
            total={searchResult.total}
            sort={filters.sort}
            view={view}
            withFilter={withFilter}
            withParams={withParams}
          />

          {view === "table" && searchResult.items.length > 0 ? (
            <MatchTableSearch basePath={basePath} search={filters.search ?? ""} />
          ) : null}

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

        {showAiSidebar && campaign ? (
          <AiSuggestionsSidebar
            campaignId={campaign.id}
            tenantId={tenantId}
            locale={locale}
            campaignName={campaign.name}
          />
        ) : null}
      </div>
    </div>
  );
}
