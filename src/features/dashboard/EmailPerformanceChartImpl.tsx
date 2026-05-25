/**
 * EmailPerformanceChart — Dashboard 独享 14 天趋势图（3 条线：Sent/Opened/Replied）
 *
 * 决议 #2（F007 §11.1）：放 features/dashboard/ 而不是 F010 公共。
 * 决议 #B10 漂移补齐：原 Stitch HTML 纯 polyline 无轴刻度，这里用 recharts
 * 补 grid + Y 轴 tick，视觉优先于 HTML 字面还原。
 */
"use client";

import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EmailPerfPoint } from "@/lib/dashboard/email-performance";

interface Props {
  data: EmailPerfPoint[];
}

const LINE_PROPS = { strokeWidth: 2, dot: false, type: "monotone" as const };

export default function EmailPerformanceChartImpl({ data }: Props) {
  const t = useTranslations("dashboard.emailPerformanceChart");
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(202, 201, 204, 0.08)" />
        <XAxis dataKey="date" stroke="rgba(186, 201, 204, 0.7)" fontSize={11} tickMargin={6} />
        <YAxis stroke="rgba(186, 201, 204, 0.7)" fontSize={11} />
        <Tooltip
          cursor={{ stroke: "rgba(0, 229, 255, 0.25)" }}
          contentStyle={{
            background: "rgba(11, 19, 38, 0.95)",
            border: "1px solid rgba(0, 229, 255, 0.2)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line {...LINE_PROPS} dataKey="sent" name={t("sent")} stroke="var(--color-cyan)" />
        <Line {...LINE_PROPS} dataKey="opened" name={t("opened")} stroke="var(--color-purple)" />
        <Line {...LINE_PROPS} dataKey="replied" name={t("replied")} stroke="var(--color-cyan-soft)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
