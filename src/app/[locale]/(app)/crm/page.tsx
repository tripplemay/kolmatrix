/**
 * BM2-F007 / BIx-mvp-polish-pass F001 · `/crm` page.
 *
 * Layout:
 *   Header (title + 3-way time toggle + Export CSV)
 *   → 4-card KPI strip (Pipeline / Long-term ring / Spend sparkline /
 *     Avg ROI placeholder)
 *   → Section B 60/40 split (Pipeline horizontal bars clickable →
 *     /database?status=X  +  Funnel 4 steps)
 *   → Recent stage changes (audit_log last 30, who/when/before→after)
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_CRM_RANGE, isCrmRange, runCrmOverview, type CrmRange } from "@/lib/crm/overview";

import { CrmFunnel } from "./CrmFunnel";
import { CrmHeader } from "./CrmHeader";
import { CrmKpiStrip } from "./CrmKpiStrip";
import { CrmPipelineBars } from "./CrmPipelineBars";
import { CrmRecentChanges } from "./CrmRecentChanges";

export const metadata = { title: "CRM — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asScalar(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function CrmPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const rawRange = asScalar(raw.range);
  const range: CrmRange = isCrmRange(rawRange) ? rawRange : DEFAULT_CRM_RANGE;

  const overview = await runCrmOverview(tenantId, { range });
  const t = await getTranslations("crm");

  const basePath = `/${locale}/crm`;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16" data-testid="crm-page">
      <CrmHeader title={t("title")} subtitle={t("subtitle")} basePath={basePath} range={range} />

      <CrmKpiStrip kpi={overview.collabKpi} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-10" data-testid="crm-section-b">
        <div className="lg:col-span-6">
          <CrmPipelineBars buckets={overview.stageDistribution} locale={locale} />
        </div>
        <div className="lg:col-span-4">
          <CrmFunnel steps={overview.funnelMetrics.steps} />
        </div>
      </section>

      <CrmRecentChanges rows={overview.recentChanges} locale={locale} />
    </div>
  );
}
