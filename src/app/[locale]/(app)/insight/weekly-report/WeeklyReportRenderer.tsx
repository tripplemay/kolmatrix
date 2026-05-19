/**
 * BM2-F010 / BIx-F005-E · `<WeeklyReportRenderer>` wrapper.
 *
 * react-markdown + remark-gfm together pull in ~50KB gzipped that
 * the rest of the weekly-report page never needs at SSR time.
 * Gating the actual renderer behind next/dynamic with ssr:false
 * also sidesteps the GFM-table hydration drift Planner §13.5 #1
 * called out — the markdown subtree only ever exists on the client.
 */
"use client";

import dynamic from "next/dynamic";

interface Props {
  markdown: string;
  className?: string;
}

const WeeklyReportRendererImpl = dynamic(
  () => import("./WeeklyReportRendererImpl"),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-32 w-full animate-pulse rounded-lg bg-white/[0.02]"
        aria-hidden
        data-testid="weekly-report-markdown-loading"
      />
    ),
  }
);

export function WeeklyReportRenderer(props: Props) {
  return <WeeklyReportRendererImpl {...props} />;
}
