"use client";

/**
 * BL-105-F001 · Campaign field-edit form (client).
 *
 * Restores a UI surface for the long-orphaned `updateCampaignFieldsAction`
 * (audit M1). Lives on the dedicated /edit page rather than the detail
 * page so the detail view keeps its AI-native read-only shape (ADR-013).
 *
 * Fields mirror exactly what the action accepts (name / budgetAmount /
 * startDate / endDate / game — see actions.ts + update.ts); we do not
 * change the action contract. Uses an uncontrolled form + useTransition
 * (same pattern as the retired CampaignHeader) so "show saved banner on
 * success" stays a plain async handler, not a useActionState effect.
 */
import { useState, useTransition } from "react";

import { Button, Input } from "@/components/ui";

import { updateCampaignFieldsAction } from "../actions";

export interface CampaignEditFormLabels {
  fields: {
    name: string;
    budgetAmount: string;
    startDate: string;
    endDate: string;
    game: string;
  };
  save: string;
  saving: string;
  saved: string;
  errors: Record<string, string>;
}

interface Props {
  campaign: {
    id: string;
    name: string;
    budgetAmount: number | null;
    startDate: string | null;
    endDate: string | null;
    game: string | null;
  };
  labels: CampaignEditFormLabels;
}

export function CampaignEditForm({ campaign, labels }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateCampaignFieldsAction({ ok: false }, formData);
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error ?? "generic");
      }
    });
  };

  return (
    <form
      action={handleSubmit}
      data-testid="campaign-edit-form"
      className="glass-panel grid gap-4 rounded-2xl border border-on-surface/5 p-6 md:grid-cols-2"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <Labeled label={labels.fields.name}>
        <Input
          type="text"
          name="name"
          defaultValue={campaign.name}
          maxLength={80}
          data-testid="campaign-edit-name"
        />
      </Labeled>

      <Labeled label={labels.fields.budgetAmount}>
        <Input
          type="text"
          inputMode="decimal"
          name="budgetAmount"
          defaultValue={campaign.budgetAmount == null ? "" : String(campaign.budgetAmount)}
          placeholder="10000.00"
          data-testid="campaign-edit-budget"
        />
      </Labeled>

      <Labeled label={labels.fields.startDate}>
        <Input
          type="date"
          name="startDate"
          defaultValue={campaign.startDate ? campaign.startDate.slice(0, 10) : ""}
          data-testid="campaign-edit-start-date"
        />
      </Labeled>

      <Labeled label={labels.fields.endDate}>
        <Input
          type="date"
          name="endDate"
          defaultValue={campaign.endDate ? campaign.endDate.slice(0, 10) : ""}
          data-testid="campaign-edit-end-date"
        />
      </Labeled>

      <Labeled label={labels.fields.game} className="md:col-span-2">
        <Input
          type="text"
          name="game"
          defaultValue={campaign.game ?? ""}
          maxLength={80}
          data-testid="campaign-edit-game"
        />
      </Labeled>

      {error ? (
        <p
          data-testid="campaign-edit-error"
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error md:col-span-2"
        >
          {labels.errors[error] ?? labels.errors.generic}
        </p>
      ) : null}

      {saved && !error ? (
        <p
          data-testid="campaign-edit-saved"
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 md:col-span-2"
        >
          {labels.saved}
        </p>
      ) : null}

      <div className="flex justify-end md:col-span-2">
        <Button
          type="submit"
          variant="primary-gradient"
          size="sm"
          disabled={pending}
          data-testid="campaign-edit-save"
        >
          {pending ? labels.saving : labels.save}
        </Button>
      </div>
    </form>
  );
}

function Labeled({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
