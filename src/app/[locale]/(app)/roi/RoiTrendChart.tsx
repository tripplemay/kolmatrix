/**
 * BM2-F009 · Trend chart (Planner adjudication §13 #G:A — recharts
 * ComposedChart).
 *
 *   - bar(spend)   — neutral grey
 *   - bar(revenue) — cyan brand
 *   - line(roi%)   — accent purple, secondary right axis
 *
 * 30 daily buckets fed straight from F008 `loadRoiTrend`.
 * ROI right-axis clamped to [-100, 500] per Planner §13.5 #6 so a
 * single outlier day cannot squash the bars to a sliver.
 *
 * MUST be `"use client"` — recharts measures DOM via ResizeObserver
 * and SSR-rendering it triggers hydration mismatches (Planner §13.5 #1).
 */
"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RoiTrendPoint } from "@/lib/roi/compute";

interface Props {
  data: RoiTrendPoint[];
  labels: { spend: string; revenue: string; roi: string };
}

const ROI_AXIS_MIN = -100;
const ROI_AXIS_MAX = 500;

function clampRoi(p: RoiTrendPoint): number | null {
  if (p.roiPercent == null) return null;
  if (p.roiPercent < ROI_AXIS_MIN) return ROI_AXIS_MIN;
  if (p.roiPercent > ROI_AXIS_MAX) return ROI_AXIS_MAX;
  return p.roiPercent;
}

export function RoiTrendChart({ data, labels }: Props) {
  const chartData = data.map((p) => ({
    date: p.date.slice(5), // MM-DD label keeps the axis readable
    spend: p.spendTotal,
    revenue: p.revenue,
    roi: clampRoi(p),
  }));

  return (
    <div data-testid="roi-trend-chart" className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 12, right: 16, left: -8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(202, 201, 204, 0.08)"
          />
          <XAxis
            dataKey="date"
            stroke="rgba(186, 201, 204, 0.65)"
            fontSize={10}
            tickMargin={6}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            yAxisId="money"
            stroke="rgba(186, 201, 204, 0.65)"
            fontSize={11}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            stroke="rgba(186, 142, 255, 0.7)"
            fontSize={11}
            domain={[ROI_AXIS_MIN, ROI_AXIS_MAX]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(0, 229, 255, 0.06)" }}
            contentStyle={{
              background: "rgba(11, 19, 38, 0.95)",
              border: "1px solid rgba(0, 229, 255, 0.2)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value);
              if (name === labels.roi) {
                return [`${num}%`, name];
              }
              return [
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(num),
                name,
              ];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar
            yAxisId="money"
            dataKey="spend"
            name={labels.spend}
            fill="rgba(186, 201, 204, 0.55)"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            yAxisId="money"
            dataKey="revenue"
            name={labels.revenue}
            fill="var(--color-cyan)"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="roi"
            name={labels.roi}
            stroke="var(--color-purple)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
