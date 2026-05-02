"use client";

/**
 * MVP-vf-F005 · Email Performance line chart.
 *
 * Two-line recharts area: contacted (cyan) + replied (purple). Empty
 * state shown when every point in the 14-day window is zero — the
 * marketer doesn't need an axis-only graph that screams "no data" by
 * accident.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export default function EmailPerformanceChartImpl({ data, labels }: Props) {
  const total = data.reduce((sum, p) => sum + p.contacted + p.replied, 0);
  return (
    <GlassPanel
      data-testid="campaign-email-perf-chart"
      className="space-y-4 p-5"
    >
      <h2 className="text-lg font-semibold text-white">{labels.title}</h2>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">
          {labels.empty}
        </p>
      ) : (
        <div className="h-[180px] w-full" data-testid="campaign-email-perf-chart-graph">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="contacted-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(0,229,255)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="rgb(0,229,255)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="replied-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(157,80,255)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="rgb(157,80,255)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                stroke="rgba(255,255,255,0.4)"
                fontSize={10}
              />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "rgba(11, 19, 38, 0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Area
                type="monotone"
                dataKey="contacted"
                name={labels.contacted}
                stroke="rgb(0,229,255)"
                fill="url(#contacted-grad)"
              />
              <Area
                type="monotone"
                dataKey="replied"
                name={labels.replied}
                stroke="rgb(157,80,255)"
                fill="url(#replied-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassPanel>
  );
}
