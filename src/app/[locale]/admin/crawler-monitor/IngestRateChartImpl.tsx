/**
 * BL-096-F002 · Ingest-rate chart implementation.
 *
 * Daily new-KOL counts (last 14d) as a bar chart. Gated behind a next/dynamic
 * boundary in IngestRateChart.tsx so recharts stays out of the initial bundle.
 * MUST be "use client" — recharts measures the DOM via ResizeObserver and
 * SSR-rendering it triggers hydration mismatches.
 */
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface IngestPoint {
  day: string;
  count: number;
}

export default function IngestRateChartImpl({ data, label }: { data: IngestPoint[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          labelStyle={{ color: "#fff" }}
        />
        <Bar dataKey="count" name={label} fill="#22d3ee" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
