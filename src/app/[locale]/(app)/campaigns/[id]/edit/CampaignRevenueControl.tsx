"use client";

/**
 * BL-105-F002 · Campaign revenue recorder (client).
 *
 * Restores a UI for the orphaned `recordRevenueAction` (audit M1).
 * recordCampaignRevenue locks writes while status === "completed"
 * (reactivate first), so the control disables itself + shows a hint in
 * that state and never even submits. Recorded revenue feeds the ROI
 * page; the action revalidates the detail + list pages on success.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, Input } from "@/components/ui";

import { recordRevenueAction } from "../actions";

export interface CampaignRevenueControlLabels {
  label: string;
  hint: string;
  lockedHint: string;
  save: string;
  saving: string;
  saved: string;
  errors: Record<string, string>;
}

interface Props {
  campaignId: string;
  currentRevenue: number | null;
  /** status === "completed" — revenue is locked until reactivated. */
  locked: boolean;
  labels: CampaignRevenueControlLabels;
}

export function CampaignRevenueControl({
  campaignId,
  currentRevenue,
  locked,
  labels,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await recordRevenueAction({ ok: false }, formData);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "generic");
      }
    });
  };

  return (
    <form
      action={handleSubmit}
      data-testid="campaign-revenue-control"
      className="glass-panel flex flex-col gap-3 rounded-2xl border border-on-surface/5 p-6"
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {labels.label}
        </span>
        <Input
          type="text"
          inputMode="decimal"
          name="revenue"
          defaultValue={currentRevenue == null ? "" : String(currentRevenue)}
          placeholder="0.00"
          disabled={locked}
          data-testid="campaign-revenue-input"
        />
      </label>

      <p className="text-[11px] text-on-surface-variant/70" data-testid="campaign-revenue-hint">
        {locked ? labels.lockedHint : labels.hint}
      </p>

      {error ? (
        <p
          data-testid="campaign-revenue-error"
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
        >
          {labels.errors[error] ?? labels.errors.generic}
        </p>
      ) : null}

      {saved && !error ? (
        <p
          data-testid="campaign-revenue-saved"
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          {labels.saved}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary-gradient"
          size="sm"
          disabled={pending || locked}
          data-testid="campaign-revenue-save"
        >
          {pending ? labels.saving : labels.save}
        </Button>
      </div>
    </form>
  );
}
