/**
 * BM2-F009 · 4-card KPI strip (Planner adjudication §13 #B/#C/#D).
 *
 *   1. Total Spend   — big number + 30D sparkline
 *   2. Total Revenue — big number + 30D sparkline
 *   3. Average ROI   — big number + dynamic velocity subtitle
 *                      (>200 High / 50–200 Steady / <50 Cooling / null —)
 *   4. Top Campaign ROI — name + roi% (replaces Stitch "Active
 *                         Campaigns" per #B:A — spec wins, "哪个最赚"
 *                         is the marketer's first question)
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Sparkline } from "@/components/common/Sparkline";

import type { RoiSummary, RoiTrendPoint } from "@/lib/roi/compute";

interface Props {
  locale: string;
  summary: RoiSummary;
  trend: RoiTrendPoint[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function velocityKey(
  roi: number | null
): "high" | "steady" | "cooling" | "na" {
  if (roi == null) return "na";
  if (roi > 200) return "high";
  if (roi >= 50) return "steady";
  return "cooling";
}

export async function RoiKpiStrip({ locale, summary, trend }: Props) {
  const t = await getTranslations("roi.kpi");

  const spendSeries = trend.map((p) => p.spendTotal);
  const revenueSeries = trend.map((p) => p.revenue);

  const avgRoiLabel =
    summary.avgRoiPercent == null
      ? "—"
      : `${summary.avgRoiPercent.toFixed(1)}%`;
  const velocity = velocityKey(summary.avgRoiPercent);
  const top = summary.topCampaign;

  return (
    <section
      data-testid="roi-kpi-strip"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCard
        label={t("totalSpend")}
        value={formatCurrency(summary.totalSpend)}
        icon="account_balance_wallet"
        testId="roi-kpi-total-spend"
        bottomSlot={
          <Sparkline
            data={spendSeries}
            width={120}
            height={32}
            label={t("totalSpend")}
            className="text-on-surface-variant/60"
          />
        }
      />
      <KpiCard
        label={t("totalRevenue")}
        value={formatCurrency(summary.totalRevenue)}
        icon="trending_up"
        testId="roi-kpi-total-revenue"
        bottomSlot={
          <Sparkline
            data={revenueSeries}
            width={120}
            height={32}
            label={t("totalRevenue")}
            className="text-cyan/80"
          />
        }
      />
      <KpiCard
        label={t("avgRoi")}
        value={avgRoiLabel}
        icon="bolt"
        testId="roi-kpi-avg-roi"
        subLabel={t(`velocity.${velocity}` as Parameters<typeof t>[0])}
        highlight
      />
      <KpiCard
        label={t("topCampaign")}
        value={top ? `${top.roiPercent.toFixed(1)}%` : "—"}
        icon="emoji_events"
        testId="roi-kpi-top-campaign"
        subLabel={top?.name ?? t("topCampaignEmpty")}
        link={top ? `/${locale}/campaigns/${top.id}` : undefined}
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
  bottomSlot?: React.ReactNode;
  highlight?: boolean;
  link?: string;
}

function KpiCard({
  label,
  value,
  icon,
  testId,
  subLabel,
  bottomSlot,
  highlight,
  link,
}: KpiCardProps) {
  const surface = highlight
    ? "bg-gradient-to-br from-cyan/15 to-cyan/5"
    : "bg-surface-low/60";

  const inner = (
    <article
      data-testid={testId}
      className={`relative flex h-[140px] flex-col justify-between overflow-hidden rounded-2xl border border-white/5 p-5 ${surface}`}
    >
      <header className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan">
          {label}
        </p>
        <span
          aria-hidden
          className="material-symbols-outlined text-[20px] text-cyan/60"
        >
          {icon}
        </span>
      </header>
      <div>
        <p className="text-3xl font-extrabold tabular-nums text-white">
          {value}
        </p>
        {subLabel ? (
          <p className="mt-1 truncate text-[11px] text-on-surface-variant/80">
            {subLabel}
          </p>
        ) : null}
      </div>
      {bottomSlot ? (
        <div className="absolute bottom-3 right-4 opacity-80">
          {bottomSlot}
        </div>
      ) : null}
    </article>
  );

  if (link) {
    return (
      <Link
        href={link}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
