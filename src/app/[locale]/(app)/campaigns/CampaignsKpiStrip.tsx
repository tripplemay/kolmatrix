/**
 * MVP-vf-F004 · Campaigns list KPI strip (server component).
 *
 * Four cards across the top of the page mirror the Stitch
 * campaigns-list prototype. All data is real and tenant-scoped.
 * Reply-rate renders "—" when no emails have been sent (per F004
 * acceptance: "如无邮件硬编 '—'").
 */
import { getTranslations } from "next-intl/server";

import { StatCard } from "@/components/common";

import type { CampaignsListKpis } from "@/lib/campaigns/list-kpis";

interface Props {
  kpis: CampaignsListKpis;
}

function compactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function CampaignsKpiStrip({ kpis }: Props) {
  const t = await getTranslations("campaigns.kpis");
  const replyValue =
    kpis.avgReplyRate == null
      ? "—"
      : `${(kpis.avgReplyRate * 100).toFixed(1)}%`;
  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-testid="campaigns-kpi-strip"
    >
      <StatCard label={t("activeCampaigns")} value={String(kpis.activeCampaigns)} />
      <StatCard label={t("kolsInPipeline")} value={String(kpis.kolsInPipeline)} />
      <StatCard label={t("avgReplyRate")} value={replyValue} />
      <StatCard label={t("reachForecast")} value={compactNumber(kpis.reachForecast)} />
    </div>
  );
}
