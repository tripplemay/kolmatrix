/**
 * EmailPerformanceChart wrapper — BIx-F005-D dynamic boundary.
 *
 * The recharts LineChart implementation lives in *Impl.tsx; this file
 * gates that bundle behind next/dynamic so the dashboard initial JS
 * doesn't pull in recharts on first paint.
 */
"use client";

import dynamic from "next/dynamic";

import type { EmailPerfPoint } from "@/lib/dashboard/email-performance";

interface Props {
  data: EmailPerfPoint[];
}

const EmailPerformanceChartImpl = dynamic(
  () => import("./EmailPerformanceChartImpl"),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[220px] w-full animate-pulse rounded-lg bg-white/[0.02]"
        aria-hidden
        data-testid="dashboard-email-perf-chart-loading"
      />
    ),
  }
);

export function EmailPerformanceChart(props: Props) {
  return <EmailPerformanceChartImpl {...props} />;
}
