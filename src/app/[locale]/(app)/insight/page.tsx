/**
 * BL-070-F003 · `/insight` page — unified reporting workspace.
 *
 * Three tabs (URL state `?tab=`):
 *   - `dashboard` (default) — KPI strip / workflow / activity / ROI.
 *     Embeds the existing `<DashboardPage>` server component directly
 *     so the dashboard render logic stays in one place during the
 *     BL-070 transition; F004 retires the `/dashboard/` route entirely
 *     and `/insight` becomes the canonical surface.
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
 * downstream `<DashboardPage>` re-checks, but performing the check
 * here too lets the tab nav render before the redirect.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import DashboardPage from "@/app/[locale]/(app)/dashboard/page";

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

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16" data-testid="insight-page">
      <header>
        <h1
          data-testid="insight-page-title"
          className="text-2xl font-bold tracking-tight text-white"
        >
          Insight
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          Dashboard, reports, and (soon) analytics — your global KOL marketing pulse.
        </p>
      </header>

      <InsightTabs locale={locale} activeTab={tab} />

      {tab === "dashboard" ? (
        <DashboardPage params={params} />
      ) : tab === "reports" ? (
        <ReportsPanel locale={locale} />
      ) : (
        <AnalyticsPanel />
      )}
    </div>
  );
}

async function ReportsPanel({ locale }: { locale: string }) {
  // BL-070-F003 — Reports tab is intentionally a lightweight launch
  // pad: the heavy weekly-report renderer lives at the migrated
  // `/insight/weekly-report` sub-route (BM2-F010 page, preserved
  // verbatim via git mv from the deprecated /weekly-report route).
  const t = await getTranslations("weeklyReport");
  return (
    <section
      className="glass-panel rounded-2xl border border-on-surface/5 p-6"
      data-testid="insight-reports-panel"
    >
      <h2 className="mb-2 text-lg font-semibold text-white">Reports</h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        AI-generated weekly performance reports for your tenant.
      </p>
      <Link
        href={`/${locale}/insight/weekly-report`}
        data-testid="insight-reports-weekly-link"
        className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
      >
        {t("title")}
      </Link>
    </section>
  );
}

function AnalyticsPanel() {
  // BL-070-F003 — analytics tab is a Phase 5 placeholder per spec
  // §2 (Insight 重构深度 "仅合并 + 路径迁移"; AI-learned-preferences
  // and the real analytics surface are out of scope for BL-070).
  return (
    <section
      className="glass-panel rounded-2xl border border-on-surface/5 p-12 text-center"
      data-testid="insight-analytics-panel"
    >
      <h2 className="mb-2 text-lg font-semibold text-white">Analytics</h2>
      <p className="text-sm text-on-surface-variant">
        Phase 5 — coming after the public launch. Stay tuned for
        AI-learned preferences and cross-campaign trend analysis.
      </p>
    </section>
  );
}
