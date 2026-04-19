import { getTranslations } from "next-intl/server";
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
import { isLocale, routing } from "@/i18n/routing";
import { withTenant } from "@/lib/db";

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
  const d = await withTenant(tenantId, fetchDashboardData);
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const dateLabel = new Date().toLocaleDateString(locale, {
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
            {t("greeting", { name })}
          </h2>
          <p className="text-on-surface-variant md:text-lg">{t("subtitle", { date: dateLabel })}</p>
        </div>
        <GradientButton
          size="lg"
          icon={
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              add
            </span>
          }
        >
          {t("newCampaign")}
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
              title={t("activeCampaigns")}
              as="h2"
              actions={
                <GhostButton
                  icon={
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                      arrow_forward
                    </span>
                  }
                >
                  {t("viewAll")}
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
                  primaryMetric={{ label: tCommon("openRate"), value: c.openRate }}
                  status={c.status}
                />
              ))}
            </div>
          </section>
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
            <p className="text-on-surface-variant text-xs">{t("mockNote")}</p>
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}
