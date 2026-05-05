/**
 * BM1-F005 + MVP-vf-F003 · /database page (server component).
 *
 * Layout per the Stitch kol-database prototype:
 *   ┌──────────────────────────────────────────────────┬──────────┐
 *   │ Header (title + Export/Import/Add KOL CTAs)      │          │
 *   ├──────────────────────────────────────────────────┤          │
 *   │ QuickStats KPI strip                              │          │
 *   ├──────────────────────────────────────────────────┤ Insights │
 *   │ Filters strip (status pills + 7 filter dims)      │ Panel    │
 *   ├──────────────────────────────────────────────────┤          │
 *   │ Database table with row checkboxes (selection)   │ 320px    │
 *   │ Bulk Action Bar floats at bottom when selected   │          │
 *   ├──────────────────────────────────────────────────┤          │
 *   │ Pagination                                        │          │
 *   └──────────────────────────────────────────────────┴──────────┘
 *
 * Stays a server component for the data plumbing. The table itself
 * lives in <DatabaseTableClient> because per-row checkbox selection
 * is intrinsically client-side; the parent feeds it pre-formatted row
 * labels so next-intl `getFormatter` continues to render dates and
 * status text on the server side (per RSC → Client function-prop
 * embargo from BM2 F011, no formatter callbacks cross the boundary).
 */
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";

import { AddKolDialog } from "./AddKolDialog";
import { DatabaseFilterBar } from "./DatabaseFilterBar";
import { DatabaseTableClient } from "./DatabaseTableClient";
import { ImportCsvDialog } from "./ImportCsvDialog";
import { InsightsPanel } from "./InsightsPanel";
import { QuickStats } from "./QuickStats";
import { runDatabaseSearch } from "./search";
import { loadCoverageGapSummary, loadDatabaseStats } from "./stats";

export const metadata = { title: "KOL Database — KOLMatrix" };

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

export default async function DatabasePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const [searchResult, stats, coverage] = await Promise.all([
    runDatabaseSearch(tenantId, filters),
    loadDatabaseStats(tenantId),
    loadCoverageGapSummary(tenantId),
  ]);

  const t = await getTranslations("database");
  const tHeader = await getTranslations("database.header");
  const tImport = await getTranslations("database.import");
  const tAddKol = await getTranslations("database.addKolForm");
  const tStatus = await getTranslations("relationshipStatus");
  const tEmpty = await getTranslations("database.emptyState");
  const tSummary = await getTranslations("database.summary");
  const tPager = await getTranslations("discovery.pagination");
  const format = await getFormatter();

  const basePath = `/${locale}/database`;
  const withFilter = (overrides: Parameters<typeof serializeFilters>[1]) => {
    const q = serializeFilters(filters, overrides).toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  // Pre-format every row's locale-sensitive labels server-side. The
  // client component only consumes plain strings — no Date / Intl
  // formatter ever crosses the boundary (BM2 F011-001 lesson).
  const rowFormatted: Record<
    string,
    {
      dateLabel: string;
      statusKey: string;
      statusLabel: string;
      followersLabel: string;
    }
  > = {};
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
          | "terminated"
      ),
      followersLabel: compactFollowers(r.followerCount),
    };
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {tHeader("subtitle", { count: stats.total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={(() => {
              const q = serializeFilters(filters, {}).toString();
              return q ? `/api/database/export-csv?${q}` : "/api/database/export-csv";
            })()}
            data-testid="database-export"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-on-surface/15 px-3 text-xs font-semibold text-on-surface hover:border-cyan/40 hover:text-cyan"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              ios_share
            </span>
            {tHeader("export")}
          </Link>
          <ImportCsvDialog
            triggerLabel={tHeader("import")}
            triggerTitle={tHeader("importTooltip")}
            dialogTitle={tImport("title")}
            dialogBody={tImport("body")}
            uploadLabel={tImport("uploadLabel")}
            uploadingLabel={tImport("uploadingLabel")}
            cancelLabel={tImport("cancelLabel")}
            successTemplate={tImport("successTemplate")}
            errorLabel={tImport("errorLabel")}
            rateLimitLabel={tImport("rateLimitLabel")}
            fileTooLargeLabel={tImport("fileTooLargeLabel")}
            rowErrorTemplate={tImport("rowErrorTemplate")}
          />
          <AddKolDialog
            triggerLabel={tHeader("addKol")}
            triggerTitle={tHeader("addKolTooltip")}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-6">
          <QuickStats stats={stats} />
          <DatabaseFilterBar filters={filters} basePath={basePath} />

          <p
            className="text-sm font-semibold text-on-surface"
            data-testid="database-summary"
          >
            {tSummary("count", { count: searchResult.total })}
          </p>

          {searchResult.items.length === 0 ? (
            <div
              className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
              data-testid="database-empty"
            >
              <h2 className="text-lg font-semibold text-white">
                {tEmpty("title")}
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {tEmpty("body")}
              </p>
            </div>
          ) : (
            <DatabaseTableClient
              rows={searchResult.items}
              locale={locale}
              rowFormatted={rowFormatted}
            />
          )}

          <nav
            className="flex items-center justify-end gap-2 pt-2 text-sm"
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

        <InsightsPanel
          stats={stats}
          coverage={coverage}
          tenantId={tenantId}
          locale={locale}
        />
      </div>
    </div>
  );
}
