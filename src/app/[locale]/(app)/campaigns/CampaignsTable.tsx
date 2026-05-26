/**
 * MVP-vf-F004 · Campaigns list table (server component).
 *
 * Server-only: renders the row list with locale-formatted dates and
 * status badges. No client interaction beyond row links — the filter
 * bar + KPI strip handle every other lever.
 *
 * Uses the public `<Table>`/`<TRow>`/`<TCell>` atoms and
 * `<StatusBadge domain="campaign">` for the status pill.
 */
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import { StatusBadge } from "@/components/common";
import { Table, TBody, TCell, THead, TRow } from "@/components/ui";
import type { CampaignListRow } from "@/lib/campaigns/search";

interface Props {
  rows: CampaignListRow[];
  locale: string;
}

function formatCurrency(n: number | null, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export async function CampaignsTable({ rows, locale }: Props) {
  const t = await getTranslations("campaigns.table");
  const tStatus = await getTranslations("campaigns.status");
  const tMatchAction = await getTranslations("campaigns.matchKolAction");
  const format = await getFormatter();

  return (
    <div
      className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
      data-testid="campaigns-table-wrapper"
    >
      <Table data-testid="campaigns-table">
        <THead>
          <TRow>
            <TCell as="th">{t("name")}</TCell>
            <TCell as="th">{t("status")}</TCell>
            <TCell as="th" align="right">
              {t("kols")}
            </TCell>
            <TCell as="th">{t("spend")}</TCell>
            <TCell as="th" align="center">
              {t("roi")}
            </TCell>
            <TCell as="th">{t("dates")}</TCell>
            <TCell as="th" align="right">
              {tMatchAction("actionColumn")}
            </TCell>
          </TRow>
        </THead>
        <TBody>
          {rows.map((row) => {
            const statusKey =
              row.status === "draft" ||
              row.status === "active" ||
              row.status === "completed"
                ? row.status
                : "all";
            const dateLabel = row.startDate
              ? format.dateTime(new Date(row.startDate), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—";
            const endLabel = row.endDate
              ? format.dateTime(new Date(row.endDate), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null;
            return (
              <TRow
                key={row.id}
                interactive
                data-testid="campaign-row"
                data-campaign-id={row.id}
              >
                <TCell>
                  <Link
                    href={`/${locale}/campaigns/${row.id}`}
                    aria-label={t("openAria", { name: row.name })}
                    className="block"
                  >
                    <span className="block font-semibold text-white">
                      {row.name}
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      {row.product
                        ? `${row.product.name} · ${row.product.category}`
                        : "—"}
                      {row.ownerName ? ` · ${row.ownerName}` : ""}
                    </span>
                  </Link>
                </TCell>
                <TCell>
                  <StatusBadge
                    domain="campaign"
                    status={row.status}
                    label={tStatus(statusKey)}
                  />
                </TCell>
                <TCell align="right">
                  <span data-testid="campaign-kol-count">{row.kolCount}</span>
                </TCell>
                <TCell>
                  <SpendCell row={row} />
                </TCell>
                <TCell align="center">
                  <RoiCell row={row} />
                </TCell>
                <TCell>
                  <span className="text-xs text-on-surface-variant">
                    {dateLabel}
                    {endLabel ? ` → ${endLabel}` : ""}
                  </span>
                </TCell>
                {/* BL-074-F002 — per-row Match KOL CTA. Targets the
                    /match workbench with the campaign's id pre-pinned
                    so the AiSuggestionsSidebar mounts in
                    campaign-context mode. Keeps the navigation flow
                    "pick a campaign → match KOLs" one click away
                    (ADR-015 rationale §3). */}
                <TCell align="right">
                  <Link
                    href={`/${locale}/match?campaignId=${row.id}`}
                    data-testid="campaign-row-match-cta"
                    data-campaign-id={row.id}
                    aria-label={tMatchAction("ariaLabel", { name: row.name })}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-[12px] font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      aria-hidden
                    >
                      auto_awesome
                    </span>
                    <span>{tMatchAction("label")}</span>
                  </Link>
                </TCell>
              </TRow>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function SpendCell({ row }: { row: CampaignListRow }) {
  const spendStr = formatCurrency(row.spendTotal);
  const budgetStr = formatCurrency(row.budgetAmount);
  const pct =
    row.budgetAmount && row.budgetAmount > 0
      ? Math.min(100, Math.round((row.spendTotal / row.budgetAmount) * 100))
      : null;
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <div className="flex justify-between text-[11px] tabular-nums">
        <span className="text-on-surface">{spendStr}</span>
        {row.budgetAmount != null ? (
          <span className="text-on-surface-variant">/ {budgetStr}</span>
        ) : null}
      </div>
      {pct != null ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-high"
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
      data-testid="campaign-roi"
      className={
        positive
          ? "font-bold tabular-nums text-emerald-400"
          : "font-bold tabular-nums text-error"
      }
    >
      {positive ? "+" : ""}
      {row.roiPercent.toFixed(1)}%
    </span>
  );
}
