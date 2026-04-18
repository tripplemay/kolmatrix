import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  CampaignRow,
  GhostButton,
  GlassPanel,
  GradientButton,
  KolCard,
  SecondaryButton,
  SectionHeader,
} from "@/components/common";
import { EmailPerformanceCard } from "@/features/dashboard/EmailPerformanceCard";
import { KpiRow } from "@/features/dashboard/KpiRow";
import { RecentActivityCard } from "@/features/dashboard/RecentActivityCard";
import { EMAIL_PERFORMANCE_DATA, RECENT_ACTIVITIES } from "@/features/dashboard/mocks";
import { withTenant } from "@/lib/db";

import { fetchDashboardData, mapCampaign, mapKol } from "./data";

export const metadata = { title: "Dashboard — KOLMatrix" };

export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session?.user.tenantId;
  if (!tenantId) redirect("/login");
  const d = await withTenant(tenantId, fetchDashboardData);
  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const name = session.user.name ?? "Operator";

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h2 className="text-on-surface mb-2 text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">
            Welcome back, {name}.
          </h2>
          <p className="text-on-surface-variant md:text-lg">
            Here is your global KOL marketing pulse for {dateLabel}.
          </p>
        </div>
        <GradientButton
          size="lg"
          icon={
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              add
            </span>
          }
        >
          New Campaign
        </GradientButton>
      </div>
      <KpiRow
        kolCount={d.kolCount}
        activeCampaigns={d.activeCampaigns}
        emailsSent7d={d.emailsSent7d}
        avgAiScore={d.avgAiScore}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionHeader
              title="Active Campaigns"
              as="h2"
              actions={
                <GhostButton
                  icon={
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                      arrow_forward
                    </span>
                  }
                >
                  View All
                </GhostButton>
              }
            />
            <div className="flex flex-col gap-4">
              {d.campaigns.map(mapCampaign).map((c) => (
                <CampaignRow
                  key={c.id}
                  name={c.name}
                  subtitle={c.subtitle}
                  progress={c.progress}
                  primaryMetric={{ label: "Open Rate", value: c.openRate }}
                  status={c.status}
                />
              ))}
            </div>
          </section>
          <section>
            <SectionHeader
              title="AI-Recommended KOLs"
              as="h2"
              actions={
                <>
                  <SecondaryButton size="sm" tone="cyan">
                    Auto-Match
                  </SecondaryButton>
                  <GhostButton>See Matrix</GhostButton>
                </>
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <EmailPerformanceCard data={EMAIL_PERFORMANCE_DATA} />
          <RecentActivityCard items={RECENT_ACTIVITIES} />
          <GlassPanel padding="sm" tone="cyan" glow>
            <p className="text-on-surface-variant text-xs">
              Dashboard mock data: 7d rolling window. KPI values reflect current tenant only.
            </p>
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
