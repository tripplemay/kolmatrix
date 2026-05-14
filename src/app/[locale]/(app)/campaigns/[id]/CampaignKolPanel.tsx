"use client";

/**
 * BM2-F005 + MVP-vf-F005 / BL-066-F005 · KOL panel section.
 *
 * Slim wrapper now: split out into <CampaignKolRow> (former 495-line
 * file). Renders the existing KOLs as a table. F006 will git-mv this
 * file → AcceptedKolsPanel.tsx + delete the contactStatus / kolFee edit
 * inputs in favour of a read-only source-chip table.
 *
 * BL-066-F005: AddKolDialog mount + state removed. AI recommendation
 * flow (AiRecommendationPanel + acceptKolToCampaignAction) is the
 * canonical KOL-add path; marketers no longer manually pick from a list.
 * The `addButton` / `aiNativeMigrationTooltip` label fields are still
 * accepted to keep the page-side label-assembler stable until F006
 * cleans up the labels too.
 */
import { Table, TBody, TCell, THead, TRow } from "@/components/ui";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

import { CampaignKolRow } from "./CampaignKolRow";

interface Labels {
  title: string;
  empty: string;
  addButton: string;
  aiNativeMigrationTooltip: string;
  addDialog: {
    title: string;
    searchPlaceholder: string;
    empty: string;
    feeLabel: string;
    submit: string;
    close: string;
  };
  columns: {
    creator: string;
    contactStatus: string;
    fee: string;
    actions: string;
  };
  remove: string;
  removeConfirm: string;
}

interface Props {
  campaignId: string;
  campaignStatus: string;
  kols: CampaignKolRowData[];
  labels: Labels;
  statusLabels: Record<string, string>;
  errorLabels: Record<string, string>;
}

export function CampaignKolPanel({
  campaignId,
  campaignStatus,
  kols,
  labels,
  statusLabels,
  errorLabels,
}: Props) {
  // Revenue lock (status=completed) implies KOL mutations feel risky
  // — fee edits / status pushes are guarded; structural changes are
  // already gone post BL-066-F005.
  const locked = campaignStatus === "completed";

  return (
    <section
      data-testid="campaign-kol-panel"
      className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
      </header>

      {kols.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
          {labels.empty}
        </p>
      ) : (
        <Table>
          <THead>
            <TRow>
              <TCell as="th">{labels.columns.creator}</TCell>
              <TCell as="th">{labels.columns.contactStatus}</TCell>
              <TCell as="th">{labels.columns.fee}</TCell>
              <TCell as="th" align="right">
                {labels.columns.actions}
              </TCell>
            </TRow>
          </THead>
          <TBody>
            {kols.map((row) => (
              <CampaignKolRow
                key={row.kolCampaignId}
                campaignId={campaignId}
                row={row}
                statusLabels={statusLabels}
                removeLabel={labels.remove}
                removeConfirmLabel={labels.removeConfirm}
                errorLabels={errorLabels}
                locked={locked}
              />
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
