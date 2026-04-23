"use client";

/**
 * BM2-F004 · Client-side form for /campaigns/new.
 *
 * State via React 19's useActionState — per-field errors come back
 * from the Server Action as i18n keys; this component maps them to
 * the localized strings handed down by the RSC parent. Submit button
 * uses useFormStatus for the "pending" label.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

import { createCampaign } from "./actions";
import { CAMPAIGN_MARKETS, type CampaignMarket } from "@/lib/campaigns/schema";
import type {
  CreateCampaignFormErrors,
  CreateCampaignState,
} from "@/lib/campaigns/schema";

interface ProductOption {
  id: string;
  name: string;
  category: string;
}

interface Props {
  products: ProductOption[];
  labels: {
    name: string;
    nameHint: string;
    product: string;
    budget: string;
    budgetHint: string;
    startDate: string;
    endDate: string;
    game: string;
    gameHint: string;
    markets: string;
    kpiTarget: string;
    kpiTargetHint: string;
    submit: string;
    submitting: string;
  };
  marketLabels: Record<CampaignMarket, string>;
  errorLabels: Record<string, string>;
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-slate-600 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

const initialState: CreateCampaignState = { ok: false };

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
    >
      {children}
      {required ? <span className="ml-1 text-cyan">*</span> : null}
    </label>
  );
}

function FieldError({
  errors,
  field,
  labels,
}: {
  errors?: CreateCampaignFormErrors;
  field: keyof CreateCampaignFormErrors;
  labels: Record<string, string>;
}) {
  const code = errors?.[field];
  if (!code) return null;
  const msg = labels[code] ?? labels.generic;
  return (
    <p
      className="mt-1 text-xs font-medium text-error"
      data-testid={`campaign-new-error-${field}`}
    >
      {msg}
    </p>
  );
}

function SubmitButton({
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
      data-testid="campaign-new-submit"
      className={cn(
        "gradient-cta flex h-11 items-center justify-center rounded-lg px-6 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-transform hover:scale-[1.02]",
        status.pending && "cursor-not-allowed opacity-70"
      )}
    >
      {status.pending ? pending : idle}
    </button>
  );
}

export function CampaignForm({
  products,
  labels,
  marketLabels,
  errorLabels,
}: Props) {
  const [state, formAction] = useActionState(createCampaign, initialState);

  return (
    <form
      action={formAction}
      className="glass-panel space-y-5 rounded-2xl border border-on-surface/5 p-6"
      data-testid="campaign-new-form"
      noValidate
    >
      <div>
        <Label htmlFor="campaign-name" required>
          {labels.name}
        </Label>
        <input
          id="campaign-name"
          name="name"
          type="text"
          maxLength={80}
          required
          data-testid="campaign-new-name"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          {labels.nameHint}
        </p>
        <FieldError errors={state.errors} field="name" labels={errorLabels} />
      </div>

      <div>
        <Label htmlFor="campaign-product" required>
          {labels.product}
        </Label>
        <select
          id="campaign-product"
          name="productId"
          required
          defaultValue=""
          data-testid="campaign-new-product"
          className={INPUT_CLASS}
        >
          <option value="" disabled>
            —
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.category}
            </option>
          ))}
        </select>
        <FieldError
          errors={state.errors}
          field="productId"
          labels={errorLabels}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="campaign-budget">{labels.budget}</Label>
          <input
            id="campaign-budget"
            name="budgetAmount"
            type="text"
            inputMode="decimal"
            placeholder="10000.00"
            data-testid="campaign-new-budget"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-[11px] text-on-surface-variant/70">
            {labels.budgetHint}
          </p>
          <FieldError
            errors={state.errors}
            field="budgetAmount"
            labels={errorLabels}
          />
        </div>
        <div>
          <Label htmlFor="campaign-game">{labels.game}</Label>
          <input
            id="campaign-game"
            name="game"
            type="text"
            maxLength={80}
            data-testid="campaign-new-game"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-[11px] text-on-surface-variant/70">
            {labels.gameHint}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="campaign-start-date">{labels.startDate}</Label>
          <input
            id="campaign-start-date"
            name="startDate"
            type="date"
            data-testid="campaign-new-start-date"
            className={INPUT_CLASS}
          />
          <FieldError
            errors={state.errors}
            field="startDate"
            labels={errorLabels}
          />
        </div>
        <div>
          <Label htmlFor="campaign-end-date">{labels.endDate}</Label>
          <input
            id="campaign-end-date"
            name="endDate"
            type="date"
            data-testid="campaign-new-end-date"
            className={INPUT_CLASS}
          />
          <FieldError
            errors={state.errors}
            field="endDate"
            labels={errorLabels}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="campaign-markets">{labels.markets}</Label>
        <div
          id="campaign-markets"
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
          data-testid="campaign-new-markets"
        >
          {CAMPAIGN_MARKETS.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface/30 px-3 py-2 text-sm text-on-surface transition-colors hover:border-cyan/40"
            >
              <input
                type="checkbox"
                name="markets"
                value={m}
                className="h-4 w-4 accent-cyan"
              />
              <span>{marketLabels[m]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="campaign-kpi">{labels.kpiTarget}</Label>
        <textarea
          id="campaign-kpi"
          name="kpiTarget"
          rows={3}
          maxLength={2000}
          data-testid="campaign-new-kpi"
          className={`${INPUT_CLASS} h-auto min-h-[84px] py-2 leading-5`}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          {labels.kpiTargetHint}
        </p>
      </div>

      {state.errors?.form ? (
        <p
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
          data-testid="campaign-new-error-form"
        >
          {errorLabels[state.errors.form] ?? errorLabels.generic}
        </p>
      ) : null}

      <div className="flex justify-end pt-2">
        <SubmitButton idle={labels.submit} pending={labels.submitting} />
      </div>
    </form>
  );
}
