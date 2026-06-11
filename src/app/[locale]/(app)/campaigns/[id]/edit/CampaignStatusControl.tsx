"use client";

/**
 * BL-105-F002 · Campaign status-transition control (client).
 *
 * Restores a UI for the orphaned `transitionStatusAction` (audit M1).
 * The allowed next-states are computed on the server (single source of
 * truth = isAllowedStatusTransition in update.ts) and passed in, so the
 * client never imports server-only lib code. draft→active, active→
 * completed, completed→active (reactivate, which unlocks the revenue
 * editor) are the only edges; the action re-validates them server-side.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

import { transitionStatusAction } from "../actions";

export interface CampaignStatusControlLabels {
  label: string;
  current: string;
  moveToTemplate: string; // "Move to {status}" — client-side .replace
  applying: string;
  updated: string;
  noTransitions: string;
  statusNames: Record<string, string>;
  errors: Record<string, string>;
}

interface Props {
  campaignId: string;
  current: string;
  allowedNext: string[];
  labels: CampaignStatusControlLabels;
}

export function CampaignStatusControl({ campaignId, current, allowedNext, labels }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleTransition = (formData: FormData) => {
    setUpdated(false);
    setError(null);
    startTransition(async () => {
      const result = await transitionStatusAction({ ok: false }, formData);
      if (result.ok) {
        setUpdated(true);
        router.refresh();
      } else {
        setError(result.error ?? "generic");
      }
    });
  };

  return (
    <section
      data-testid="campaign-status-control"
      className="glass-panel flex flex-col gap-3 rounded-2xl border border-on-surface/5 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            {labels.label}
          </span>
          <span className="text-sm text-on-surface" data-testid="campaign-status-current">
            {labels.current}: {labels.statusNames[current] ?? current}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {allowedNext.length === 0 ? (
            <span className="text-xs text-on-surface-variant" data-testid="campaign-status-none">
              {labels.noTransitions}
            </span>
          ) : (
            allowedNext.map((next) => (
              <form key={next} action={handleTransition}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="next" value={next} />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  data-testid={`campaign-status-to-${next}`}
                >
                  {pending
                    ? labels.applying
                    : labels.moveToTemplate.replace(
                        "{status}",
                        labels.statusNames[next] ?? next,
                      )}
                </Button>
              </form>
            ))
          )}
        </div>
      </div>

      {error ? (
        <p
          data-testid="campaign-status-error"
          role="alert"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
        >
          {labels.errors[error] ?? labels.errors.generic}
        </p>
      ) : null}

      {updated && !error ? (
        <p
          data-testid="campaign-status-updated"
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          {labels.updated}
        </p>
      ) : null}
    </section>
  );
}
