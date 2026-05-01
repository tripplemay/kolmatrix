/**
 * BM2-F006 · /outreach Email Center + composer page.
 *
 * Layout A1 per adjudication §12 #A:
 *   Header → Tabs (Overview active, rest disabled) → Quick Stats ×5
 *   → COMPOSER sticky mid-section (?campaignId scrolls here on load)
 *   → 30d Sending Performance chart → 3-col grid (Top templates /
 *   Recent replies / Domain health) → Recently sent table → Footer
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  runEmailQuickStats,
  runRecentReplies,
  runRecentlySent,
  runSendingPerformance30d,
  runTopTemplates,
} from "@/lib/email/analytics";
import { loadOutreachComposerData } from "@/lib/email/composer-data";

import { DomainHealthCard } from "./DomainHealthCard";
import { OutreachComposer } from "./OutreachComposer";
import { OutreachFooter } from "./OutreachFooter";
import { OutreachQuickStats } from "./OutreachQuickStats";
import { OutreachTabs } from "./OutreachTabs";
import { RecentRepliesCard } from "./RecentRepliesCard";
import { RecentlySentTable } from "./RecentlySentTable";
import { SendingPerformanceChart } from "./SendingPerformanceChart";
import { TopTemplatesCard } from "./TopTemplatesCard";

export const metadata = { title: "Email Center — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asScalar(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function OutreachPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const campaignId = asScalar(raw.campaignId) ?? null;
  // BIx-mvp-polish-pass F002 P1-4: /database BulkActionBar can route
  // here with `?kolIds=<id>,<id>` to pre-tick the composer's KOL list.
  const kolIdsRaw = asScalar(raw.kolIds);
  const preselectedKolIds = kolIdsRaw
    ? kolIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const composerLocale: "en" | "zh" = locale === "zh" ? "zh" : "en";

  const [stats, daily, topTemplates, recentReplies, recentlySent, composerData] = await Promise.all(
    [
      runEmailQuickStats(tenantId),
      runSendingPerformance30d(tenantId),
      runTopTemplates(tenantId, 3),
      runRecentReplies(tenantId, 3),
      runRecentlySent(tenantId, 10),
      loadOutreachComposerData(tenantId, campaignId, composerLocale),
    ]
  );

  const t = await getTranslations("outreach");
  const tComposer = await getTranslations("outreach.composer");
  const tStatus = await getTranslations("outreach.kolStatus");
  const tErrors = await getTranslations("outreach.errors");

  const composerLabels = {
    title: tComposer("title"),
    subtitle: tComposer("subtitle"),
    campaignLabel: tComposer("campaignLabel"),
    campaignPlaceholder: tComposer("campaignPlaceholder"),
    templateLabel: tComposer("templateLabel"),
    templatePlaceholder: tComposer("templatePlaceholder"),
    templateSystemGroup: tComposer("templateSystemGroup"),
    templateUserGroup: tComposer("templateUserGroup"),
    kolSection: tComposer("kolSection"),
    kolSelectedTemplate: tComposer.raw("kolSelected") as string,
    kolHeadSelect: tComposer("kolHeadSelect"),
    kolHeadCreator: tComposer("kolHeadCreator"),
    kolHeadEmail: tComposer("kolHeadEmail"),
    kolHeadStatus: tComposer("kolHeadStatus"),
    selectAllLabel: tComposer("selectAllLabel"),
    noSelectableKols: tComposer("noSelectableKols"),
    noEmail: tComposer("noEmail"),
    noEmailTooltip: tComposer("noEmailTooltip"),
    addEmailButton: tComposer("addEmailButton"),
    addEmailSave: tComposer("addEmailSave"),
    addEmailCancel: tComposer("addEmailCancel"),
    addEmailInvalid: tComposer("addEmailInvalid"),
    previewTitle: tComposer("previewTitle"),
    previewSubject: tComposer("previewSubject"),
    previewBody: tComposer("previewBody"),
    missingTokensWarningTemplate: tComposer.raw("missingTokensWarning") as string,
    aiCustomizeButton: tComposer("aiCustomizeButton"),
    aiCustomizeTitle: tComposer("aiCustomizeTitle"),
    aiCustomizeOriginal: tComposer("aiCustomizeOriginal"),
    aiCustomizeAi: tComposer("aiCustomizeAi"),
    aiCustomizeUseOriginal: tComposer("aiCustomizeUseOriginal"),
    aiCustomizeUseAi: tComposer("aiCustomizeUseAi"),
    aiCustomizeSaveAsTemplate: tComposer("aiCustomizeSaveAsTemplate"),
    aiCustomizeSavePending: tComposer("aiCustomizeSavePending"),
    aiCustomizeClose: tComposer("aiCustomizeClose"),
    aiCustomizePending: tComposer("aiCustomizePending"),
    sendButton: tComposer("sendButton"),
    sendPending: tComposer("sendPending"),
    resultSentCountTemplate: tComposer.raw("resultSentCount") as string,
    resultMockedCountTemplate: tComposer.raw("resultMockedCount") as string,
    resultFailedCountTemplate: tComposer.raw("resultFailedCount") as string,
    resultDismiss: tComposer("resultDismiss"),
    statusLabels: {
      pending: tStatus("pending"),
      contacted: tStatus("contacted"),
      quoted: tStatus("quoted"),
      signed: tStatus("signed"),
      delivered: tStatus("delivered"),
      paid: tStatus("paid"),
    },
    errorLabels: {
      unauthorized: tErrors("unauthorized"),
      invalid_input: tErrors("invalidInput"),
      not_found: tErrors("notFound"),
      campaign_not_found: tErrors("campaignNotFound"),
      campaign_no_product: tErrors("campaignNoProduct"),
      kol_not_found: tErrors("kolNotFound"),
      template_not_found: tErrors("templateNotFound"),
      missing_env: tErrors("missingEnv"),
      http_error: tErrors("aiHttpError"),
      invalid_response: tErrors("aiInvalidResponse"),
      timeout: tErrors("aiTimeout"),
      email_invalid: tErrors("emailInvalid"),
      db_error: tErrors("dbError"),
      generic: tErrors("generic"),
    },
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16" data-testid="outreach-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            data-testid="outreach-page-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            {t("title")}
          </h1>
          <p className="text-on-surface-variant mt-1 max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
      </header>

      <OutreachTabs locale={locale} activeTab="overview" />

      <OutreachQuickStats stats={stats} />

      <OutreachComposer
        key={campaignId ?? "no-campaign"}
        data={composerData}
        activeCampaignId={campaignId}
        preselectedKolIds={preselectedKolIds}
        locale={locale}
        labels={composerLabels}
      />

      <SendingPerformanceChart daily={daily} />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3" data-testid="outreach-bottom-row">
        <TopTemplatesCard rows={topTemplates} fallbackTemplates={composerData.templates} />
        <RecentRepliesCard rows={recentReplies} />
        <DomainHealthCard />
      </section>

      <RecentlySentTable rows={recentlySent} />

      <OutreachFooter dailyLimit={5000} sentToday={stats.sentToday} />
    </div>
  );
}
