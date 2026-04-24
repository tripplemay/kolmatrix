/**
 * BM2-F009 · `/roi` page (Planner adjudication §13).
 *
 * Layout (Planner #E:C / #L:B — 60/40, Quarterly Budget dropped):
 *   Header (breadcrumb + title + 30D toggle + AI button + Record CTA)
 *   → 4-card KPI strip
 *   → Section B: 60/40 split — Trend chart left, AI Insights right
 *   → Section C: Campaign ROI table (full width, client filter)
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  loadRoiCampaigns,
  loadRoiSummary,
  loadRoiTrend,
} from "@/lib/roi/queries";

import { RoiCampaignTable } from "./RoiCampaignTable";
import { RoiHeader } from "./RoiHeader";
import { RoiInsightsPanel } from "./RoiInsightsPanel";
import { RoiKpiStrip } from "./RoiKpiStrip";
import { RoiTrendCard } from "./RoiTrendCard";

export const metadata = { title: "ROI Tracking — KOLMatrix" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function RoiPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect(`/${locale}/login`);

  const [summary, trend, campaigns, t] = await Promise.all([
    loadRoiSummary(tenantId),
    loadRoiTrend(tenantId, 30),
    loadRoiCampaigns(tenantId),
    getTranslations("roi"),
  ]);

  const insightsLocale: "en" | "zh" = locale === "zh" ? "zh" : "en";

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="roi-page"
    >
      <RoiHeader locale={locale} />

      <RoiKpiStrip locale={locale} summary={summary} trend={trend} />

      <section
        className="grid grid-cols-1 gap-6 lg:grid-cols-10"
        data-testid="roi-section-b"
      >
        <div className="lg:col-span-6">
          <RoiTrendCard trend={trend} />
        </div>
        <div className="lg:col-span-4">
          <RoiInsightsPanel
            tenantId={tenantId}
            locale={insightsLocale}
            labels={{
              title: t("insights.title"),
              idleHint: t("insights.idleHint"),
              generate: t("insights.generate"),
              regenerate: t("insights.regenerate"),
              loading: t("insights.loading"),
              cachedPrefix: t("insights.cachedPrefix"),
              error: {
                missing_env: t("insights.error.missing_env"),
                http_error: t("insights.error.http_error"),
                invalid_response: t("insights.error.invalid_response"),
                timeout: t("insights.error.timeout"),
                unauthorized: t("insights.error.unauthorized"),
                generic: t("insights.error.generic"),
              },
            }}
          />
        </div>
      </section>

      <RoiCampaignTable
        locale={locale}
        rows={campaigns}
        labels={{
          title: t("table.title"),
          filterPlaceholder: t("table.filterPlaceholder"),
          empty: t("table.empty"),
          completed: t("table.statusCompleted"),
          cols: {
            campaign: t("table.cols.campaign"),
            product: t("table.cols.product"),
            closedAt: t("table.cols.closedAt"),
            spend: t("table.cols.spend"),
            revenue: t("table.cols.revenue"),
            roi: t("table.cols.roi"),
            status: t("table.cols.status"),
          },
        }}
      />
    </div>
  );
}
