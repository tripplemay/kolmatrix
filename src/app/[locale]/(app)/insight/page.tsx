/**
 * BL-070-F003 · `/insight` page — unified reporting workspace.
 *
 * Three tabs (URL state `?tab=`):
 *   - `dashboard` (default) — KPI strip / workflow / activity / ROI.
 *     Embeds the shared `<DashboardContent>` server component from
 *     `@/features/dashboard` (BL-070-F004 extracted it out of the
 *     retired `/dashboard/page.tsx` so the render logic lives in one
 *     place after the legacy route is deleted).
 *   - `reports` — entry point to weekly reports (the bulk of the
 *     content lives at the migrated `/insight/weekly-report/` sub-
 *     route, which preserves the full BM2-F010 page).
 *   - `analytics` — Phase 5 placeholder, kept so the 301 redirect from
 *     legacy `/analytics` lands on a clean panel rather than a 404.
 *
 * Layout mirrors the BL-069 `/brief` tab pattern (plain anchor nav so
 * the server-side navigation is straightforward; no client component
 * needed for the bar itself).
 *
 * Auth: redirects to `/login` when the session is missing. The
 * downstream `<DashboardContent>` re-checks, but performing the check
 * here too lets the tab nav render before the redirect.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

// BL-070-F009 — DashboardContent (KPI cards / workflow / activity / ROI
// charts) is the heaviest client transitive on /insight; loading it via
// `await import()` inside the dashboard tab branch keeps the chunk out of
// /insight?tab=reports / ?tab=analytics initial JS. Default-tab visits
// (dashboard) still SSR the content but the chunk is now per-route.

import { InsightTabs, pickInsightTab } from "./InsightTabs";

export const metadata = { title: "Insight — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InsightPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const tab = pickInsightTab(sp.tab);
  const t = await getTranslations("insight");

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16" data-testid="insight-page">
      <header>
        <h1
          data-testid="insight-page-title"
          className="text-2xl font-bold tracking-tight text-white"
        >
          {t("pageTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          {t("subtitle")}
        </p>
      </header>

      <InsightTabs
        locale={locale}
        activeTab={tab}
        labels={{
          dashboard: t("tabs.dashboard"),
          reports: t("tabs.reports"),
          analytics: t("tabs.analytics"),
        }}
      />

      {tab === "dashboard"
        ? await renderDashboardTab(locale)
        : tab === "reports"
          ? <ReportsPanel locale={locale} />
          : <AnalyticsPanel />}
    </div>
  );
}

async function renderDashboardTab(locale: string) {
  const { DashboardContent } = await import(
    "@/features/dashboard/DashboardContent"
  );
  return <DashboardContent locale={locale} />;
}

async function ReportsPanel({ locale }: { locale: string }) {
  // BL-070-F003 — Reports tab is intentionally a lightweight launch
  // pad: the heavy weekly-report renderer lives at the migrated
  // `/insight/weekly-report` sub-route (BM2-F010 page, preserved
  // verbatim via git mv from the deprecated /weekly-report route).
  const t = await getTranslations("insight.reports");
  const tWeekly = await getTranslations("weeklyReport");
  return (
    <section
      className="glass-panel rounded-2xl border border-on-surface/5 p-6"
      data-testid="insight-reports-panel"
    >
      <h2 className="mb-2 text-lg font-semibold text-white">{t("title")}</h2>
      <p className="mb-4 text-sm text-on-surface-variant">{t("body")}</p>
      <Link
        href={`/${locale}/insight/weekly-report`}
        data-testid="insight-reports-weekly-link"
        className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
      >
        {tWeekly("title")}
      </Link>
    </section>
  );
}

async function AnalyticsPanel() {
  // BL-070-F003 — analytics tab is a Phase 5 placeholder per spec
  // §2 (Insight 重构深度 "仅合并 + 路径迁移"; AI-learned-preferences
  // and the real analytics surface are out of scope for BL-070).
  const t = await getTranslations("insight.analytics");
  return (
    <section
      className="glass-panel rounded-2xl border border-on-surface/5 p-12 text-center"
      data-testid="insight-analytics-panel"
    >
      <h2 className="mb-2 text-lg font-semibold text-white">{t("title")}</h2>
      <p className="text-sm text-on-surface-variant">{t("body")}</p>
    </section>
  );
}
