/**
 * BL-110-F003 · Single source of truth for "is this kol_campaign row an
 * accepted KOL?". Shared by AcceptedKolsPanel (which rows render) and the
 * campaign-detail page's acceptedCount KPI so the table and the count can
 * never drift apart.
 *
 * A row counts as accepted iff:
 *   1. its `source` is one of the visible add-to-campaign paths
 *      (ai_smart_match / csv_import / manual_legacy), AND
 *   2. it is NOT a non-accept suggestion decision. The AI Match panel
 *      (/match) writes source="ai_smart_match" for skip AND swap too
 *      (suggestionStatus "skipped" / "swap_pool"), so filtering on
 *      `source` alone leaked skipped/swapped KOLs into "已接受". We keep
 *      `suggestionStatus ∈ {accepted, NULL}`:
 *        - "accepted" = AI-panel accept, detail-page accept (BL-110-F003
 *          write fix), or ADR-016 legacy backfill.
 *        - NULL       = pre-fix detail-page accepts + csv_import /
 *          manual_legacy rows that never entered the suggestion lifecycle.
 */
const VISIBLE_SOURCES = new Set(["ai_smart_match", "csv_import", "manual_legacy"]);

export interface AcceptedFilterRow {
  source: string;
  suggestionStatus: string | null;
}

export function isAcceptedKolRow(row: AcceptedFilterRow): boolean {
  if (!VISIBLE_SOURCES.has(row.source)) return false;
  return row.suggestionStatus == null || row.suggestionStatus === "accepted";
}
