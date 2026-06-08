/**
 * BL-096-F002 · Ingest-rate chart wrapper (next/dynamic boundary).
 *
 * recharts is ~90KB gzipped — keep it out of the initial /admin/crawler-monitor
 * bundle. The chart code lives in IngestRateChartImpl.tsx; this shim only lands
 * the dynamic boundary on the client.
 */
"use client";

import dynamic from "next/dynamic";

import type { IngestPoint } from "./IngestRateChartImpl";

const IngestRateChartImpl = dynamic(() => import("./IngestRateChartImpl"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[240px] w-full animate-pulse rounded-lg bg-white/[0.02]"
      data-testid="ingest-rate-chart-loading"
      aria-hidden
    />
  ),
});

export function IngestRateChart({ data, label }: { data: IngestPoint[]; label: string }) {
  return <IngestRateChartImpl data={data} label={label} />;
}
