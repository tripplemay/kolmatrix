"use client";

/**
 * BL-066-F006 → BL-105-F003 · Single Accepted KOL row.
 *
 * BL-066-F006 made this row read-only (manual contactStatus / kolFee /
 * remove surfaces were stripped). BL-105-F003 restores them as minimal
 * INLINE ops, gated by `canEdit` (campaign owner / admin — computed on
 * the page) so the detail view stays read-only for everyone else and
 * keeps its AI-native tone (ADR-013). The ops reuse the long-orphaned
 * server actions (audit M1): updateKolContactStatusAction /
 * updateKolFeeAction / removeKolAction — contracts unchanged.
 *
 * When `canEdit` is false the markup is byte-identical to the F006
 * read-only row (status text / fee text / view-profile only).
 */
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, Input, Select, TCell, TRow } from "@/components/ui";
import { KOL_CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/kol-campaign-status";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

import {
  removeKolAction,
  updateKolContactStatusAction,
  updateKolFeeAction,
} from "./actions";

export interface AcceptedKolRowEditLabels {
  statusAria: string;
  feeEdit: string;
  feeSave: string;
  feeCancel: string;
  feeAria: string;
  remove: string;
  removeConfirm: string;
  removeYes: string;
  removeNo: string;
  errors: Record<string, string>;
}

interface Props {
  locale: string;
  campaignId: string;
  row: CampaignKolRowData;
  statusLabels: Record<string, string>;
  sourceChipLabels: {
    ai: string;
    csv: string;
    legacy: string;
  };
  viewProfileLabel: string;
  feeUnsetLabel: string;
  canEdit: boolean;
  editLabels: AcceptedKolRowEditLabels;
}

function avatarInitials(name: string): string {
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

function formatAddedAt(iso: string): string {
  // YYYY-MM-DD slice — locale-agnostic, stable for visual baselines.
  return iso.slice(0, 10);
}

function sourceChipClass(source: string): string {
  if (source === "ai_smart_match")
    return "text-primary-fixed bg-primary-container/15 border-primary-container/30";
  if (source === "csv_import")
    return "text-on-surface bg-surface-container border-outline-variant/40";
  // manual_legacy (and any future unknown via filter would never land here)
  return "text-on-surface-variant bg-surface-container-low border-outline-variant/30";
}

function sourceChipText(
  source: string,
  labels: { ai: string; csv: string; legacy: string }
): string {
  if (source === "ai_smart_match") return labels.ai;
  if (source === "csv_import") return labels.csv;
  return labels.legacy;
}

export function AcceptedKolRow({
  locale,
  campaignId,
  row,
  statusLabels,
  sourceChipLabels,
  viewProfileLabel,
  feeUnsetLabel,
  canEdit,
  editLabels,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic status — reverts on action failure (乐观回滚).
  const [status, setStatus] = useState(row.contactStatus);
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState(row.kolFee == null ? "" : String(row.kolFee));
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function run(formData: FormData, action: typeof updateKolFeeAction, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action({ ok: false }, formData);
      if (result.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(result.error ?? "generic");
      }
    });
  }

  function handleStatusChange(next: string) {
    const prev = status;
    setStatus(next); // optimistic
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("campaignId", campaignId);
      fd.set("kolId", row.kolId);
      fd.set("contactStatus", next);
      const result = await updateKolContactStatusAction({ ok: false }, fd);
      if (result.ok) {
        router.refresh();
      } else {
        setStatus(prev); // rollback
        setError(result.error ?? "generic");
      }
    });
  }

  function handleFeeSave() {
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    fd.set("kolId", row.kolId);
    fd.set("kolFee", feeDraft.trim());
    run(fd, updateKolFeeAction, () => setEditingFee(false));
  }

  function handleRemove() {
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    fd.set("kolId", row.kolId);
    run(fd, removeKolAction, () => setConfirmingRemove(false));
  }

  return (
    <TRow data-testid="accepted-kol-row" data-kol-id={row.kolId}>
      <TCell>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
          >
            {row.avatarUrl ? (
              <Image
                src={row.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            ) : (
              avatarInitials(row.displayName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{row.displayName}</p>
            <p className="truncate text-xs text-on-surface-variant">
              @{row.handle} · {row.platform} · {formatFollowers(row.followerCount)}
            </p>
          </div>
        </div>
      </TCell>
      <TCell>
        <span
          data-testid="accepted-kol-source-chip"
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${sourceChipClass(row.source)}`}
        >
          {sourceChipText(row.source, sourceChipLabels)}
        </span>
      </TCell>
      <TCell>
        {canEdit ? (
          <Select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={pending}
            aria-label={editLabels.statusAria}
            data-testid="accepted-kol-status-select"
            className="h-8 w-36 py-0 text-xs"
          >
            {KOL_CAMPAIGN_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s] ?? s}
              </option>
            ))}
          </Select>
        ) : (
          <span
            data-testid="accepted-kol-status"
            className="text-sm text-on-surface"
          >
            {statusLabels[row.contactStatus] ?? row.contactStatus}
          </span>
        )}
      </TCell>
      <TCell>
        {canEdit && editingFee ? (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              inputMode="decimal"
              value={feeDraft}
              onChange={(e) => setFeeDraft(e.target.value)}
              aria-label={editLabels.feeAria}
              data-testid="accepted-kol-fee-input"
              className="h-8 w-24 py-0 text-xs"
            />
            <Button
              type="button"
              variant="primary-gradient"
              size="sm"
              onClick={handleFeeSave}
              disabled={pending}
              data-testid="accepted-kol-fee-save"
            >
              {editLabels.feeSave}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingFee(false);
                setFeeDraft(row.kolFee == null ? "" : String(row.kolFee));
              }}
            >
              {editLabels.feeCancel}
            </Button>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => setEditingFee(true)}
            data-testid="accepted-kol-fee-edit"
            className="rounded px-1 text-sm text-on-surface hover:text-cyan"
            title={editLabels.feeEdit}
          >
            {row.kolFee == null ? feeUnsetLabel : row.kolFee.toFixed(2)}
          </button>
        ) : (
          <span data-testid="accepted-kol-fee" className="text-sm text-on-surface">
            {row.kolFee == null ? feeUnsetLabel : row.kolFee.toFixed(2)}
          </span>
        )}
      </TCell>
      <TCell>
        <span
          data-testid="accepted-kol-added-at"
          className="text-xs text-on-surface-variant"
        >
          {formatAddedAt(row.addedAt)}
        </span>
      </TCell>
      <TCell align="right">
        <div className="flex items-center justify-end gap-2">
          {canEdit && confirmingRemove ? (
            <span
              className="flex items-center gap-1.5 text-xs text-on-surface-variant"
              data-testid="accepted-kol-remove-confirm"
            >
              {editLabels.removeConfirm}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={pending}
                data-testid="accepted-kol-remove-yes"
                className="text-error"
              >
                {editLabels.removeYes}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingRemove(false)}
                data-testid="accepted-kol-remove-no"
              >
                {editLabels.removeNo}
              </Button>
            </span>
          ) : canEdit ? (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              aria-label={editLabels.remove}
              title={editLabels.remove}
              data-testid="accepted-kol-remove"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:border-error/40 hover:text-error"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          ) : null}
          <Link
            href={`/${locale}/kols/${row.kolId}`}
            aria-label={viewProfileLabel}
            data-testid="accepted-kol-view-profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:border-primary-container/40 hover:text-primary-fixed"
          >
            <span className="material-symbols-outlined text-[18px]">
              open_in_new
            </span>
          </Link>
        </div>
        {error ? (
          <p
            data-testid="accepted-kol-error"
            role="alert"
            className="mt-1 text-right text-[11px] text-error"
          >
            {editLabels.errors[error] ?? editLabels.errors.generic}
          </p>
        ) : null}
      </TCell>
    </TRow>
  );
}
