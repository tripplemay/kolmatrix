/**
 * Dashboard CPI comparison card.
 *
 * Hardcoded genre benchmarks from public industry reports (AppsFlyer
 * 2025 Performance Index + Sensor Tower Q4 2024 state-of-mobile report).
 * All values are global blended CPI in USD.
 */
"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { GlassPanel, SectionHeader } from "@/components/common";

// Benchmarks locked to spec decision Q1 2025 public data.
const CPI_DATA = [
  { genre: "Casual", cpi: 0.55 },
  { genre: "Simulation", cpi: 0.95 },
  { genre: "MOBA", cpi: 1.2 },
  { genre: "Sports", cpi: 1.65 },
  { genre: "Card/CCG", cpi: 1.9 },
  { genre: "FPS/BR", cpi: 2.1 },
  { genre: "Strategy", cpi: 3.2 },
  { genre: "Open World", cpi: 3.8 },
];

// "My" demo CPI — realistic for a mixed MOBA/Strategy portfolio.
const MY_CPI = 1.45;

export function CompetitorCpiCard() {
  const t = useTranslations("dashboard.cpi");

  const chartData = [...CPI_DATA, { genre: t("myLabel"), cpi: MY_CPI, isMe: true }].sort(
    (a, b) => a.cpi - b.cpi
  );

  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral" data-testid="dashboard-cpi-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <SectionHeader title={t("title")} as="h3" />
        <span className="border-cyan/30 bg-cyan/10 text-cyan shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {t("sampleBadge")}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 48, left: 4, bottom: 0 }}
        >
          <XAxis
            type="number"
            dataKey="cpi"
            domain={[0, 4.5]}
            tickFormatter={(v) => `$${v}`}
            stroke="rgba(186, 201, 204, 0.5)"
            fontSize={10}
            tickCount={5}
          />
          <YAxis
            type="category"
            dataKey="genre"
            stroke="rgba(186, 201, 204, 0.5)"
            fontSize={11}
            width={72}
          />
          <Tooltip
            formatter={(value) => {
              const num = typeof value === "number" ? value : Number(value);
              return [`$${num.toFixed(2)}`, t("cpiLabel")];
            }}
            contentStyle={{
              background: "rgba(11, 19, 38, 0.95)",
              border: "1px solid rgba(0, 229, 255, 0.2)",
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(0, 229, 255, 0.06)" }}
          />
          <Bar dataKey="cpi" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, i) =>
              (entry as { isMe?: boolean }).isMe ? (
                <Cell key={i} fill="var(--color-cyan)" />
              ) : (
                <Cell key={i} fill="rgba(186, 201, 204, 0.25)" />
              )
            )}
            <LabelList
              dataKey="cpi"
              position="right"
              formatter={(value) => {
                const num = typeof value === "number" ? value : Number(value);
                return `$${num.toFixed(2)}`;
              }}
              style={{ fill: "rgba(186, 201, 204, 0.75)", fontSize: 10 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-on-surface-variant mt-2 text-right text-[10px]">{t("source")}</p>
    </GlassPanel>
  );
}
