/**
 * BM2-F010 · `/weekly-report` page (Planner adjudication §13).
 *
 * Layout:
 *   Header (breadcrumb + title + range toggle + locale + history)
 *   → Empty state (Generate CTA) when no report yet
 *   → Brand header (logo + name + week range + PDF/Share/Regenerate)
 *   → 60/40 split: left = Executive Summary + Top Performers + Key
 *     Activity + Looking Ahead; right = Key Insights panel
 *   → Footer (Report ID + Cost + AI powered by...)
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isoWeekStartUtc } from "@/lib/weekly-report/data-assembly";
import { splitByH2 } from "@/lib/weekly-report/markdown-split";
import {
  loadRecentWeeklyReports,
  loadWeeklyReportById,
  type WeeklyReportRow,
} from "@/lib/weekly-report/persistence";

import { WeeklyReportBrandHeader } from "./WeeklyReportBrandHeader";
import { WeeklyReportEmptyState } from "./WeeklyReportEmptyState";
import { WeeklyReportHeader } from "./WeeklyReportHeader";
import { WeeklyReportInsightsPanel } from "./WeeklyReportInsightsPanel";
import { WeeklyReportPrintStyles } from "./WeeklyReportPrintStyles";
import { WeeklyReportRenderer } from "./WeeklyReportRenderer";

export const metadata = { title: "Weekly Report — KOLMatrix" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string; aiLocale?: string }>;
}

function formatWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}, ${end.getUTCFullYear()}`;
}

export default async function WeeklyReportPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { id, aiLocale: aiLocaleParam } = await searchParams;

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect(`/${locale}/login`);

  const aiLocale: "en" | "zh" =
    aiLocaleParam === "zh" || aiLocaleParam === "en"
      ? aiLocaleParam
      : locale === "zh"
        ? "zh"
        : "en";

  const [t, recent] = await Promise.all([
    getTranslations("weeklyReport"),
    loadRecentWeeklyReports(tenantId, 10),
  ]);

  // Resolve which report to render: explicit ?id wins; else most recent.
  let report: WeeklyReportRow | null = null;
  if (id) {
    report = await loadWeeklyReportById(tenantId, id);
  } else if (recent.length > 0) {
    report = await loadWeeklyReportById(tenantId, recent[0].id);
  }

  // Default "this week" target for Generate CTA (today's ISO week, UTC).
  const fallbackWeekStart = isoWeekStartUtc(new Date());
  const fallbackWeekStartIso = fallbackWeekStart.toISOString().slice(0, 10);

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="weekly-report-page"
    >
      <WeeklyReportPrintStyles />
      <WeeklyReportHeader
        locale={locale}
        pageLocale={aiLocale}
        recent={recent}
        selectedReportId={report?.id ?? null}
      />

      {!report ? (
        <WeeklyReportEmptyState
          weekStartIso={fallbackWeekStartIso}
          locale={aiLocale}
          title={t("empty.title")}
          body={t("empty.body")}
          generateLabel={t("empty.generate")}
          loadingLabel={t("empty.loading")}
          errorLabel={t("empty.error")}
        />
      ) : (
        <WeeklyReportContent
          report={report}
          locale={aiLocale}
          weekRangeLabel={formatWeekRange(report.weekStart, report.weekEnd)}
          t={t}
        />
      )}
    </div>
  );
}

interface WeeklyReportContentProps {
  report: WeeklyReportRow;
  locale: "en" | "zh";
  weekRangeLabel: string;
  t: Awaited<ReturnType<typeof getTranslations<"weeklyReport">>>;
}

function WeeklyReportContent({
  report,
  locale,
  weekRangeLabel,
  t,
}: WeeklyReportContentProps) {
  const sections = splitByH2(report.contentMd);
  const tenantSnapshot = report.summaryJson?.tenantSnapshot ?? {
    name: "—",
    logoUrl: null,
  };

  // Compose the "main column" markdown by re-stitching every H2 section
  // EXCEPT Key Insights (which renders in the right panel).
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

  const weekStartIso = report.weekStart.toISOString().slice(0, 10);
  const reportIdShort = report.id.slice(0, 8).toUpperCase();

  return (
    <>
      <WeeklyReportBrandHeader
        tenant={tenantSnapshot}
        weekRangeLabel={weekRangeLabel}
        reportId={report.id}
        aiBadge={t("brand.aiBadge")}
        downloadPdfLabel={t("actions.downloadPdf")}
        shareLabel={t("actions.share")}
        regenerateLabel={t("actions.regenerate")}
        shareToastSuccessTemplate={t("share.toastSuccess")}
        shareToastErrorTemplate={t("share.toastError")}
        weekStartIso={weekStartIso}
        locale={locale}
      />

      <section
        className="grid grid-cols-1 gap-6 lg:grid-cols-10"
        data-testid="weekly-report-section-b"
      >
        <div className="lg:col-span-6 rounded-2xl border border-white/5 bg-surface-low/60 p-6">
          {mainMarkdown ? (
            <WeeklyReportRenderer markdown={mainMarkdown} />
          ) : (
            <p className="text-sm text-on-surface-variant">
              {t("rawFallback")}
            </p>
          )}
          {/* Fallback: if H2 split missed everything, show the raw blob
              so the user always sees content (Planner §13.5 #2). */}
          {Object.keys(sections).length === 0 ? (
            <WeeklyReportRenderer markdown={report.contentMd} />
          ) : null}
        </div>
        <div className="lg:col-span-4">
          <WeeklyReportInsightsPanel
            section={sections["Key Insights"]}
            emptyLabel={t("insights.empty")}
          />
        </div>
      </section>

      <footer
        data-testid="weekly-report-footer"
        className="flex flex-col items-center gap-1 border-t border-white/5 pt-6 text-[10px] text-on-surface-variant/70"
      >
        <div className="flex items-center gap-3">
          <span>{t("footer.reportId", { id: reportIdShort })}</span>
          {report.summaryJson?.cost != null ? (
            <>
              <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
              <span>
                {t("footer.cost", {
                  amount: report.summaryJson.cost.toFixed(2),
                })}
              </span>
            </>
          ) : null}
        </div>
        <div>{t("footer.poweredBy")}</div>
      </footer>
    </>
  );
}
