/**
 * BM2-F009 · Campaign ROI Analysis table (Planner adjudication
 * §13 #K1:A + #K2:A).
 *
 * - Status column always rendered ("Completed" pill for every row;
 *   F008 only returns completed campaigns)
 * - Client-side React filter input (~150ms debounce per §13.5 #4)
 * - Sorted by ROI desc (already from F008 loader); rows clickable →
 *   /campaigns/:id detail
 */
"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { StatusBadge } from "@/components/common/StatusBadge";

import type { RoiCampaignRow } from "@/lib/roi/queries";

interface Props {
  locale: string;
  rows: RoiCampaignRow[];
  labels: {
    title: string;
    filterPlaceholder: string;
    empty: string;
    completed: string;
    cols: {
      campaign: string;
      product: string;
      closedAt: string;
      spend: string;
      revenue: string;
      roi: string;
      status: string;
    };
  };
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function roiClasses(roi: number | null): string {
  if (roi == null) return "text-on-surface-variant";
  if (roi >= 100) return "text-emerald-300";
  if (roi >= 0) return "text-cyan";
  return "text-error";
}

export function RoiCampaignTable({ locale, rows, labels }: Props) {
  const [filter, setFilter] = useState("");
  const deferred = useDeferredValue(filter);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, deferred]);

  return (
    <article
      data-testid="roi-campaign-card"
      className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface-low/60 p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white">{labels.title}</h2>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={labels.filterPlaceholder}
          data-testid="roi-campaign-filter"
          className="w-full max-w-xs rounded-xl border border-white/10 bg-surface-high/40 px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:border-cyan focus:outline-none"
        />
      </header>

      {filtered.length === 0 ? (
        <p
          data-testid="roi-campaign-empty"
          className="py-12 text-center text-sm text-on-surface-variant"
        >
          {labels.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="py-2 pr-4">{labels.cols.campaign}</th>
                <th className="py-2 pr-4">{labels.cols.product}</th>
                <th className="py-2 pr-4">{labels.cols.closedAt}</th>
                <th className="py-2 pr-4 text-right">{labels.cols.spend}</th>
                <th className="py-2 pr-4 text-right">{labels.cols.revenue}</th>
                <th className="py-2 pr-4 text-right">{labels.cols.roi}</th>
                <th className="py-2">{labels.cols.status}</th>
              </tr>
            </thead>
            <tbody data-testid="roi-campaign-rows">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 transition hover:bg-surface-high/30"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/${locale}/campaigns/${row.id}`}
                      className="font-semibold text-white hover:text-cyan"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {row.productName ?? "—"}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-on-surface-variant">
                    {formatDate(row.closedAt)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatCurrency(row.spendTotal)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatCurrency(row.revenueRecorded)}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right font-bold tabular-nums ${roiClasses(row.roiPercent)}`}
                  >
                    {row.roiPercent == null
                      ? "—"
                      : `${row.roiPercent.toFixed(1)}%`}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      domain="campaign"
                      status="completed"
                      label={labels.completed}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
