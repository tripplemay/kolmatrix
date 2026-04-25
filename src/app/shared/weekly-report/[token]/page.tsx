/**
 * BM2-F010 · `/shared/weekly-report/[token]` anonymous route.
 *
 * - No auth required (middleware short-circuits on /shared/...)
 * - Loads via the superuser Prisma client (`db-admin`) by token
 * - SELECTs only 4 columns; tenant brand info comes out of
 *   `summaryJson.tenantSnapshot` to avoid a tenant-table join
 * - 404 when token is unknown OR `shareTokenExpiresAt` has passed
 * - <meta robots noindex> + og:title/og:description per §13.5 #3
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { logEvent } from "@/lib/events/log";
import { splitByH2 } from "@/lib/weekly-report/markdown-split";
import { loadSharedWeeklyReport } from "@/lib/weekly-report/persistence";
import { isShareTokenExpired } from "@/lib/weekly-report/share-token";

import { WeeklyReportInsightsPanel } from "../../../[locale]/(app)/weekly-report/WeeklyReportInsightsPanel";
import { WeeklyReportPrintStyles } from "../../../[locale]/(app)/weekly-report/WeeklyReportPrintStyles";
import { WeeklyReportRenderer } from "../../../[locale]/(app)/weekly-report/WeeklyReportRenderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const payload = await loadSharedWeeklyReport(token);
  const tenantName = payload?.summaryJson?.tenantSnapshot?.name ?? "Weekly Report";
  return {
    title: `${tenantName} — Weekly Report`,
    description: `Weekly performance summary for ${tenantName}.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${tenantName} — Weekly Report`,
      description: `Weekly performance summary for ${tenantName}.`,
    },
  };
}

function tenantInitials(name: string): string {
  const words = name
    .replace(/[^A-Za-z一-鿿\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatWeekRange(createdAt: Date): string {
  return createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function SharedWeeklyReportPage({ params }: Props) {
  const { token } = await params;
  const payload = await loadSharedWeeklyReport(token);
  if (!payload || isShareTokenExpired(payload.shareTokenExpiresAt)) {
    notFound();
  }

  // RSC re-runs on every request; `now` is captured once per render
  // for the telemetry payload (not for any visible state).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  void logEvent({
    type: "weekly_report.shared_view",
    payload: {
      daysUntilExpiry: Math.max(
        0,
        Math.floor(
          (payload.shareTokenExpiresAt.getTime() - nowMs) /
            (24 * 60 * 60 * 1000)
        )
      ),
    },
  });

  const tenantSnapshot = payload.summaryJson?.tenantSnapshot ?? {
    name: "—",
    logoUrl: null,
  };
  const sections = splitByH2(payload.contentMd);

  const mainHeadings = [
    "Executive Summary",
    "Top Performers",
    "Key Activity",
    "Looking Ahead",
  ];
  const mainMarkdown = mainHeadings
    .filter((h) => sections[h])
    .map((h) => `## ${h}\n${sections[h]}`)
    .join("\n\n");

  return (
    <div
      data-testid="weekly-report-page"
      className="mx-auto flex min-h-screen max-w-[1200px] flex-col gap-6 p-8"
    >
      <WeeklyReportPrintStyles />

      <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/5 bg-surface-low/60 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan bg-surface-container">
          {tenantSnapshot.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantSnapshot.logoUrl}
              alt={`${tenantSnapshot.name} logo`}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-2xl font-black text-cyan">
              {tenantInitials(tenantSnapshot.name)}
            </span>
          )}
        </div>
        <div className="flex-grow">
          <h1 className="text-2xl font-bold text-white">{tenantSnapshot.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Weekly Report · Generated {formatWeekRange(payload.createdAt)}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple">
          <span aria-hidden className="material-symbols-outlined text-[14px]">
            bolt
          </span>
          AI-Generated
        </span>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="lg:col-span-6 rounded-2xl border border-white/5 bg-surface-low/60 p-6">
          {mainMarkdown ? (
            <WeeklyReportRenderer markdown={mainMarkdown} />
          ) : (
            <WeeklyReportRenderer markdown={payload.contentMd} />
          )}
        </div>
        <div className="lg:col-span-4">
          <WeeklyReportInsightsPanel
            section={sections["Key Insights"]}
            emptyLabel="No insights for this report."
          />
        </div>
      </section>

      <footer className="border-t border-white/5 pt-6 text-center text-[10px] text-on-surface-variant/70">
        <p>AI powered by KOLMatrix Neural Discovery Engine</p>
      </footer>
    </div>
  );
}
