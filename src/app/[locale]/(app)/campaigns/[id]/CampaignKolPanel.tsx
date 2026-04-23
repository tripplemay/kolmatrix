"use client";

/**
 * BM2-F005 · KOL panel section.
 *
 * Table of KolCampaign rows with per-row contactStatus select and
 * kolFee input (onBlur saves). Add-KOL dialog lists saved creators not
 * yet in the campaign, with an optional prefill kolFee.
 */
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { KOL_CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/kol-campaign-status";
import type { CampaignKolRow } from "@/lib/campaigns/detail";

import {
  addKolAction,
  removeKolAction,
  updateKolContactStatusAction,
  updateKolFeeAction,
  type ActionState,
} from "./actions";

interface AvailableKol {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
}

interface Labels {
  title: string;
  empty: string;
  addButton: string;
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
  kols: CampaignKolRow[];
  available: AvailableKol[];
  labels: Labels;
  statusLabels: Record<string, string>;
  errorLabels: Record<string, string>;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
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
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={locked || available.length === 0}
          data-testid="campaign-kol-add-button"
          className="gradient-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            person_add
          </span>
          {labels.addButton}
        </button>
      </header>

      {kols.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
          {labels.empty}
        </p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              <th className="px-6 py-3">{labels.columns.creator}</th>
              <th className="px-6 py-3">{labels.columns.contactStatus}</th>
              <th className="px-6 py-3">{labels.columns.fee}</th>
              <th className="px-6 py-3 text-right">
                {labels.columns.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {kols.map((row) => (
              <KolRow
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
          </tbody>
        </table>
      )}

      {dialogOpen ? (
        <AddKolDialog
          campaignId={campaignId}
          available={available}
          labels={labels.addDialog}
          errorLabels={errorLabels}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}

function KolRow({
  campaignId,
  row,
  statusLabels,
  removeLabel,
  removeConfirmLabel,
  errorLabels,
  locked,
}: {
  campaignId: string;
  row: CampaignKolRow;
  statusLabels: Record<string, string>;
  removeLabel: string;
  removeConfirmLabel: string;
  errorLabels: Record<string, string>;
  locked: boolean;
}) {
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
      // Reset the select to the server-known value.
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
    <tr
      className="border-b border-white/5 text-sm text-on-surface transition-colors last:border-none hover:bg-white/[0.03]"
      data-testid="campaign-kol-row"
      data-kol-id={row.kolId}
    >
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
            aria-hidden
          >
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              avatarInitials(row.displayName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {row.displayName}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              @{row.handle} · {row.platform} ·{" "}
              {formatFollowers(row.followerCount)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="flex min-w-[160px] flex-col gap-1">
          <select
            defaultValue={row.contactStatus}
            onChange={handleStatusChange}
            disabled={locked}
            data-testid="campaign-kol-status-select"
            className="h-9 rounded-lg border border-outline-variant bg-surface/40 px-2 text-sm text-on-surface focus:border-cyan focus:outline-none"
          >
            {KOL_CAMPAIGN_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s] ?? s}
              </option>
            ))}
          </select>
          {statusError ? (
            <p className="text-xs text-error">{statusError}</p>
          ) : null}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="flex min-w-[120px] flex-col gap-1">
          <input
            type="text"
            inputMode="decimal"
            defaultValue={row.kolFee == null ? "" : String(row.kolFee)}
            onBlur={handleFeeBlur}
            placeholder="0.00"
            data-testid="campaign-kol-fee-input"
            className="h-9 rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none"
          />
          {feeError ? (
            <p className="text-xs text-error">{feeError}</p>
          ) : null}
        </div>
      </td>
      <td className="px-6 py-3 text-right">
        <button
          type="button"
          onClick={handleRemove}
          disabled={locked}
          data-testid="campaign-kol-remove"
          className="rounded-lg border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-error/40 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removeLabel}
        </button>
      </td>
    </tr>
  );
}

function AddKolDialog({
  campaignId,
  available,
  labels,
  errorLabels,
  onClose,
}: {
  campaignId: string;
  available: AvailableKol[];
  labels: Labels["addDialog"];
  errorLabels: Record<string, string>;
  onClose: () => void;
}) {
  const dialogId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(available[0]?.id ?? null);
  const [state, formAction] = useActionState<ActionState, FormData>(
    addKolAction,
    { ok: false }
  );
  const lastResultRef = useRef<boolean>(false);

  useEffect(() => {
    if (state.ok && !lastResultRef.current) {
      lastResultRef.current = true;
      onClose();
    }
  }, [state.ok, onClose]);

  const filtered = available.filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      k.displayName.toLowerCase().includes(q) ||
      k.handle.toLowerCase().includes(q)
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${dialogId}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-base/80 backdrop-blur-sm"
      data-testid="campaign-kol-add-dialog"
    >
      <div className="glass-panel relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-on-surface/10">
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 id={`${dialogId}-title`} className="text-base font-semibold text-white">
            {labels.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="text-on-surface-variant hover:text-cyan"
          >
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="px-5 py-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder}
            data-testid="campaign-kol-add-search"
            className="h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">
              {labels.empty}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {filtered.map((k) => (
                <li key={k.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-3">
                    <input
                      type="radio"
                      name="kolId-picker"
                      value={k.id}
                      checked={selected === k.id}
                      onChange={() => setSelected(k.id)}
                      className="h-4 w-4 accent-cyan"
                    />
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary">
                      {k.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={k.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        avatarInitials(k.displayName)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {k.displayName}
                      </span>
                      <span className="block truncate text-xs text-on-surface-variant">
                        @{k.handle} · {k.platform} ·{" "}
                        {formatFollowers(k.followerCount)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          action={formAction}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4"
          data-testid="campaign-kol-add-form"
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="kolId" value={selected ?? ""} />
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-on-surface-variant">
            <span>{labels.feeLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              name="kolFee"
              placeholder="0.00"
              data-testid="campaign-kol-add-fee"
              className="h-9 w-28 rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface focus:border-cyan focus:outline-none"
            />
          </label>

          {state.error ? (
            <p className="w-full text-xs text-error" data-testid="campaign-kol-add-error">
              {errorLabels[state.error] ?? errorLabels.generic}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-outline-variant px-4 py-1.5 text-xs text-on-surface-variant hover:border-cyan/40 hover:text-cyan"
            >
              {labels.close}
            </button>
            <AddSubmit submitLabel={labels.submit} disabled={selected == null} />
          </div>
        </form>
      </div>
    </div>
  );
}

function AddSubmit({
  submitLabel,
  disabled,
}: {
  submitLabel: string;
  disabled: boolean;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending || disabled}
      data-testid="campaign-kol-add-submit"
      className="gradient-cta rounded-lg px-4 py-1.5 text-xs font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {status.pending ? `${submitLabel}…` : submitLabel}
    </button>
  );
}
