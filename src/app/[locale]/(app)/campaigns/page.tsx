/**
 * BM2-F003 · Campaigns list page.
 *
 * Adjudication (docs/specs/BM2-f003-campaigns-list-preimpl-audit.md §7):
 *   #A table layout (Stitch canonical)
 *   #B spec KPI triple — KOLs / Spend / ROI%
 *   #C cursor pagination + Prev/Next (BI4-F004 util)
 *   #D drop bulk actions / thumbnails / owner avatars / kebab menu
 *   #E statuses {draft, active, completed} + "all" filter
 *   #F distinguish "tenant has 0 campaigns" empty-state CTA from
 *      "filter has 0 matches" hint
 */
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  parseCampaignFilters,
  serializeCampaignFilters,
} from "@/lib/campaigns/filters";
import {
  runCampaignListSearch,
  type CampaignListRow,
} from "@/lib/campaigns/search";

import { CampaignsFilterBar } from "./CampaignsFilterBar";

export const metadata = { title: "Campaigns — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatCurrency(n: number | null, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  // Spec's 3 values get colour-coded; unknown values fall back to grey.
  const tone =
    status === "active"
      ? "border-cyan/30 bg-cyan/10 text-cyan"
      : status === "completed"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : status === "draft"
          ? "border-outline-variant bg-surface-high/40 text-on-surface-variant"
          : "border-outline-variant bg-surface-high/40 text-on-surface-variant";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tone}`}
      data-testid="campaign-status-badge"
      data-status={status}
    >
      {label}
    </span>
  );
}

function SpendCell({ row }: { row: CampaignListRow }) {
  const spendStr = formatCurrency(row.spendTotal);
  const budgetStr = formatCurrency(row.budgetAmount);
  const pct =
    row.budgetAmount && row.budgetAmount > 0
      ? Math.min(
          100,
          Math.round((row.spendTotal / row.budgetAmount) * 100)
        )
      : null;
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <div className="flex justify-between text-[11px] tabular-nums">
        <span className="text-on-surface">{spendStr}</span>
        {row.budgetAmount != null ? (
          <span className="text-on-surface-variant">/ {budgetStr}</span>
        ) : null}
      </div>
      {pct != null ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-high"
          data-testid="campaign-spend-progress"
          data-pct={pct}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-fixed-dim to-cyan-soft"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function RoiCell({ row }: { row: CampaignListRow }) {
  if (row.roiPercent == null) {
    return (
      <span className="text-xs text-on-surface-variant" data-testid="campaign-roi">
        —
      </span>
    );
  }
  const positive = row.roiPercent >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold tabular-nums ${
        positive ? "text-emerald-400" : "text-error"
      }`}
      data-testid="campaign-roi"
    >
      {positive ? "+" : ""}
      {row.roiPercent.toFixed(1)}%
    </span>
  );
}

