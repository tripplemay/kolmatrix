/**
 * BL-066-F006 · Accepted KOLs panel (read-only table).
 *
 * Renames the former CampaignKolPanel into AcceptedKolsPanel and drops
 * every mutation surface (Add KOL, status select, fee input, remove
 * button). The AI recommendation flow (AiRecommendationPanel +
 * acceptKolToCampaignAction) is now the canonical add-to-campaign
 * path; per BL-066 #B decision marketers no longer hand-pick from a
 * list, and per #C the panel only shows kol_campaign rows whose
 * `source` is one of the whitelist values:
 *
 *   ai_smart_match · csv_import · manual_legacy
 *
 * The F006 backfill migration (20260514210000_..._source_manual_
 * legacy_backfill) rewrites pre-F004 `'manual'` rows to
 * `'manual_legacy'` so existing campaigns stay visible.
 *
 * BL-110-F003: the source whitelist alone leaked skip/swap rows — the AI
 * Match panel (/match) writes source="ai_smart_match" for skip AND swap
 * (suggestionStatus "skipped"/"swap_pool"). The visibility test now also
 * requires suggestionStatus ∈ {accepted, NULL}; the shared predicate
 * lives in accepted-filter.ts (reused by the page's acceptedCount).
 *
 * Layout per design-draft/bl066-campaign-detail-ai-main-panel/README.md
 * §"Accepted KOLs 区" — 6 columns:
 *   avatar+name / source chip / status pill / fee / addedAt / view-profile
 */
import { Table, TBody, TCell, THead, TRow } from "@/components/ui";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

import { isAcceptedKolRow } from "./accepted-filter";
import { AcceptedKolRow, type AcceptedKolRowEditLabels } from "./AcceptedKolRow";

interface Labels {
  title: string;
  empty: string;
  columns: {
    creator: string;
    source: string;
    contactStatus: string;
    fee: string;
    addedAt: string;
    actions: string;
  };
  sourceChip: {
    ai: string;
    csv: string;
    legacy: string;
  };
  viewProfile: string;
  feeUnset: string;
}

interface Props {
  locale: string;
  campaignId: string;
  kols: CampaignKolRowData[];
  labels: Labels;
  statusLabels: Record<string, string>;
  // BL-105-F003 — owner/admin gate for the inline ops; false keeps the
  // panel byte-identical to the BL-066-F006 read-only table.
  canEdit: boolean;
  editLabels: AcceptedKolRowEditLabels;
}

export function AcceptedKolsPanel({
  locale,
  campaignId,
  kols,
  labels,
  statusLabels,
  canEdit,
  editLabels,
}: Props) {
  // BL-110-F003 — source whitelist + suggestionStatus ∈ {accepted, NULL}
  // (shared with the page's acceptedCount so they stay in lockstep).
  const visible = kols.filter(isAcceptedKolRow);

  return (
    <section
      data-testid="accepted-kols-panel"
      className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
      </header>

      {visible.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
          {labels.empty}
        </p>
      ) : (
        <Table>
          <THead>
            <TRow>
              <TCell as="th">{labels.columns.creator}</TCell>
              <TCell as="th">{labels.columns.source}</TCell>
              <TCell as="th">{labels.columns.contactStatus}</TCell>
              <TCell as="th">{labels.columns.fee}</TCell>
              <TCell as="th">{labels.columns.addedAt}</TCell>
              <TCell as="th" align="right">
                {labels.columns.actions}
              </TCell>
            </TRow>
          </THead>
          <TBody>
            {visible.map((row) => (
              <AcceptedKolRow
                key={row.kolCampaignId}
                locale={locale}
                campaignId={campaignId}
                row={row}
                statusLabels={statusLabels}
                sourceChipLabels={labels.sourceChip}
                viewProfileLabel={labels.viewProfile}
                feeUnsetLabel={labels.feeUnset}
                canEdit={canEdit}
                editLabels={editLabels}
              />
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
