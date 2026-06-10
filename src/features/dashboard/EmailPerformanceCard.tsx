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
  // BL-110-F004 fix-round 1 — driven by ALL-TIME reply existence
  // (isReplyTrackingPending), NOT the 14-day chart. The chart-derived
  // heuristic false-flagged tenants whose replies predate the 14-day
  // window (verifying blocker). True ⇒ reply tracking has never produced
  // data (inbound email = B4); show the honest pending footnote.
  replyTrackingPending: boolean;
}

export function EmailPerformanceCard({ data, replyTrackingPending }: Props) {
  const t = useTranslations("dashboard");
  const isEmpty = data.every((p) => p.sent === 0 && p.opened === 0 && p.replied === 0);
  // Keep the Replied line (B4 revives it). Only annotate when the tenant
  // has NO real reply data anywhere AND the card is actually showing a
  // chart (not the fully-empty placeholder).
  const showReplyNote = !isEmpty && replyTrackingPending;
  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral" data-testid="dashboard-email-perf">
      <SectionHeader title={t("emailPerformance")} as="h3" className="mb-3" />
      {isEmpty ? (
        <p className="text-on-surface-variant py-10 text-center text-xs">
          {t("emailPerformanceEmpty")}
        </p>
      ) : (
        <>
          <EmailPerformanceChart data={data} />
          {showReplyNote ? (
            <p
              data-testid="dashboard-email-perf-reply-note"
              className="text-on-surface-variant/70 mt-2 text-center text-[10px]"
            >
              {t("emailPerformanceReplyNote")}
            </p>
          ) : null}
        </>
      )}
    </GlassPanel>
  );
}
