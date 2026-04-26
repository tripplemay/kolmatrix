"use client";

/**
 * BM2-F005 + MVP-vf-F005 · Single KolCampaign row.
 *
 * Pulled out of the 495-line CampaignKolPanel.tsx during the F005
 * hotfix split. Owns the per-row contactStatus select (server action
 * on change) and the kolFee input (onBlur save) — no broader state
 * leaks to the parent panel.
 */
import { useState } from "react";

import { Input, Select, TCell, TRow } from "@/components/ui";
import { KOL_CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/kol-campaign-status";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

import {
  removeKolAction,
  updateKolContactStatusAction,
  updateKolFeeAction,
} from "./actions";

interface Props {
  campaignId: string;
  row: CampaignKolRowData;
  statusLabels: Record<string, string>;
  removeLabel: string;
  removeConfirmLabel: string;
  errorLabels: Record<string, string>;
  locked: boolean;
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

export function CampaignKolRow({
  campaignId,
  row,
  statusLabels,
  removeLabel,
  removeConfirmLabel,
  errorLabels,
  locked,
}: Props) {
  const [feeError, setFeeError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const next = e.target.value;
    if (next === row.contactStatus) return;
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    fd.set("kolId", row.kolId);
    fd.set("contactStatus", next);
    const result = await updateKolContactStatusAction({ ok: false }, fd);
    if (!result.ok) {
      setStatusError(errorLabels[result.error ?? "generic"] ?? errorLabels.generic);
      e.target.value = row.contactStatus;
    } else {
      setStatusError(null);
    }
  };

  const handleFeeBlur = async (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value.trim();
    const existing = row.kolFee == null ? "" : String(row.kolFee);
    if (raw === existing) return;
    if (raw !== "" && !/^\d+(\.\d{1,2})?$/.test(raw)) {
      setFeeError(errorLabels.feeInvalid ?? errorLabels.generic);
      return;
    }
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    fd.set("kolId", row.kolId);
    fd.set("kolFee", raw);
    const result = await updateKolFeeAction({ ok: false }, fd);
    if (!result.ok) {
      setFeeError(errorLabels[result.error ?? "generic"] ?? errorLabels.generic);
    } else {
      setFeeError(null);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(removeConfirmLabel)) return;
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    fd.set("kolId", row.kolId);
    await removeKolAction({ ok: false }, fd);
  };

  return (
    <TRow data-testid="campaign-kol-row" data-kol-id={row.kolId}>
      <TCell>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
          >
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
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
        <Select
          defaultValue={row.contactStatus}
          onChange={handleStatusChange}
          disabled={locked}
          data-testid="campaign-kol-status-select"
          className="h-9"
        >
          {KOL_CAMPAIGN_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s] ?? s}
            </option>
          ))}
        </Select>
        {statusError ? (
          <p className="mt-1 text-xs text-error">{statusError}</p>
        ) : null}
      </TCell>
      <TCell>
        <Input
          type="text"
          inputMode="decimal"
          defaultValue={row.kolFee == null ? "" : String(row.kolFee)}
          onBlur={handleFeeBlur}
          placeholder="0.00"
          data-testid="campaign-kol-fee-input"
          className="h-9"
        />
        {feeError ? (
          <p className="mt-1 text-xs text-error">{feeError}</p>
        ) : null}
      </TCell>
      <TCell align="right">
        <button
          type="button"
          onClick={handleRemove}
          disabled={locked}
          data-testid="campaign-kol-remove"
          className="rounded-lg border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-error/40 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removeLabel}
        </button>
      </TCell>
    </TRow>
  );
}
