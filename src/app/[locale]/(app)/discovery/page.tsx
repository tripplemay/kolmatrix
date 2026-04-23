import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";

import { FilterSidebar } from "./FilterSidebar";
import { KolResultCard } from "./KolResultCard";
import { runDiscoverySearch } from "./search";

export const metadata = { title: "Discover KOLs — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoveryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const filters = parseFilters(raw);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const result = await runDiscoverySearch(tenantId, filters);

  const t = await getTranslations("discovery");
  const tPager = await getTranslations("discovery.pagination");
  const tSummary = await getTranslations("discovery.summary");
  const tSort = await getTranslations("discovery.sort");
  const tEmpty = await getTranslations("discovery.emptyState");

  const basePath = `/${locale}/discovery`;

  function withFilter(overrides: Parameters<typeof serializeFilters>[1]) {
    const q = serializeFilters(filters, overrides).toString();
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
          <div className="flex items-center gap-2 rounded-lg border border-on-surface/5 bg-surface/40 px-3 py-2 text-xs text-on-surface-variant">
            <span>{tSort("label")}:</span>
            <div className="flex items-center gap-1">
              {(["value", "followers", "recent"] as const).map((s) => (
                <a
                  key={s}
                  href={withFilter({ sort: s, cursor: undefined })}
                  className={
                    filters.sort === s
                      ? "rounded bg-cyan/20 px-2 py-0.5 text-cyan"
                      : "rounded px-2 py-0.5 hover:text-cyan"
                  }
                  data-testid={`sort-${s}`}
                >
                  {tSort(s)}
                </a>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled
            title={tSummary("saveAllComingSoon")}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              bookmark_added
            </span>
            {tSummary("saveAll")}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterSidebar filters={filters} basePath={basePath} />
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <p
            className="text-sm font-semibold text-on-surface"
            data-testid="discovery-summary"
          >
            {tSummary("count", { count: result.total })}
          </p>

          {result.items.length === 0 ? (
            <div
              className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
              data-testid="discovery-empty"
            >
              <h2 className="text-lg font-semibold text-white">
                {tEmpty("title")}
              </h2>
              <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-cyan/20 bg-cyan/5 px-4 py-3 text-left text-[12px] text-on-surface-variant">
                <span
                  className="material-symbols-outlined mt-0.5 text-cyan"
                  aria-hidden
                >
                  lightbulb
                </span>
                <div>
                  <p className="font-semibold text-cyan-fixed">
                    {tEmpty("tipHeading")}
                  </p>
                  <p className="mt-1">{tEmpty("tipBody")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              data-testid="discovery-grid"
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
