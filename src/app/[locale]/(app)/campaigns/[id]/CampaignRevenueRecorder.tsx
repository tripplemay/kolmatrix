"use client";

/* @deprecated_by_BL-066: /campaigns/[id]/page.tsx unmount 后 0 引用; BL-070 删除 */
/**
 * BM2-F005 · Revenue recorder (Section 3 left panel).
 *
 * Editable while status != completed. Status=completed locks edits;
 * the StatusController's Reactivate button flips back to active and
 * re-enables this panel.
 */
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { recordRevenueAction, type ActionState } from "./actions";

interface Props {
  campaignId: string;
  status: string;
  revenue: number | null;
  spendTotal: number;
  roiPercent: number | null;
  labels: {
    title: string;
    lockedBody: string;
    placeholder: string;
    save: string;
    saving: string;
    clear: string;
    helper: string;
  };
  errorLabels: Record<string, string>;
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function SaveButton({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      data-testid="campaign-revenue-save"
      className="gradient-cta rounded-lg px-4 py-1.5 text-xs font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-70"
    >
      {status.pending ? pending : idle}
    </button>
  );
}

export function CampaignRevenueRecorder({
  campaignId,
  status,
  revenue,
  spendTotal,
  roiPercent,
  labels,
  errorLabels,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    recordRevenueAction,
    { ok: false }
  );
  const locked = status === "completed";

  // Clear error message when a new save succeeds.
  useEffect(() => {
    // No-op placeholder; useActionState auto-supersedes state on next
    // form submit, but keeping the hook slot here documents the
    // intention if we later want toasts.
  }, [state.ok]);

  return (
    <section
      className="glass-panel flex flex-col gap-4 rounded-2xl border border-on-surface/5 p-6"
      data-testid="campaign-revenue-panel"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        {locked ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-high/40 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant"
            data-testid="campaign-revenue-locked"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden>
              lock
            </span>
            Completed
          </span>
        ) : null}
      </header>

      <p className="text-sm text-on-surface-variant">
        {locked ? labels.lockedBody : labels.helper}
      </p>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="mb-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Spend
          </dt>
          <dd className="text-lg font-bold tabular-nums text-cyan">
            {formatCurrency(spendTotal)}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            ROI
          </dt>
          <dd
            className={`text-lg font-bold tabular-nums ${
              roiPercent == null
                ? "text-on-surface-variant"
                : roiPercent >= 0
                  ? "text-emerald-400"
                  : "text-error"
            }`}
          >
            {roiPercent == null
              ? "—"
              : `${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(1)}%`}
          </dd>
        </div>
      </dl>

      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3"
        data-testid="campaign-revenue-form"
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Revenue (USD)
          </span>
          <input
            type="text"
            name="revenue"
            inputMode="decimal"
            defaultValue={revenue == null ? "" : String(revenue)}
            placeholder={labels.placeholder}
            disabled={locked}
            data-testid="campaign-revenue-input"
            className="h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        {!locked ? (
          <SaveButton idle={labels.save} pending={labels.saving} />
        ) : null}
      </form>

      {state.error ? (
        <p
          data-testid="campaign-revenue-error"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
        >
          {errorLabels[state.error] ?? errorLabels.generic}
        </p>
      ) : null}
    </section>
  );
}
