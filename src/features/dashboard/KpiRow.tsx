/**
 * KpiRow — Dashboard KPI 区块（5 卡片，BL-052 F004 真趋势化）
 *
 * 4 trend cards + 1 ring card. Trends/sparklines come from
 * loadKpiTrends (see src/lib/dashboard/kpi-trends.ts) — no hardcoded
 * mocks. Each StatCard receives a KpiTrend; if hasEnoughData=false the
 * chip falls back to "—" + tooltip per D4 (data accumulating).
 *
 * The 5th tile (Avg Value Score) re-uses AiMatchRingCard — same 0–100
 * ring UI and no trend (the value is meaningful at any point in time;
 * spec §1.3 keeps this card untouched).
 */
"use client";

import { useTranslations } from "next-intl";

import { StatCard, type StatCardTrend } from "@/components/common";
import type { KpiTrend } from "@/lib/dashboard/kpi-trends";

import { AiMatchRingCard } from "./AiMatchRingCard";

interface Props {
  kolCount: number;
  activeCampaigns: number;
  emailsSent7d: number;
  productCount: number;
  avgValueScore: number;
  trends: {
    kolCount: KpiTrend;
    activeCampaigns: KpiTrend;
    emailsSent7d: KpiTrend;
    productCount: KpiTrend;
  };
}

function pendingValue(count: number): string | number {
  return count === 0 ? "—" : count.toLocaleString();
}

function trendToProp(trend: KpiTrend, fallbackTooltip: string): StatCardTrend {
  if (!trend.hasEnoughData) {
    return { direction: "flat", percent: 0, tooltip: fallbackTooltip };
  }
  return { direction: trend.direction, percent: trend.percent };
}

export function KpiRow({
  kolCount,
  activeCampaigns,
  emailsSent7d,
  productCount,
  avgValueScore,
  trends,
}: Props) {
  const t = useTranslations("dashboard.kpi");
  const tooltip = t("trendAccumulating");

  return (
    <section
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5"
      data-testid="dashboard-kpi-row"
    >
      <StatCard
        label={t("totalKols")}
        value={kolCount.toLocaleString()}
        trend={trendToProp(trends.kolCount, tooltip)}
        icon="groups"
        sparkline={trends.kolCount.sparkline}
      />
      <StatCard
        label={t("activeCampaigns")}
        value={pendingValue(activeCampaigns)}
        trend={trendToProp(trends.activeCampaigns, tooltip)}
        icon="campaign"
        sparkline={trends.activeCampaigns.sparkline}
      />
      <StatCard
        label={t("emailsSent")}
        value={pendingValue(emailsSent7d)}
        trend={trendToProp(trends.emailsSent7d, tooltip)}
        icon="mail"
        sparkline={trends.emailsSent7d.sparkline}
      />
      <StatCard
        label={t("totalProducts")}
        value={productCount.toLocaleString()}
        trend={trendToProp(trends.productCount, tooltip)}
        icon="inventory_2"
        sparkline={trends.productCount.sparkline}
      />
      <AiMatchRingCard score={avgValueScore} label={t("avgValueScore")} />
    </section>
  );
}
