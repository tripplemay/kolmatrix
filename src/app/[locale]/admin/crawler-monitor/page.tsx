import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isLocale, routing } from "@/i18n/routing";
import { isAdminRole } from "@/lib/auth/roles";
import {
  CrawlerMonitorError,
  computeHealthLights,
  fetchCrawlerStats,
  type CrawlerStats,
  type HealthStatus,
} from "@/lib/admin/crawler-monitor-client";

import { IngestRateChart } from "./IngestRateChart";

export const metadata = { title: "Crawler Monitor (READ-ONLY) — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

const DOT: Record<HealthStatus, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  critical: "bg-error",
};

function Card({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-white/10 bg-surface-low p-5 space-y-3"
    >
      <h2 className="text-sm font-semibold text-white/80">{title}</h2>
      {children}
    </section>
  );
}

export default async function CrawlerMonitorPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!isAdminRole(session.user.role)) redirect(`/${locale}/insight`);

  const t = await getTranslations({ locale, namespace: "admin.crawlerMonitor" });

  let stats: CrawlerStats | null = null;
  let error: { kind: string; message: string } | null = null;
  try {
    stats = await fetchCrawlerStats();
  } catch (err) {
    if (err instanceof CrawlerMonitorError) error = { kind: err.kind, message: err.message };
    else error = { kind: "transient", message: err instanceof Error ? err.message : String(err) };
  }

  const lights = stats ? computeHealthLights(stats) : [];

  return (
    <div className="min-h-screen bg-surface-lowest p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <div
            role="alert"
            data-testid="crawler-monitor-readonly-banner"
            className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            <span aria-hidden className="material-symbols-outlined text-base">
              warning
            </span>
            <span>{t("readOnlyNote")}</span>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            data-testid="crawler-monitor-fetch-error"
            className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {t("fetchError", { kind: error.kind, message: error.message })}
          </div>
        ) : stats ? (
          <>
            {/* Health lights */}
            <div data-testid="crawler-monitor-health" className="flex flex-wrap gap-3">
              {lights.map((l) => (
                <div
                  key={l.id}
                  data-testid={`health-${l.id}`}
                  data-status={l.status}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-low px-3 py-2 text-sm text-white/80"
                >
                  <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[l.status]}`} />
                  <span>{t(`health.${l.id}`)}</span>
                  <span className="text-white/40">{t(`healthStatus.${l.status}`)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Ingest rate */}
              <Card title={t("ingestRate")} testId="card-ingest-rate">
                {stats.ingestRateByDay.length > 0 ? (
                  <IngestRateChart data={stats.ingestRateByDay} label={t("newKols")} />
                ) : (
                  <p className="text-sm text-white/40">{t("noData")}</p>
                )}
              </Card>

              {/* Balances + cost */}
              <Card title={t("balances")} testId="card-balances">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-white/40">{t("tikhubBalance")}</dt>
                    <dd className="text-lg font-semibold text-white">
                      {stats.tikhubBalanceUsd == null ? "—" : `$${stats.tikhubBalanceUsd.toFixed(2)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40">{t("freeCredit")}</dt>
                    <dd className="text-lg font-semibold text-white">
                      {stats.tikhubFreeCreditUsd == null ? "—" : `$${stats.tikhubFreeCreditUsd.toFixed(2)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40">{t("costToday")}</dt>
                    <dd className="text-lg font-semibold text-white">${stats.costTodayUsd.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">{t("costMonth")}</dt>
                    <dd className="text-lg font-semibold text-white">${stats.apifyCostThisMonthUsd.toFixed(2)}</dd>
                  </div>
                </dl>
              </Card>

              {/* Scrape composition today */}
              <Card title={t("composition")} testId="card-composition">
                {stats.scrapeCompositionToday.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-white/40">
                        <th className="py-1">{t("colKind")}</th>
                        <th className="py-1 text-right">{t("colJobs")}</th>
                        <th className="py-1 text-right">{t("colScraped")}</th>
                        <th className="py-1 text-right">{t("colInserted")}</th>
                        <th className="py-1 text-right">{t("colCost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.scrapeCompositionToday.map((c) => (
                        <tr key={c.kind} className="border-t border-white/5 text-white/80">
                          <td className="py-1">{c.kind}</td>
                          <td className="py-1 text-right">{c.jobs}</td>
                          <td className="py-1 text-right">{c.scraped}</td>
                          <td className="py-1 text-right">{c.inserted}</td>
                          <td className="py-1 text-right">${c.costUsd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-white/40">{t("noData")}</p>
                )}
              </Card>

              {/* YT email */}
              <Card title={t("ytEmail")} testId="card-yt-email">
                {stats.ytEmailByStatus.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2 text-sm text-white/80">
                    {stats.ytEmailByStatus.map((s) => (
                      <li key={s.status} className="flex justify-between rounded bg-white/[0.03] px-2 py-1">
                        <span>{s.status}</span>
                        <span className="font-semibold">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/40">{t("noData")}</p>
                )}
              </Card>

              {/* Drain */}
              <Card title={t("drain")} testId="card-drain">
                <p className="text-sm text-white/80">
                  {t("manualSeedInsertedToday")}: <span className="font-semibold">{stats.drain.manualSeedInsertedToday}</span>
                </p>
                <ul className="flex flex-wrap gap-2 text-xs text-white/60">
                  {stats.drain.scrapeQueueByState.map((q) => (
                    <li key={q.state} className="rounded bg-white/[0.03] px-2 py-1">
                      {q.state}: {q.count}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Refresh backlog */}
              <Card title={t("refreshBacklog")} testId="card-refresh">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-white/40">{t("total")}</dt>
                    <dd className="text-lg font-semibold text-white">{stats.refreshBacklog.total}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">{t("dueNow")}</dt>
                    <dd className="text-lg font-semibold text-white">{stats.refreshBacklog.dueNow}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
