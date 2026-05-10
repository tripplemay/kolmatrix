"use client";

/**
 * BM2-F005 + MVP-vf-F005 · KOL panel section.
 *
 * Slim wrapper now: split out into <CampaignKolRow> and
 * <AddKolDialog> (former 495-line file). Keeps the dialog open/close
 * state, adds the public `<Table>` shell, and forwards every per-row
 * action to its dedicated component.
 */
import { useState } from "react";

import { Button, Table, TBody, TCell, THead, TRow } from "@/components/ui";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

import { AddKolDialog, type AvailableKol } from "./AddKolDialog";
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
  available: AvailableKol[];
  labels: Labels;
  statusLabels: Record<string, string>;
  errorLabels: Record<string, string>;
}

export function CampaignKolPanel({
  campaignId,
  campaignStatus,
  kols,
  available,
  labels,
  statusLabels,
  errorLabels,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Revenue lock (status=completed) implies KOL mutations feel risky
  // — disable structural changes (add / remove) and status pushes.
  // Fee edits still commit (marketers may reconcile invoices post-
  // completion without re-activating).
  const locked = campaignStatus === "completed";

  return (
    <section
      data-testid="campaign-kol-panel"
      className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <Button
          variant="primary-gradient"
          onClick={() => setDialogOpen(true)}
          disabled={locked || available.length === 0}
          title={labels.aiNativeMigrationTooltip}
          data-testid="campaign-kol-add-button"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            person_add
          </span>
          {labels.addButton}
        </Button>
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

      <AddKolDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaignId={campaignId}
        available={available}
        labels={labels.addDialog}
        errorLabels={errorLabels}
      />
    </section>
  );
}
