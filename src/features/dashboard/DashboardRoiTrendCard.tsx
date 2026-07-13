"use client";

import { useTranslations } from "next-intl";

import type { RoiTrendPoint } from "@/lib/roi/compute";

import { GlassPanel, SectionHeader } from "@/components/common";
import { RoiTrendChart } from "@/app/[locale]/(app)/roi/RoiTrendChart";

interface Props {
  trend: RoiTrendPoint[];
}

export function DashboardRoiTrendCard({ trend }: Props) {
  const t = useTranslations("dashboard.roi");
  const tRoi = useTranslations("roi.trend");

  const isEmpty = trend.every((p) => p.roiPercent === null && p.spendTotal === 0);

  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral" data-testid="dashboard-roi-card">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <SectionHeader title={t("title")} as="h3" />
        <p className="text-brand-400/80 text-[11px] font-bold tracking-widest uppercase">
          {tRoi("windowLabel")}
        </p>
      </div>
      {isEmpty ? (
        <p className="text-on-surface-variant py-14 text-center text-xs">{t("empty")}</p>
      ) : (
        <RoiTrendChart
          data={trend}
          labels={{
            spend: tRoi("legend.spend"),
            revenue: tRoi("legend.revenue"),
            roi: tRoi("legend.roi"),
          }}
        />
      )}
    </GlassPanel>
  );
}
