/**
 * KpiRow — Dashboard KPI 区块（BM1-F007 扩展为 5 卡）
 *
 * 5 tiles per spec §F007:
 *   1. Total KOLs (gaming-only count)
 *   2. Active Campaigns (BM1 → 0 / "—" until BM2 ships campaigns)
 *   3. Emails Sent (BM1 → 0 / "—" until BM2 outreach)
 *   4. Products (knowledge-base count)
 *   5. Avg Value Score (AiMatchRingCard re-used — same 0-100 ring UI)
 *
 * The trend sparklines remain mock (§11.4 G3:A — historical tables land
 * with B3); the number itself is real.
 */
"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/components/common";

import { AiMatchRingCard } from "./AiMatchRingCard";

interface Props {
  kolCount: number;
  activeCampaigns: number;
  emailsSent7d: number;
  productCount: number;
  avgValueScore: number;
}

function pendingValue(count: number): string | number {
  return count === 0 ? "—" : count.toLocaleString();
}

export function KpiRow({
  kolCount,
  activeCampaigns,
  emailsSent7d,
  productCount,
  avgValueScore,
}: Props) {
  const t = useTranslations("dashboard.kpi");
  return (
    <section
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5"
      data-testid="dashboard-kpi-row"
    >
      <StatCard
        label={t("totalKols")}
        value={kolCount.toLocaleString()}
        trend={{ direction: "up", percent: 12 }}
        icon="groups"
        sparkline={[40, 60, 80, 100]}
      />
      <StatCard
        label={t("activeCampaigns")}
        value={pendingValue(activeCampaigns)}
        trend={{ direction: "flat", percent: 0, accent: "purple" }}
        icon="campaign"
        sparkline={[70, 70, 70, 70]}
      />
      <StatCard
        label={t("emailsSent")}
        value={pendingValue(emailsSent7d)}
        trend={{ direction: "up", percent: 5.2 }}
        icon="mail"
        sparkline={[50, 62, 78, 92]}
      />
      <StatCard
        label={t("totalProducts")}
        value={productCount.toLocaleString()}
        trend={{ direction: "flat", percent: 0, accent: "warning" }}
        icon="inventory_2"
        sparkline={[30, 40, 55, 70]}
      />
      <AiMatchRingCard score={avgValueScore} label={t("avgValueScore")} />
    </section>
  );
}
