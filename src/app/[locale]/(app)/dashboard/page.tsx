import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { GhostButton, KolCard, SecondaryButton, SectionHeader } from "@/components/common";
import { ActiveCampaignsSection } from "@/features/dashboard/ActiveCampaignsSection";
import { CompetitorCpiCard } from "@/features/dashboard/CompetitorCpiCard";
import { DashboardRoiTrendCard } from "@/features/dashboard/DashboardRoiTrendCard";
import { EmailPerformanceCard } from "@/features/dashboard/EmailPerformanceCard";
import { GreetingBar } from "@/features/dashboard/GreetingBar";
import { KpiRow } from "@/features/dashboard/KpiRow";
import { QuickActions } from "@/features/dashboard/QuickActions";
import { RecentActivityCard } from "@/features/dashboard/RecentActivityCard";
import { WorkflowSteps } from "@/features/dashboard/WorkflowSteps";
import { isLocale, routing } from "@/i18n/routing";
import { fetchEmailPerformance } from "@/lib/dashboard/email-performance";
import {
  fetchRecentActivity,
  formatRelativeTime,
  resolveActivityMeta,
} from "@/lib/dashboard/recent-activity";
import { withTenant } from "@/lib/db";
import { loadRoiTrend } from "@/lib/roi/queries";

import { fetchDashboardData, mapCampaign, mapKol } from "./data";

export const metadata = { title: "Dashboard — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;
  const session = await auth();
  const tenantId = session?.user.tenantId;
  if (!tenantId) redirect("/login");

  const [[d, emailPerf, rawActivity], roiTrend] = await Promise.all([
    withTenant(tenantId, (tx) =>
      Promise.all([fetchDashboardData(tx), fetchEmailPerformance(tx), fetchRecentActivity(tx)])
    ),
    loadRoiTrend(tenantId, 30),
  ]);

  const t = await getTranslations("dashboard");
  const activityItems = rawActivity.map((row) => {
    const meta = resolveActivityMeta(row.action);
    return {
      id: row.id.toString(),
      icon: meta.icon,
      accent: meta.accent,
      text: t(`activity.${meta.i18nKey}` as Parameters<typeof t>[0]),
      time: formatRelativeTime(row.createdAt),
    };
  });

  const roiDataCount = roiTrend.filter((p) => p.roiPercent !== null).length;
  const dateLabel = new Date().toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const name = session.user.name ?? "Operator";

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <GreetingBar name={name} dateLabel={dateLabel} locale={locale} />
      <KpiRow
        kolCount={d.kolCount}
        activeCampaigns={d.activeCampaigns}
        emailsSent7d={d.emailsSent7d}
        productCount={d.productCount}
        avgValueScore={d.avgValueScore}
      />

      {/* F001: 3 new dashboard elements */}
      <WorkflowSteps
        productCount={d.productCount}
        kolCount={d.kolCount}
        campaignTotal={d.campaignTotal}
        emailTotal={d.emailTotal}
        revenueCount={d.campaignsWithRevenue}
        roiDataCount={roiDataCount}
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CompetitorCpiCard />
        <DashboardRoiTrendCard trend={roiTrend} />
      </div>

      <QuickActions locale={locale} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <ActiveCampaignsSection campaigns={d.campaigns.map(mapCampaign)} />
          <section>
            <SectionHeader
              title={t("recommendedKols")}
              as="h2"
              actions={
                <>
                  <SecondaryButton size="sm" tone="cyan">
                    {t("autoMatch")}
                  </SecondaryButton>
                  <GhostButton>{t("seeMatrix")}</GhostButton>
                </>
              }
            />
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
              data-testid="dashboard-top-kols"
            >
              {d.topKols.map(mapKol).map((k) => (
                <KolCard
                  key={k.id}
                  name={k.name}
                  avatar={k.avatar}
                  followers={k.followers}
                  aiScore={k.aiScore}
                  platform={k.platform}
                  tags={k.tags}
                  variant="grid"
                />
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <EmailPerformanceCard data={emailPerf} />
          <RecentActivityCard items={activityItems} />
        </aside>
      </div>
    </div>
  );
}
