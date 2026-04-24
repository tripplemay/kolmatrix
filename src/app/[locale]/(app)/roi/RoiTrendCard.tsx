/**
 * BM2-F009 · Trend section wrapper (server) → wraps the client-only
 * `<RoiTrendChart>` in a glass panel + heading. Splitting the
 * server header from the client chart keeps i18n on the server
 * (next-intl async API) and the recharts code in the client bundle.
 */
import { getTranslations } from "next-intl/server";

import type { RoiTrendPoint } from "@/lib/roi/compute";

import { RoiTrendChart } from "./RoiTrendChart";

interface Props {
  trend: RoiTrendPoint[];
}

export async function RoiTrendCard({ trend }: Props) {
  const t = await getTranslations("roi.trend");

  return (
    <article
      data-testid="roi-trend-card"
      className="flex h-full flex-col gap-4 rounded-2xl border border-white/5 bg-surface-low/60 p-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-white">{t("title")}</h2>
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan/80">
          {t("windowLabel")}
        </p>
      </header>
      <RoiTrendChart
        data={trend}
        labels={{
          spend: t("legend.spend"),
          revenue: t("legend.revenue"),
          roi: t("legend.roi"),
        }}
      />
    </article>
  );
}
