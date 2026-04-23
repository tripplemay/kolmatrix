import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { parseFilters, serializeFilters } from "@/lib/kol/filters";

import { DatabaseFilterBar } from "./DatabaseFilterBar";
import { runDatabaseSearch, type DatabaseKolRow } from "./search";

export const metadata = { title: "KOL Database — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const AVATAR_BASE =
  "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary";

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
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

  const result = await runDatabaseSearch(tenantId, filters);

  const t = await getTranslations("database");
  const tTable = await getTranslations("database.table");
  const tStatus = await getTranslations("relationshipStatus");
  const tPager = await getTranslations("discovery.pagination");
  const tEmpty = await getTranslations("database.emptyState");
  const tSummary = await getTranslations("database.summary");
  const format = await getFormatter();

  const basePath = `/${locale}/database`;
  const withFilter = (overrides: Parameters<typeof serializeFilters>[1]) => {
    const q = serializeFilters(filters, overrides).toString();
    return q ? `${basePath}?${q}` : basePath;
  };

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
        <button
          type="button"
          disabled
          title={t("bulkActionsDisabled")}
          data-testid="database-bulk-actions"
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            playlist_add_check
          </span>
          {t("bulkActions")}
        </button>
      </header>

      <DatabaseFilterBar filters={filters} basePath={basePath} />

      <p
        className="text-sm font-semibold text-on-surface"
        data-testid="database-summary"
      >
        {tSummary("count", { count: result.total })}
      </p>

      {result.items.length === 0 ? (
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
        <div
          className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
          data-testid="database-table-wrapper"
        >
          <table
            className="w-full border-collapse text-left text-sm"
            data-testid="database-table"
          >
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                <Th>{tTable("creator")}</Th>
                <Th>{tTable("platform")}</Th>
                <Th alignRight>{tTable("followers")}</Th>
                <Th>{tTable("category")}</Th>
                <Th>{tTable("region")}</Th>
                <Th alignCenter>{tTable("value")}</Th>
                <Th>{tTable("status")}</Th>
                <Th>{tTable("addedAt")}</Th>
                <Th alignRight>{tTable("actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((k) => (
                <TableRow
                  key={k.id}
                  kol={k}
                  locale={locale}
                  statusLabel={tStatus(
                    k.relationshipStatus as
                      | "prospect"
                      | "first_contact"
                      | "negotiating"
                      | "long_term"
                      | "paused"
                      | "terminated"
                  )}
                  dateLabel={format.dateTime(new Date(k.createdAt), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  openLabel={tTable("open")}
                  ariaLabel={`${tTable("ariaRow")}: ${k.displayName}`}
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
    </div>
  );
}

interface TableRowProps {
  kol: DatabaseKolRow;
  locale: string;
  statusLabel: string;
  dateLabel: string;
  openLabel: string;
  ariaLabel: string;
}

function TableRow({
  kol,
  locale,
  statusLabel,
  dateLabel,
  openLabel,
  ariaLabel,
}: TableRowProps) {
  const href = `/${locale}/kols/${kol.id}`;
  return (
    <tr
      className="border-b border-white/5 text-sm text-on-surface transition-colors last:border-none hover:bg-white/[0.03]"
      data-testid="database-row"
      data-kol-id={kol.id}
    >
      <Td>
        <Link
          href={href}
          className="flex items-center gap-3 text-left"
          aria-label={ariaLabel}
        >
          <span className={AVATAR_BASE} aria-hidden>
            {kol.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={kol.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initialsOf(kol.displayName)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-white">
              {kol.displayName}
            </span>
            <span className="block truncate text-xs text-on-surface-variant">
              @{kol.handle}
            </span>
          </span>
        </Link>
      </Td>
      <Td>
        <span className="inline-flex items-center rounded bg-surface-high px-2 py-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant">
          {kol.platform}
        </span>
      </Td>
      <Td alignRight className="tabular-nums">
        {formatFollowers(kol.followerCount)}
      </Td>
      <Td>
        <span className="text-xs text-on-surface-variant">
          {kol.categories.slice(0, 2).join(", ") || "—"}
        </span>
      </Td>
      <Td>
        {kol.countryCode ? (
          <span className="inline-flex items-center rounded bg-surface-high px-2 py-0.5 text-[11px] uppercase tracking-wide">
            {kol.countryCode}
          </span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </Td>
      <Td alignCenter>
        {kol.valueScore != null ? (
          <span className="font-bold text-cyan">{kol.valueScore}</span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </Td>
      <Td>
        <span className="inline-flex items-center rounded-full border border-cyan-fixed/30 bg-cyan/10 px-2 py-0.5 text-[11px] font-medium text-cyan-fixed">
          {statusLabel}
        </span>
      </Td>
      <Td>
        <span className="text-xs text-on-surface-variant">{dateLabel}</span>
      </Td>
      <Td alignRight>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            open_in_new
          </span>
          {openLabel}
        </Link>
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
