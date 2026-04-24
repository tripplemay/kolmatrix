/**
 * BM2-F007 · KPI strip — 4 cards, the last (Avg ROI) intentionally
 * shows "—" until F008 ROI engine ships (Planner adjudication §13 #E).
 */
import { getTranslations } from "next-intl/server";

import { RingProgress } from "@/components/common/RingProgress";
import { Sparkline } from "@/components/common/Sparkline";

import type { CrmKpi } from "@/lib/crm/overview";

interface Props {
  kpi: CrmKpi;
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function CrmKpiStrip({ kpi }: Props) {
  const t = await getTranslations("crm.kpi");

  return (
    <section
      data-testid="crm-kpi-strip"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCard
        label={t("totalPipeline")}
        value={formatInt(kpi.totalPipeline)}
        icon="data_exploration"
        testId="crm-kpi-pipeline"
      />
      <KpiCard
        label={t("longTerm")}
        value={formatInt(kpi.longTermPartners)}
        icon="verified"
        testId="crm-kpi-long-term"
        rightSlot={
          <RingProgress
            value={kpi.longTermRatio}
            size={56}
            strokeWidth={5}
            label={`${(kpi.longTermRatio * 100).toFixed(1)}%`}
          />
        }
      />
      <KpiCard
        label={t("cumulativeSpend")}
        value={formatCurrency(kpi.cumulativeSpend)}
        icon="payments"
        testId="crm-kpi-spend"
        subLabel={t("spendCaption")}
        bottomSlot={
          <Sparkline
            data={kpi.spendSparkline}
            width={120}
            height={32}
            label={t("spendCaption")}
            className="text-cyan/80"
          />
        }
      />
      <KpiCard
        label={t("avgRoi")}
        value="—"
        icon="trending_up"
        testId="crm-kpi-roi"
        subLabel={t("avgRoiPlaceholder")}
        muted
      />
    </section>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  testId: string;
  subLabel?: string;
  rightSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  muted?: boolean;
}

function KpiCard({
  label,
  value,
  icon,
  testId,
  subLabel,
  rightSlot,
  bottomSlot,
  muted,
}: KpiCardProps) {
  return (
    <article
      data-testid={testId}
      className="relative flex h-[140px] flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-surface-low/60 p-5"
    >
      <header className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan">
          {label}
        </p>
        <span
          aria-hidden
          className="material-symbols-outlined text-[20px] text-cyan/40"
        >
          {icon}
        </span>
      </header>
      <div className="flex items-end justify-between gap-3">
        <p
          className={
            "text-3xl font-extrabold tabular-nums " +
            (muted ? "text-on-surface-variant" : "text-white")
          }
        >
          {value}
        </p>
        {rightSlot}
      </div>
      {bottomSlot ? (
        <div className="absolute bottom-3 right-4 opacity-70">
          {bottomSlot}
        </div>
      ) : null}
      {subLabel ? (
        <p className="text-[11px] text-on-surface-variant/70">{subLabel}</p>
      ) : null}
    </article>
  );
}
