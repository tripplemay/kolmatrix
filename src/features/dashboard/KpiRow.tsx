/**
 * KpiRow — Dashboard 区块 2（4 卡：Total KOLs / Active Campaigns / Emails Sent / AI Match）
 *
 * 决议 #6：第 4 卡 AI Match 是 AiMatchRingCard 特例（不复用 StatCard）。
 * trend 数据按 §11.4 G3:A mock 固定值（历史表是 B3+ 的事）。
 */
"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/components/common";

import { AiMatchRingCard } from "./AiMatchRingCard";

interface Props {
  kolCount: number;
  activeCampaigns: number;
  emailsSent7d: number;
  avgAiScore: number;
}

export function KpiRow({ kolCount, activeCampaigns, emailsSent7d, avgAiScore }: Props) {
  const t = useTranslations("dashboard.kpi");
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t("totalKols")}
        value={kolCount.toLocaleString()}
        trend={{ direction: "up", percent: 12 }}
        icon="groups"
        sparkline={[40, 60, 80, 100]}
      />
      <StatCard
        label={t("activeCampaigns")}
        value={activeCampaigns}
        trend={{ direction: "flat", percent: 0, accent: "purple" }}
        icon="campaign"
        sparkline={[70, 70, 70, 70]}
      />
      <StatCard
        label={t("emailsSent")}
        value={emailsSent7d.toLocaleString()}
        trend={{ direction: "up", percent: 5.2 }}
        icon="mail"
        sparkline={[50, 62, 78, 92]}
      />
      <AiMatchRingCard score={Math.round(avgAiScore)} label={t("avgAiMatch")} />
    </section>
  );
}