export default async function CampaignsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const filters = parseCampaignFilters(rawParams);

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const result = await runCampaignListSearch(tenantId, filters);

  const t = await getTranslations("campaigns");
  const tStatus = await getTranslations("campaigns.status");
  const tTable = await getTranslations("campaigns.table");
  const tPager = await getTranslations("discovery.pagination");
  const tEmpty = await getTranslations("campaigns.emptyState");
  const tNoMatches = await getTranslations("campaigns.noMatches");
  const format = await getFormatter();

  const basePath = `/${locale}/campaigns`;
  const newCampaignHref = `/${locale}/campaigns/new`;
  const rowHref = (id: string) => `/${locale}/campaigns/${id}`;

  const withFilter = (
    overrides: Parameters<typeof serializeCampaignFilters>[1]
  ) => {
    const q = serializeCampaignFilters(filters, overrides).toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  // Spec §F003 + adjudication #F: tenant has 0 campaigns → CTA empty
  // state; tenant has campaigns but the filter misses → gentler
  // "adjust filters" hint with no "create" duplication.
  const tenantIsEmpty = result.tenantTotalCount === 0;
  const filteredEmpty =
    !tenantIsEmpty && result.items.length === 0;

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
        <Link
          href={newCampaignHref}
          data-testid="campaigns-new-button"
          className="gradient-cta flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-transform hover:scale-[1.02]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          {t("newCampaign")}
        </Link>
      </header>

      <CampaignsFilterBar filters={filters} basePath={basePath} />

      {tenantIsEmpty ? (
        <div
          className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-on-surface/5 p-12 text-center"
          data-testid="campaigns-empty"
        >
          <span
            className="material-symbols-outlined text-[48px] text-cyan/50"
            aria-hidden
          >
            rocket_launch
          </span>
          <h2 className="text-lg font-semibold text-white">
            {tEmpty("title")}
          </h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            {tEmpty("body")}
          </p>
          <Link
            href={newCampaignHref}
            data-testid="campaigns-empty-cta"
            className="gradient-cta mt-2 rounded-lg px-5 py-2 text-sm font-bold text-on-primary"
          >
            {tEmpty("cta")}
          </Link>
        </div>
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
            <div
              className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
              data-testid="campaigns-table-wrapper"
            >
              <table
                className="w-full border-collapse text-left text-sm"
                data-testid="campaigns-table"
              >
                <thead>
                  <tr className="border-b border-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <Th>{tTable("name")}</Th>
                    <Th>{tTable("status")}</Th>
                    <Th alignRight>{tTable("kols")}</Th>
                    <Th>{tTable("spend")}</Th>
                    <Th alignCenter>{tTable("roi")}</Th>
                    <Th>{tTable("dates")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row) => (
                    <TableRow
                      key={row.id}
                      row={row}
                      href={rowHref(row.id)}
                      statusLabel={tStatus(
                        (row.status === "draft" ||
                        row.status === "active" ||
                        row.status === "completed"
                          ? row.status
                          : "all") as
                          | "all"
                          | "draft"
                          | "active"
                          | "completed"
                      )}
                      dateLabel={
                        row.startDate
                          ? format.dateTime(new Date(row.startDate), {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"
                      }
                      endLabel={
                        row.endDate
                          ? format.dateTime(new Date(row.endDate), {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : null
                      }
                      ariaLabel={tTable("openAria", { name: row.name })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <nav
            className="flex items-center justify-end gap-2 pt-2 text-sm"
            aria-label="Pagination"
          >
            {filters.cursor ? (
              <a
                href={withFilter({ cursor: undefined })}
                className="rounded-lg border border-outline-variant px-4 py-2 font-medium text-on-surface-variant transition-colors hover:border-cyan/40 hover:text-cyan"
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
        </>
      )}
    </div>
  );
}

interface TableRowProps {
  row: CampaignListRow;
  href: string;
  statusLabel: string;
  dateLabel: string;
  endLabel: string | null;
  ariaLabel: string;
}

function TableRow({
  row,
  href,
  statusLabel,
  dateLabel,
  endLabel,
  ariaLabel,
}: TableRowProps) {
  return (
    <tr
      className="border-b border-white/5 text-sm text-on-surface transition-colors last:border-none hover:bg-white/[0.03]"
      data-testid="campaign-row"
      data-campaign-id={row.id}
    >
      <Td>
        <Link
          href={href}
          aria-label={ariaLabel}
          className="flex flex-col gap-0.5"
        >
          <span className="font-semibold text-white">{row.name}</span>
          <span className="text-xs text-on-surface-variant">
            {row.product
              ? `${row.product.name} · ${row.product.category}`
              : "—"}
            {row.ownerName ? ` · by ${row.ownerName}` : ""}
          </span>
        </Link>
      </Td>
      <Td>
        <StatusBadge status={row.status} label={statusLabel} />
      </Td>
      <Td alignRight className="tabular-nums">
        <span data-testid="campaign-kol-count">{row.kolCount}</span>
      </Td>
      <Td>
        <SpendCell row={row} />
      </Td>
      <Td alignCenter>
        <RoiCell row={row} />
      </Td>
      <Td>
        <span className="flex flex-col text-xs text-on-surface-variant">
          <span>{dateLabel}</span>
          {endLabel ? <span className="opacity-70">→ {endLabel}</span> : null}
        </span>
      </Td>
    </tr>
  );
}

function Th({
  children,
  alignRight,
  alignCenter,
}: {
  children: React.ReactNode;
  alignRight?: boolean;
  alignCenter?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 ${alignRight ? "text-right" : alignCenter ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  alignRight,
  alignCenter,
  className = "",
}: {
  children: React.ReactNode;
  alignRight?: boolean;
  alignCenter?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${alignRight ? "text-right" : alignCenter ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}
