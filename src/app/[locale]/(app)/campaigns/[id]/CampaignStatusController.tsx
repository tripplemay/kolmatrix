"use client";

/**
 * BM2-F005 · Status controller (Section 3 right panel).
 *
 * Exposes the allowed forward transitions for the current status as
 * submit buttons; the Reactivate button is shown when status=completed
 * so the marketer can unlock the revenue recorder.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { transitionStatusAction, type ActionState } from "./actions";

type CampaignStatus = "draft" | "active" | "completed";

interface Props {
  campaignId: string;
  status: string;
  startedAt: string | null;
  closedAt: string | null;
  labels: {
    title: string;
    transitionTo: (next: string) => string;
    reactivate: string;
    currentLabel: string;
    startedAtLabel: string;
    closedAtLabel: string;
  };
  statusLabels: Record<CampaignStatus, string>;
  errorLabels: Record<string, string>;
}

const ALLOWED_NEXT: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: ["active"],
};

function SubmitTransition({
  label,
  variant,
  testId,
}: {
  label: string;
  variant: "primary" | "secondary";
  testId: string;
}) {
  const status = useFormStatus();
  const baseCls =
    variant === "primary"
      ? "gradient-cta text-on-primary"
      : "border border-cyan/40 text-cyan hover:bg-cyan/10";
  return (
    <button
      type="submit"
      disabled={status.pending}
      data-testid={testId}
      className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${baseCls}`}
    >
      {status.pending ? `${label}…` : label}
    </button>
  );
}

export function CampaignStatusController({
  campaignId,
  status,
  startedAt,
  closedAt,
  labels,
  statusLabels,
  errorLabels,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    transitionStatusAction,
    { ok: false }
  );

  const currentStatus: CampaignStatus =
    status === "draft" || status === "active" || status === "completed"
      ? status
      : "draft";
  const nextOptions = ALLOWED_NEXT[currentStatus];

  return (
    <section
      className="glass-panel flex flex-col gap-4 rounded-2xl border border-on-surface/5 p-6"
      data-testid="campaign-status-panel"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
            currentStatus === "active"
              ? "border-cyan/30 bg-cyan/10 text-cyan"
              : currentStatus === "completed"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-outline-variant bg-surface-high/40 text-on-surface-variant"
          }`}
        >
          {statusLabels[currentStatus]}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="mb-1 font-bold uppercase tracking-widest text-on-surface-variant">
            {labels.startedAtLabel}
          </dt>
          <dd className="text-on-surface">
            {startedAt ? new Date(startedAt).toLocaleDateString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="mb-1 font-bold uppercase tracking-widest text-on-surface-variant">
            {labels.closedAtLabel}
          </dt>
          <dd className="text-on-surface">
            {closedAt ? new Date(closedAt).toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {nextOptions.map((next) => {
          const isReactivate =
            currentStatus === "completed" && next === "active";
          const label = isReactivate
            ? labels.reactivate
            : labels.transitionTo(next);
          return (
            <form key={next} action={formAction} className="inline-flex">
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="next" value={next} />
              <SubmitTransition
                label={label}
                variant={isReactivate ? "secondary" : "primary"}
                testId={`campaign-status-transition-${next}`}
              />
            </form>
          );
        })}
      </div>

      {state.error ? (
        <p
          data-testid="campaign-status-error"
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
        >
          {errorLabels[state.error] ?? errorLabels.generic}
        </p>
      ) : null}
    </section>
  );
}
