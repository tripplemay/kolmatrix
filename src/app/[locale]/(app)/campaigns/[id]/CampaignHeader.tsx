"use client";

/**
 * BM2-F005 · Header section — title, status badge, product link, owner,
 * 4 KPIs + inline edit form toggle.
 */
import { useState, useTransition } from "react";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

import { updateCampaignFieldsAction } from "./actions";

interface Labels {
  statusBadge: string;
  edit: string;
  save: string;
  cancel: string;
  kpi: { budget: string; spend: string; revenue: string; roi: string };
  fields: {
    name: string;
    budget: string;
    startDate: string;
    endDate: string;
    game: string;
  };
  errors: Record<string, string>;
  unsetValue: string;
}

interface Props {
  campaign: {
    id: string;
    name: string;
    status: string;
    game: string | null;
    budgetAmount: number | null;
    spendTotal: number;
    revenueRecorded: number | null;
    roiPercent: number | null;
    startDate: string | null;
    endDate: string | null;
    product: { id: string; name: string; category: string } | null;
    ownerName: string | null;
    locale: string;
  };
  labels: Labels;
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function statusBadgeClasses(status: string): string {
  if (status === "active")
    return "border-cyan/30 bg-cyan/10 text-cyan";
  if (status === "completed")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-outline-variant bg-surface-high/40 text-on-surface-variant";
}

export function CampaignHeader({ campaign, labels }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Direct async handler via useTransition avoids the setState-inside-
  // useEffect anti-pattern that useActionState forces for "close form
  // on success" workflows.
  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateCampaignFieldsAction({ ok: false }, formData);
      if (result.ok) {
        setError(null);
        setEditing(false);
      } else {
        setError(result.error ?? "generic");
      }
    });
  };

  return (
    <section className="glass-panel rounded-2xl border border-on-surface/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1
            data-testid="campaign-detail-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            {campaign.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusBadgeClasses(
                campaign.status
              )}`}
              data-testid="campaign-detail-status"
              data-status={campaign.status}
            >
              {labels.statusBadge}
            </span>
            {campaign.product ? (
              <a
                href={`/${campaign.locale}/knowledge-base#product-${campaign.product.id}`}
                className="inline-flex items-center gap-1 text-on-surface transition-colors hover:text-cyan"
                data-testid="campaign-product-link"
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  aria-hidden
                >
                  inventory_2
                </span>
                {campaign.product.name} · {campaign.product.category}
              </a>
            ) : null}
            {campaign.game ? <span>🎮 {campaign.game}</span> : null}
            {campaign.ownerName ? (
              <span>by {campaign.ownerName}</span>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing((v) => !v)}
          data-testid="campaign-header-edit-toggle"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            aria-hidden
          >
            {editing ? "close" : "edit"}
          </span>
          {editing ? labels.cancel : labels.edit}
        </Button>
      </div>

      {editing ? (
        <form
          action={handleSubmit}
          data-testid="campaign-header-edit-form"
          className="mt-6 grid gap-4 rounded-xl border border-outline-variant/60 bg-surface/30 p-4 md:grid-cols-2"
        >
          <input type="hidden" name="campaignId" value={campaign.id} />
          <Labeled label={labels.fields.name}>
            <Input
              type="text"
              name="name"
              defaultValue={campaign.name}
              maxLength={80}
              data-testid="campaign-header-name-input"
            />
          </Labeled>
          <Labeled label={labels.fields.budget}>
            <Input
              type="text"
              inputMode="decimal"
              name="budgetAmount"
              defaultValue={
                campaign.budgetAmount == null
                  ? ""
                  : String(campaign.budgetAmount)
              }
              placeholder="10000.00"
              data-testid="campaign-header-budget-input"
            />
          </Labeled>
          <Labeled label={labels.fields.startDate}>
            <Input
              type="date"
              name="startDate"
              defaultValue={
                campaign.startDate
                  ? campaign.startDate.slice(0, 10)
                  : ""
              }
            />
          </Labeled>
          <Labeled label={labels.fields.endDate}>
            <Input
              type="date"
              name="endDate"
              defaultValue={
                campaign.endDate ? campaign.endDate.slice(0, 10) : ""
              }
            />
          </Labeled>
          <Labeled label={labels.fields.game} className="md:col-span-2">
            <Input
              type="text"
              name="game"
              defaultValue={campaign.game ?? ""}
              maxLength={80}
            />
          </Labeled>

          {error ? (
            <p
              data-testid="campaign-header-error"
              className="md:col-span-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
            >
              {labels.errors[error] ?? labels.errors.generic}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              {labels.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary-gradient"
              size="sm"
              disabled={pending}
              data-testid="campaign-header-save"
            >
              {pending ? `${labels.save}…` : labels.save}
            </Button>
          </div>
        </form>
      ) : null}

      <div
        className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        data-testid="campaign-detail-kpi-row"
      >
        <Kpi
          label={labels.kpi.budget}
          value={formatCurrency(campaign.budgetAmount)}
          placeholder={labels.unsetValue}
          unset={campaign.budgetAmount == null}
        />
        <Kpi
          label={labels.kpi.spend}
          value={formatCurrency(campaign.spendTotal)}
          tone="info"
          testId="campaign-kpi-spend"
        />
        <Kpi
          label={labels.kpi.revenue}
          value={formatCurrency(campaign.revenueRecorded)}
          placeholder={labels.unsetValue}
          unset={campaign.revenueRecorded == null}
        />
        <Kpi
          label={labels.kpi.roi}
          value={
            campaign.roiPercent == null
              ? "—"
              : `${campaign.roiPercent >= 0 ? "+" : ""}${campaign.roiPercent.toFixed(1)}%`
          }
          tone={
            campaign.roiPercent == null
              ? "muted"
              : campaign.roiPercent >= 0
                ? "positive"
                : "negative"
          }
          testId="campaign-kpi-roi"
        />
      </div>
    </section>
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

function Kpi({
  label,
  value,
  placeholder,
  unset,
  tone,
  testId,
}: {
  label: string;
  value: string;
  placeholder?: string;
  unset?: boolean;
  tone?: "info" | "positive" | "negative" | "muted";
  testId?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-error"
        : tone === "info"
          ? "text-cyan"
          : "text-white";
  return (
    <div
      className="rounded-xl border border-outline-variant/40 bg-surface/30 p-4"
      data-testid={testId}
    >
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-extrabold tabular-nums",
          unset ? "text-on-surface-variant" : toneClass
        )}
      >
        {unset && placeholder ? placeholder : value}
      </p>
    </div>
  );
}
