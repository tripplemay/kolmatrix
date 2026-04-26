/**
 * MVP-vf-F005 · Right-rail Campaign Health card.
 *
 * Three derived metrics: spend rate (% of budget consumed), revenue vs
 * budget (% earned back), days to closeout (negative = overdue). All
 * computed server-side in detail-insights.ts; this component just
 * renders.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel, RingProgress } from "@/components/common";

import type { CampaignHealth } from "@/lib/campaigns/detail-insights";

interface Props {
  health: CampaignHealth;
}

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

export async function CampaignHealthCard({ health }: Props) {
  const t = await getTranslations("campaigns.detail.insights.health");
  const closeoutText =
    health.daysToCloseout == null
      ? t("noEndDate")
      : health.daysToCloseout < 0
        ? t("overdue", { days: -health.daysToCloseout })
        : t("daysLeft", { days: health.daysToCloseout });

  return (
    <GlassPanel
      data-testid="campaign-health-card"
      className="space-y-4 p-5"
    >
      <h4 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {t("heading")}
      </h4>
      <div className="flex items-center gap-4">
        <RingProgress
          value={health.spendRate ?? 0}
          ariaLabel={t("spendRateAria")}
        />
        <div className="flex-1 space-y-1">
          <p className="text-xs text-on-surface-variant">{t("spendRate")}</p>
          <p className="text-base font-bold text-white">{pct(health.spendRate)}</p>
        </div>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-on-surface-variant">{t("revenueVsBudget")}</span>
        <span className="font-semibold text-white">{pct(health.revenueVsBudget)}</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-on-surface-variant">{t("closeout")}</span>
        <span
          className={
            health.daysToCloseout != null && health.daysToCloseout < 0
              ? "font-semibold text-error"
              : "font-semibold text-white"
          }
        >
          {closeoutText}
        </span>
      </div>
    </GlassPanel>
  );
}
