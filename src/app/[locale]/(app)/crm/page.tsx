/**
 * BM2-F007 · `/crm` page (Hybrid layout per Planner adjudication
 * §13 #A:A3).
 *
 * Layout:
 *   Header (title + disabled time toggle + Export CSV + +Manual log)
 *   → 4-card KPI strip (Pipeline / Long-term ring / Spend sparkline /
 *     Avg ROI placeholder)
 *   → Section B 60/40 split (Pipeline horizontal bars clickable →
 *     /database?status=X  +  Funnel 4 steps)
 *   → Recent stage changes (audit_log last 30, who/when/before→after)
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { runCrmOverview } from "@/lib/crm/overview";

import { CrmFunnel } from "./CrmFunnel";
import { CrmHeader } from "./CrmHeader";
import { CrmKpiStrip } from "./CrmKpiStrip";
import { CrmPipelineBars } from "./CrmPipelineBars";
import { CrmRecentChanges } from "./CrmRecentChanges";

export const metadata = { title: "CRM — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function CrmPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const overview = await runCrmOverview(tenantId);
  const t = await getTranslations("crm");

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="crm-page"
    >
      <CrmHeader title={t("title")} subtitle={t("subtitle")} />

      <CrmKpiStrip kpi={overview.collabKpi} />

      <section
        className="grid grid-cols-1 gap-6 lg:grid-cols-10"
        data-testid="crm-section-b"
      >
        <div className="lg:col-span-6">
          <CrmPipelineBars
            buckets={overview.stageDistribution}
            locale={locale}
          />
        </div>
        <div className="lg:col-span-4">
          <CrmFunnel steps={overview.funnelMetrics.steps} />
        </div>
      </section>

      <CrmRecentChanges rows={overview.recentChanges} locale={locale} />
    </div>
  );
}
