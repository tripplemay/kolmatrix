"use client";

/**
 * BL-065-F001 + F003 · /match table view (client component).
 *
 * F001 shipped this as a read-only server component (no selection); F003
 * upgrades it to the interactive table-view experience: checkbox column,
 * per-page select-all (with indeterminate), and the floating
 * MatchBulkActionBar that exposes Add-to-Campaign / Export-CSV /
 * Delete-with-confirm.
 *
 * Date / status / follower labels still arrive pre-formatted via
 * `rowFormatted` from the server parent (BM2 F011 RSC lesson — no Intl
 * formatter crosses the boundary).
 */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  AddToCampaignDialog,
  type BulkAddResult,
} from "./AddToCampaignDialog";
import { StatusBadge } from "@/components/common";
import { Checkbox, Table, TBody, TCell, THead, TRow } from "@/components/ui";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { MatchBulkActionBar } from "./MatchBulkActionBar";
import type { MatchKolRow } from "./search";

interface Props {
  rows: MatchKolRow[];
  locale: string;
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

export function MatchKolTable({ rows, locale, rowFormatted }: Props) {
  const tTable = useTranslations("match.table");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    [rows],
  );

  const clearAll = useCallback(() => setSelected(new Set()), []);

  const onAdded = useCallback<(result: BulkAddResult) => void>(() => {
    clearAll();
    router.refresh();
  }, [clearAll, router]);

  const onDeleted = useCallback(() => {
    // bulkSoftDeleteKolsAction already calls revalidatePath; we just
    // clear the local selection (router.refresh happens inside the
    // ConfirmDeleteDialog after the action returns).
    clearAll();
  }, [clearAll]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );

  return (
    <>
      <div
        className="glass-panel border-on-surface/5 overflow-hidden rounded-2xl border"
        data-testid="match-table-wrapper"
      >
        <Table data-testid="match-table">
          <THead>
            <TRow>
              <TCell as="th" align="center">
                <Checkbox
                  checked={allOnPage}
                  indeterminate={someOnPage}
                  onCheckedChange={(v) => toggleAll(v)}
                  aria-label={tTable("selectAllAria")}
                />
              </TCell>
              <TCell as="th">{tTable("creator")}</TCell>
              <TCell as="th">{tTable("platform")}</TCell>
              <TCell as="th" align="right">
                {tTable("followers")}
              </TCell>
              <TCell as="th" align="center">
                {tTable("aiScore")}
              </TCell>
              <TCell as="th">{tTable("status")}</TCell>
              <TCell as="th">{tTable("lastContact")}</TCell>
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
                  data-testid="match-row"
                  data-kol-id={kol.id}
                  data-selected={checked ? "true" : undefined}
                >
                  <TCell align="center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRow(kol.id, v)}
                      aria-label={tTable("selectRowAria", {
                        name: kol.displayName,
                      })}
                    />
                  </TCell>
                  <TCell>
                    <Link
                      href={`/${locale}/kols/${kol.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="from-cyan-fixed-dim to-cyan-soft text-on-primary flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-bold">
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
                        <span className="text-on-surface-variant block truncate text-xs">
                          @{kol.handle}
                        </span>
                      </span>
                    </Link>
                  </TCell>
                  <TCell>
                    <span className="bg-surface-high text-on-surface-variant inline-flex items-center rounded px-2 py-0.5 text-[11px] tracking-wide uppercase">
                      {kol.platform}
                    </span>
                  </TCell>
                  <TCell align="right">
                    <p className="font-bold text-white tabular-nums">
                      {fmt?.followersLabel ?? kol.followerCount}
                    </p>
                  </TCell>
                  <TCell align="center">
                    {kol.valueScore != null ? (
                      <span className="bg-cyan/10 text-cyan ring-cyan/20 inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ring-1">
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
                    <span className="text-on-surface-variant text-xs">
                      {fmt?.dateLabel ?? "—"}
                    </span>
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      </div>

      <MatchBulkActionBar
        count={selected.size}
        selectedRows={selectedRows}
        onAddToCampaign={() => setAddOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onClear={clearAll}
      />

      <AddToCampaignDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        selectedIds={selectedIds}
        onAdded={onAdded}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        selectedIds={selectedIds}
        onDeleted={onDeleted}
      />
    </>
  );
}
