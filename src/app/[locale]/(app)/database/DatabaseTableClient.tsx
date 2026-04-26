"use client";

/**
 * MVP-vf-F003 · Selection-aware table wrapper for /database.
 *
 * Owns:
 *   - per-row checkbox state (Set<string>)
 *   - "select all on this page" header checkbox (with indeterminate)
 *   - BulkActionBar visibility
 *   - AddToCampaignDialog open/close + post-success bookkeeping
 *
 * Defers all visual / data work to <table> with the public `<Checkbox>`
 * atom + plain elements; the layout matches the Stitch prototype's
 * "row 0 is the bulk-checkbox column" structure.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { StatusBadge } from "@/components/common";
import { Checkbox, Table, TBody, TCell, THead, TRow } from "@/components/ui";

import {
  AddToCampaignDialog,
  type BulkAddResult,
} from "./AddToCampaignDialog";
import { BulkActionBar } from "./BulkActionBar";
import type { DatabaseKolRow } from "./search";

interface Props {
  rows: DatabaseKolRow[];
  locale: string;
  /** Pre-localised cell labels passed from the server component. */
  cellLabels: {
    creator: string;
    platform: string;
    followers: string;
    engagement: string;
    score: string;
    status: string;
    lastContact: string;
    selectAll: string;
    selectRowAria: (name: string) => string;
    open: string;
  };
  bulkLabels: {
    selected: string;
    addToCampaign: string;
    email: string;
    emailTooltip: string;
    delete: string;
    deleteTooltip: string;
    clear: string;
  };
  dialogLabels: {
    title: string;
    body: string;
    chooseCampaign: string;
    submit: string;
    submitting: string;
    cancel: string;
    loading: string;
    noCampaigns: string;
    errorGeneric: string;
  };
  /**
   * Pre-formatted strings the parent already computed under
   * next-intl/server. The client cannot recompute server formatters.
   */
  rowFormatted: Record<
    string,
    {
      dateLabel: string;
      statusKey: string;
      statusLabel: string;
      followersLabel: string;
    }
  >;
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function DatabaseTableClient({
  rows,
  locale,
  cellLabels,
  bulkLabels,
  dialogLabels,
  rowFormatted,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = !allOnPage && rows.some((r) => selected.has(r.id));

  const toggleRow = useCallback((id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  const toggleAll = useCallback(
    (next: boolean) => {
      setSelected((prev) => {
        const copy = new Set(prev);
        for (const r of rows) {
          if (next) copy.add(r.id);
          else copy.delete(r.id);
        }
        return copy;
      });
    },
    [rows]
  );

  const clearAll = useCallback(() => setSelected(new Set()), []);

  const onAdded = useCallback<(result: BulkAddResult) => void>(
    () => {
      clearAll();
      // Server data drives the count cards / status pills — refresh so
      // the next render reflects the new audit_log + spendTotal state
      // without requiring a hard navigation.
      router.refresh();
    },
    [clearAll, router]
  );

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <>
      <div
        className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5"
        data-testid="database-table-wrapper"
      >
        <Table data-testid="database-table">
          <THead>
            <TRow>
              <TCell as="th" align="center">
                <Checkbox
                  checked={allOnPage}
                  indeterminate={someOnPage}
                  onCheckedChange={(v) => toggleAll(v)}
                  aria-label={cellLabels.selectAll}
                />
              </TCell>
              <TCell as="th">{cellLabels.creator}</TCell>
              <TCell as="th">{cellLabels.platform}</TCell>
              <TCell as="th" align="right">
                {cellLabels.followers}
              </TCell>
              <TCell as="th" align="center">
                {cellLabels.score}
              </TCell>
              <TCell as="th">{cellLabels.status}</TCell>
              <TCell as="th">{cellLabels.lastContact}</TCell>
            </TRow>
          </THead>
          <TBody>
            {rows.map((kol) => {
              const fmt = rowFormatted[kol.id];
              const checked = selected.has(kol.id);
              return (
                <TRow
                  key={kol.id}
                  interactive
                  data-testid="database-row"
                  data-kol-id={kol.id}
                  data-selected={checked ? "true" : undefined}
                >
                  <TCell align="center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRow(kol.id, v)}
                      aria-label={cellLabels.selectRowAria(kol.displayName)}
                    />
                  </TCell>
                  <TCell>
                    <Link
                      href={`/${locale}/kols/${kol.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary">
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
                  </TCell>
                  <TCell>
                    <span className="inline-flex items-center rounded bg-surface-high px-2 py-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant">
                      {kol.platform}
                    </span>
                  </TCell>
                  <TCell align="right">
                    <p className="font-bold tabular-nums text-white">
                      {fmt?.followersLabel ?? kol.followerCount}
                    </p>
                  </TCell>
                  <TCell align="center">
                    {kol.valueScore != null ? (
                      <span className="inline-flex h-7 items-center rounded-full bg-cyan/10 px-3 text-xs font-bold text-cyan ring-1 ring-cyan/20">
                        {kol.valueScore}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </TCell>
                  <TCell>
                    <StatusBadge
                      domain="kolRelationship"
                      status={kol.relationshipStatus}
                      label={fmt?.statusLabel ?? kol.relationshipStatus}
                    />
                  </TCell>
                  <TCell>
                    <span className="text-xs text-on-surface-variant">
                      {fmt?.dateLabel ?? "—"}
                    </span>
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      </div>

      <BulkActionBar
        count={selected.size}
        onAddToCampaign={() => setDialogOpen(true)}
        onClear={clearAll}
        labels={bulkLabels}
      />

      <AddToCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedIds={selectedIds}
        onAdded={onAdded}
        labels={dialogLabels}
      />
    </>
  );
}
