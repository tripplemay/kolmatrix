"use client";

/**
 * BL-065-F003 · Floating bulk action bar for /match.
 *
 * Migrated from /database (BM1-F005). Spec §F003 decision-point #D
 * Planner-tilt = "保留全部 + 加确认 modal", so we ship three actions:
 *   - Add to Campaign  (reuses the BM1 AddToCampaignDialog unchanged)
 *   - Delete           (NEW vs /database — soft-delete + confirm modal;
 *                       /database had this disabled because it was
 *                       waiting on BL-065 to lock the decision)
 *   - Export CSV       (client-side Blob download from the rows already
 *                       in memory; avoids a second server round-trip
 *                       and keeps the "export the selection" semantic
 *                       distinct from the existing
 *                       /api/database/export-csv "export the filter"
 *                       endpoint)
 *
 * Renders nothing when the selection is empty (handled by the parent
 * conditional — wraps in `count === 0 ? null` analog).
 */
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui";

import type { MatchKolRow } from "./search";

interface Props {
  count: number;
  selectedRows: MatchKolRow[];
  onAddToCampaign: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function MatchBulkActionBar({
  count,
  selectedRows,
  onAddToCampaign,
  onDelete,
  onClear,
}: Props) {
  const t = useTranslations("match.bulk");

  if (count === 0) return null;

  function onExportCsv() {
    if (selectedRows.length === 0) return;
    const csv = buildCsv(selectedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `kol-match-export-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2"
      role="region"
      aria-label={t("ariaRegion")}
      data-testid="match-bulk-bar"
    >
      <div className="glass-panel bg-navy-base/70 flex min-w-[560px] items-center gap-6 rounded-2xl border border-white/10 px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-r border-white/10 pr-6">
          <span
            className="text-cyan text-2xl font-bold"
            data-testid="match-bulk-bar-count"
          >
            {count}
          </span>
          <span className="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
            {t("selected")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={onAddToCampaign}
            data-testid="match-bulk-bar-add-to-campaign"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              add_to_photos
            </span>
            {t("addToCampaign")}
          </Button>
          <Button
            variant="ghost"
            onClick={onExportCsv}
            data-testid="match-bulk-bar-export"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              ios_share
            </span>
            {t("exportCsv")}
          </Button>
          <Button
            variant="danger"
            onClick={onDelete}
            data-testid="match-bulk-bar-delete"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              delete_outline
            </span>
            {t("delete")}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-on-surface-variant hover:text-cyan ml-auto text-xs"
          data-testid="match-bulk-bar-clear"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}

function buildCsv(rows: MatchKolRow[]): string {
  const headers = [
    "id",
    "displayName",
    "handle",
    "platform",
    "followerCount",
    "engagementRate",
    "valueScore",
    "countryCode",
    "language",
    "categories",
    "relationshipStatus",
    "createdAt",
  ];
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.displayName,
        r.handle,
        r.platform,
        r.followerCount,
        r.engagementRate ?? "",
        r.valueScore ?? "",
        r.countryCode ?? "",
        r.language ?? "",
        r.categories.join("|"),
        r.relationshipStatus,
        r.createdAt,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}
