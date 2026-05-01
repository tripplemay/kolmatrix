/**
 * EmailPerformanceCard — 包 recharts chart 的面板外壳（F010 GlassPanel 消费者）
 *
 * 把 GlassPanel + SectionHeader + chart 组合在一起，给 page.tsx 节省行数。
 */
"use client";

import { useTranslations } from "next-intl";

import { GlassPanel, SectionHeader } from "@/components/common";

import type { EmailPerfPoint } from "@/lib/dashboard/email-performance";

import { EmailPerformanceChart } from "./EmailPerformanceChart";

interface Props {
  data: EmailPerfPoint[];
}

export function EmailPerformanceCard({ data }: Props) {
  const t = useTranslations("dashboard");
  const isEmpty = data.every((p) => p.sent === 0 && p.opened === 0 && p.replied === 0);
  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral" data-testid="dashboard-email-perf">
      <SectionHeader title={t("emailPerformance")} as="h3" className="mb-3" />
      {isEmpty ? (
        <p className="text-on-surface-variant py-10 text-center text-xs">
          {t("emailPerformanceEmpty")}
        </p>
      ) : (
        <EmailPerformanceChart data={data} />
      )}
    </GlassPanel>
  );
}
