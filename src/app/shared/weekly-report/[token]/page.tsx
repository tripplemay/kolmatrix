/**
 * BM2-F010 + BL-051a-F003 · `/shared/weekly-report/[token]` anonymous route.
 *
 * Three render states (BL-051a-F002 lifecycle):
 *   - valid    → renders the weekly report content (BM2 baseline)
 *   - expired  → renders metadata + "link expired" panel (no contentMd)
 *   - revoked  → renders metadata + "link revoked" panel (no contentMd)
 *   - not_found → notFound() (404, plays back as the original BM2 surface)
 *
 * The expired / revoked panels intentionally *do not* leak contentMd
 * or summaryJson per F003 acceptance — only the timestamps the recipient
 * needs to ask the owner for a fresh link. Locale comes from the
 * report row (`locale` column) so a JA-authored report still shows
 * Japanese chrome after expiry, not the default EN.
 */
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { logEvent } from "@/lib/events/log";
import { splitByH2 } from "@/lib/weekly-report/markdown-split";
import { validateShareToken } from "@/lib/weekly-report/persistence";

import { WeeklyReportInsightsPanel } from "../../../[locale]/(app)/insight/weekly-report/WeeklyReportInsightsPanel";
import { WeeklyReportPrintStyles } from "../../../[locale]/(app)/insight/weekly-report/WeeklyReportPrintStyles";
import { WeeklyReportRenderer } from "../../../[locale]/(app)/insight/weekly-report/WeeklyReportRenderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED_LOCALES = new Set(["en", "zh", "ja", "ko", "es"]);
function normaliseLocale(raw: string | undefined | null): string {
  if (!raw) return "en";
  return SUPPORTED_LOCALES.has(raw) ? raw : "en";
}

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await validateShareToken(token);
  if (result.status === "not_found") {
    // Mirror the page's notFound() so search engines + share unfurlers
    // see a generic 404 title rather than tenant brand for an unknown
    // token.
    return {
      title: "Weekly Report",
      description: "Weekly performance summary.",
      robots: { index: false, follow: false },
    };
  }
  const tenantName =
    (result.status === "valid" &&
      result.payload.summaryJson?.tenantSnapshot?.name) ||
    "Weekly Report";
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

function formatTimestamp(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function SharedWeeklyReportPage({ params }: Props) {
  const { token } = await params;
  const result = await validateShareToken(token);
  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "expired" || result.status === "revoked") {
    return renderLifecycleState(result.status, result.metadata);
  }

  const payload = result.payload;

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
            // BL-070-F010 — 64×64 explicit dims; container is h-16 w-16 already.
            // `unoptimized` tolerates user-uploaded logo CDNs without per-domain
            // remotePatterns entries.
            <Image
              src={tenantSnapshot.logoUrl}
              alt={`${tenantSnapshot.name} logo`}
              width={64}
              height={64}
              className="h-full w-full rounded-full object-cover"
              unoptimized
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
            Weekly Report · Generated{" "}
            {formatTimestamp(payload.createdAt, payload.locale)}
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

async function renderLifecycleState(
  status: "expired" | "revoked",
  metadata: { createdAt: Date; expiresAt: Date; revokedAt: Date | null; locale: string }
) {
  const locale = normaliseLocale(metadata.locale);
  const t = await getTranslations({
    locale,
    namespace: "weeklyReport.shared",
  });

  void logEvent({
    type: `weekly_report.shared_view_${status}`,
    payload: { locale },
  });

  const headingKey = status === "expired" ? "expiredTitle" : "revokedTitle";
  const bodyKey = status === "expired" ? "expiredBody" : "revokedBody";
  const iconName = status === "expired" ? "schedule" : "block";
  const accentClass =
    status === "expired"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : "border-error/40 bg-error/10 text-error";

  return (
    <div
      data-testid={`weekly-report-${status}`}
      data-status={status}
      className="mx-auto flex min-h-screen max-w-[680px] flex-col items-center justify-center gap-6 p-8 text-center"
    >
      <span
        aria-hidden
        className={`flex h-14 w-14 items-center justify-center rounded-full border ${accentClass}`}
      >
        <span className="material-symbols-outlined text-[28px]">{iconName}</span>
      </span>
      <h1 className="text-2xl font-bold text-white">{t(headingKey)}</h1>
      <p className="text-sm text-on-surface-variant">
        {t(bodyKey, {
          createdAt: formatTimestamp(metadata.createdAt, locale),
          expiresAt: formatTimestamp(metadata.expiresAt, locale),
          revokedAt: metadata.revokedAt
            ? formatTimestamp(metadata.revokedAt, locale)
            : "",
        })}
      </p>
      <p className="text-xs text-on-surface-variant/70">{t("askOwnerHint")}</p>
      <footer className="border-t border-white/5 pt-6 text-[10px] text-on-surface-variant/70">
        AI powered by KOLMatrix Neural Discovery Engine
      </footer>
    </div>
  );
}
