/**
 * MVP-vf-F005 / BIx-F005-D · Email Performance line chart wrapper.
 *
 * recharts is gated behind next/dynamic — see RoiTrendChart for the
 * same pattern. The actual AreaChart code lives in *Impl.tsx.
 */
"use client";

import dynamic from "next/dynamic";

import { GlassPanel } from "@/components/common";

import type { EmailSeriesPoint } from "@/lib/campaigns/detail-insights";

interface Props {
  data: EmailSeriesPoint[];
  labels: {
    title: string;
    empty: string;
    contacted: string;
    replied: string;
  };
}

const EmailPerformanceChartImpl = dynamic(
  () => import("./EmailPerformanceChartImpl"),
  {
    ssr: false,
    loading: () => (
      <GlassPanel
        data-testid="campaign-email-perf-chart"
        className="space-y-4 p-5"
      >
        <div
          className="h-[180px] w-full animate-pulse rounded-lg bg-white/[0.02]"
          aria-hidden
          data-testid="campaign-email-perf-chart-loading"
        />
      </GlassPanel>
    ),
  }
);

export function EmailPerformanceChart(props: Props) {
  return <EmailPerformanceChartImpl {...props} />;
}
