/**
 * BM1-F004 + MVP-vf-F002 · /discovery page (server component).
 *
 * Layout matches the Stitch kol-discovery prototype:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Header: title + Save Search + AI Smart Match (top-right)     │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Search bar: platform selector + input + AI suggestion chips  │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ Filter sidebar (260px) │ Active filter chips                 │
 *   │                        │ Summary + sort + grid/list toggle   │
 *   │                        │ Card grid (xl:grid-cols-4)          │
 *   │                        │ Pagination                          │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Stays a server component: filters, view mode, sort, and cursor are
 * URL-driven, so re-rendering off `searchParams` covers every state
 * change. Save Search and AI Smart Match are disabled placeholders
 * for future B2 work; both surface a tooltip explaining when they
 * ship rather than rendering controls that look interactive but do
 * nothing (per `framework/harness/ui-fidelity-guardrail.md` §3 anti-
 * ghost-control rule).
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui";
import { withTenant } from "@/lib/db";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { ActiveFilters } from "./ActiveFilters";
import { EmptyState } from "./EmptyState";
import { FilterSidebar } from "./FilterSidebar";
import { KolResultCard } from "./KolResultCard";
import { SearchBar } from "./SearchBar";
import { SmartMatchDialog } from "./SmartMatchDialog";
import { SummaryBar } from "./SummaryBar";
import { runDiscoverySearch } from "./search";
import { parseView } from "./view-mode";

export const metadata = { title: "Discover KOLs — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoveryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const view = parseView(raw);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const result = await runDiscoverySearch(tenantId, filters);

  // Smart Match needs the tenant's product list for the dialog
  // dropdown. Loading server-side keeps the client bundle small and
  // avoids an extra round-trip after the dialog opens.
  const products = await withTenant(tenantId, (tx) =>
    tx.product.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: "desc" },
    })
  );

  const t = await getTranslations("discovery");
  const tHeader = await getTranslations("discovery.header");
  const tPager = await getTranslations("discovery.pagination");

  const basePath = `/${locale}/discovery`;

  function withFilter(overrides: Parameters<typeof serializeFilters>[1]) {
    const q = serializeFilters(filters, overrides).toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  function withParams(extra: Record<string, string | undefined>) {
    const params = serializeFilters(filters);
    for (const [key, value] of Object.entries(extra)) {
      params.delete(key);
      if (value != null) params.append(key, value);
    }
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
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
          <Button
            variant="ghost"
            disabled
            title={tHeader("saveSearchTooltip")}
            data-testid="save-search-button"
            className="border-purple/40 text-purple"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              bookmark
            </span>
            {tHeader("saveSearch")}
          </Button>
          <SmartMatchDialog products={products} locale={locale} />
        </div>
      </header>

      <SearchBar basePath={basePath} filters={filters} />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar filters={filters} basePath={basePath} />
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <ActiveFilters filters={filters} basePath={basePath} />
          <SummaryBar
            total={result.total}
            sort={filters.sort}
            view={view}
            withFilter={withFilter}
            withParams={withParams}
          />

          {result.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className={cn(
                "gap-4",
                view === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                  : "flex flex-col"
              )}
              data-testid="discovery-grid"
              data-view={view}
            >
              {result.items.map((k) => (
                <KolResultCard key={k.id} kol={k} />
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
            {result.hasMore && result.nextCursor ? (
              <a
                href={withFilter({ cursor: result.nextCursor })}
                className="gradient-cta rounded-lg px-4 py-2 font-semibold text-on-primary"
                data-testid="pagination-next"
              >
                {tPager("next")} »
              </a>
            ) : null}
          </nav>
        </section>
      </div>
    </div>
  );
}
