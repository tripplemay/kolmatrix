/**
 * BM2-F009 / BIx-F005-D · Trend chart wrapper (next/dynamic boundary).
 *
 * The recharts library is ~90KB gzipped — keeping it out of the initial
 * /roi bundle saves that on first paint. The actual chart code lives in
 * `RoiTrendChartImpl.tsx`; this thin shim only exists to land the
 * dynamic boundary on the client.
 */
"use client";

import dynamic from "next/dynamic";

import type { RoiTrendPoint } from "@/lib/roi/compute";

interface Props {
  data: RoiTrendPoint[];
  labels: { spend: string; revenue: string; roi: string };
}

const RoiTrendChartImpl = dynamic(() => import("./RoiTrendChartImpl"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[280px] w-full animate-pulse rounded-lg bg-white/[0.02]"
      data-testid="roi-trend-chart-loading"
      aria-hidden
    />
  ),
});

export function RoiTrendChart(props: Props) {
  return <RoiTrendChartImpl {...props} />;
}
