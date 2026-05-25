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
import { Suspense } from "react";

import Link from "next/link";

import { QuickStats } from "./QuickStats";
import { SaveSearchControls } from "./SaveSearchControls";
import { loadDatabaseStats } from "./stats";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { withTenant } from "@/lib/db";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { MatchActiveFilters } from "./MatchActiveFilters";
import { MatchFilterSidebar } from "./MatchFilterSidebar";
import { MatchKolCard } from "./MatchKolCard";
// BL-070-F009 — MatchKolTable + MatchRefineBar are client components; gating
// them behind next/dynamic({ssr:false}) chunks the table-view bundle (+
// transitive AddToCampaignDialog/ConfirmDeleteDialog) and the refine bar so
// /match initial JS doesn't ship either on first paint. AiSuggestionsSidebar
// is server but its transitive AiSuggestionsClient is heavy — gating with a
// server-side dynamic import() splits the AI sidebar chunk so the no-
// campaign /match path never fetches it.
import { MatchKolTableLazy } from "./MatchKolTableLazy";
import { MatchRefineBarLazy } from "./MatchRefineBarLazy";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickCampaignId(
  raw: Record<string, string | string[] | undefined>,
): string | null {
  const v = raw.campaignId;
  const value = Array.isArray(v) ? v[0] : v;
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  // BL-065-F006 — Prisma rejects non-UUID ids when querying a uuid
  // column; the BL-064 redirect deliberately preserves stale or
  // bogus campaign ids (e.g. `/campaigns/abc-123 → /match?campaignId=abc-123`)
  // for the ia-refactor-redirects E2E, so we must validate the shape
  // before passing it to findFirst — otherwise the page 500s on every
  // non-uuid query param. Mirrors the ?campaignId= AI sidebar gate in
  // BL-065-F005 (sidebar silently drops when the campaign can't be
  // resolved tenant-scoped).
  if (trimmed.length === 0 || !UUID_RE.test(trimmed)) return null;
  return trimmed;
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

  // BL-070-F011 — runMatchSearch (main table) + the campaign lookup
  // (sidebar mount judgment) stay on the LCP critical path. loadDatabaseStats
  // (KPI strip) and savedSearches (header dropdown) move into Suspense-
  // streamed sub-trees below so the page can flush the main table without
  // waiting on the auxiliary queries.
  const [searchResult, campaign] = await Promise.all([
    runMatchSearch(tenantId, filters),
    // BL-065-F005 — tenant-scoped campaign lookup for the AI sidebar.
    // Returns null when the URL's campaignId is stale, malformed, or
    // belongs to another tenant (RLS strips it). In that case the
    // sidebar is silently dropped — the marketer still sees the full
    // workbench, just without the campaign-context recommendations.
    // BL-068-F004 — productId added to the select so MatchRefineBar can
    // fall back to /api/kols/smart-match when the localStorage pool
    // cache is empty. Null productId (deleted product) keeps the refine
    // bar inert (renders nothing) without breaking the sidebar.
    campaignId
      ? withTenant(tenantId, (tx) =>
          tx.campaign.findFirst({
            where: { id: campaignId, deletedAt: null },
            select: { id: true, name: true, productId: true },
          }),
        )
      : Promise.resolve(null),
  ]);

  const t = await getTranslations("match.header");
  const tEmpty = await getTranslations("match.emptyState");
  const tPager = await getTranslations("match.pagination");
  const tStatus = await getTranslations("relationshipStatus");
  const tAdminEntry = await getTranslations("match.adminEntry");
  // BL-068-F004 — reuse the campaigns.detail.refine.* bundle that F003
  // added; no new /match-scoped i18n keys per spec §F004 (RefineInputBar
  // is the same component, same labels, just a different mount site).
  const tRefine = await getTranslations("campaigns.detail.refine");
  // BL-066-F005: tDbHeader/tAddKol aliases removed with AddKolDialog mount.
  // match.headerActions / match.addKolForm i18n keys are kept (deprecated
  // markers) for BL-070 to atomic-delete.
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
          <Suspense fallback={<SaveSearchControlsSkeleton />}>
            <SavedSearchAsync
              tenantId={tenantId}
              userId={userId}
              basePath={basePath}
              filters={filters}
            />
          </Suspense>
          {/* BL-066-F005: AddKolDialog removed (manual add path retired). */}
        </div>
      </header>

      <Suspense fallback={<QuickStatsSkeleton />}>
        <QuickStatsAsync tenantId={tenantId} />
      </Suspense>

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
            <MatchKolTableLazy
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
          // BL-070-F009 — AiSuggestionsSidebar is a server component but its
          // AiSuggestionsClient transitive is a heavy client bundle; the
          // server-side dynamic import() below code-splits it so non-
          // campaign /match never fetches the chunk.
          <AiSidebarColumn
            campaignId={campaign.id}
            productId={campaign.productId ?? null}
            campaignName={campaign.name}
            tenantId={tenantId}
            locale={locale}
            refineLabels={{
              inputPlaceholder: tRefine("inputPlaceholder"),
              applyButton: tRefine("applyButton"),
              resetButton: tRefine("resetButton"),
              loading: tRefine("loading"),
              feedbackPrefix: tRefine("feedbackPrefix"),
              unparsableToast: tRefine("unparsableToast"),
              capExhaustedToast: tRefine("capExhaustedToast"),
              networkError: tRefine("networkError"),
              permutationInvalid: tRefine("permutationInvalid"),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

interface AiSidebarColumnProps {
  campaignId: string;
  productId: string | null;
  campaignName: string;
  tenantId: string;
  locale: string;
  refineLabels: {
    inputPlaceholder: string;
    applyButton: string;
    resetButton: string;
    loading: string;
    feedbackPrefix: string;
    unparsableToast: string;
    capExhaustedToast: string;
    networkError: string;
    permutationInvalid: string;
  };
}

/**
 * BL-070-F009 — server-side dynamic import() boundary for the AI sidebar.
 *
 * MatchRefineBar is a 'use client' bundle; gating it through the
 * MatchRefineBarLazy wrapper keeps the refine code out of /match initial
 * JS. AiSuggestionsSidebar itself is a server component but pulls in
 * AiSuggestionsClient transitively — the server `await import()` here
 * tells webpack to split it into a per-route chunk loaded only when
 * `?campaignId=` resolves.
 */
async function AiSidebarColumn({
  campaignId,
  productId,
  campaignName,
  tenantId,
  locale,
  refineLabels,
}: AiSidebarColumnProps) {
  const { AiSuggestionsSidebar } = await import("./AiSuggestionsSidebar");
  return (
    <div className="flex flex-col gap-4">
      <MatchRefineBarLazy
        campaignId={campaignId}
        productId={productId}
        tenantId={tenantId}
        locale={locale}
        labels={refineLabels}
      />
      <AiSuggestionsSidebar
        campaignId={campaignId}
        tenantId={tenantId}
        locale={locale}
        campaignName={campaignName}
      />
    </div>
  );
}

/**
 * BL-070-F011 — Suspense-streamed auxiliary surfaces.
 *
 * loadDatabaseStats (KPI strip) and the savedSearch lookup (header
 * dropdown) sit off the LCP critical path; resolving them inside async
 * children lets the main table flush first while the fallback skeletons
 * hold the layout slot.
 */

async function QuickStatsAsync({ tenantId }: { tenantId: string }) {
  const stats = await loadDatabaseStats(tenantId);
  return <QuickStats stats={stats} />;
}

function QuickStatsSkeleton() {
  return (
    <div
      className="glass-panel flex h-[88px] w-full animate-pulse items-center justify-between gap-4 rounded-2xl border border-on-surface/5 px-6"
      data-testid="match-quick-stats-skeleton"
      aria-hidden
    />
  );
}

interface SavedSearchAsyncProps {
  tenantId: string;
  userId: string;
  basePath: string;
  filters: Parameters<typeof serializeFilters>[0];
}

async function SavedSearchAsync({
  tenantId,
  userId,
  basePath,
  filters,
}: SavedSearchAsyncProps) {
  const [savedSearches, tSavedSearch] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.savedSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, filters: true, createdAt: true },
      }),
    ),
    getTranslations("match.savedSearch"),
  ]);
  return (
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
        saveSearch: tSavedSearch("saveSearch"),
        savePrompt: tSavedSearch("saveSearchPrompt"),
        saveConfirm: tSavedSearch("saveSearchSaved"),
        mySearches: tSavedSearch("mySearches", {
          count: savedSearches.length,
        }),
        loadPlaceholder: tSavedSearch("loadSearchPlaceholder"),
        saveFailed: tSavedSearch("saveSearchFailed"),
      }}
    />
  );
}

function SaveSearchControlsSkeleton() {
  return (
    <div
      className="glass-panel h-9 w-44 animate-pulse rounded-lg border border-on-surface/5"
      data-testid="match-saved-search-skeleton"
      aria-hidden
    />
  );
}
