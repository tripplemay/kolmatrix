/**
 * BL-066-F002 · Campaign detail page /campaigns/[id]
 *
 * Three-section AI-native layout per design-draft/bl066-campaign-detail-
 * ai-main-panel/main.html (1:1 还原 except known Stitch drifts logged
 * in README §"已知 Stitch 渲染漂移"):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Breadcrumb                                    │
 *   │ BriefSummaryPanel (status pills + 4-col grid) │
 *   │ AiRecommendationPanel skeleton (F003 = real)  │
 *   │ CampaignKolPanel (沿用; F006 = AcceptedKols)  │
 *   └──────────────────────────────────────────────┘
 *
 * Unmount (per F002 audit §裁决 #3=B; 6 files + sidebar 3 files):
 *   - CampaignHeader → replaced by BriefSummaryPanel
 *   - sidebar: AiSuggestionsCard / CampaignHealthCard / ActivityTimelineCard
 *   - inline: EmailPerformanceChart / CampaignRevenueRecorder /
 *             CampaignStatusController / OutreachCta
 *
 * Counts derivation per F002 audit §裁决 #4=B 白名单:
 *   contacted = kols.filter(k => k.contactStatus in [contacted,quoted,
 *                signed,delivered,paid]).length
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  runCampaignDetail,
  runAvailableKolsForCampaign,
} from "@/lib/campaigns/detail";

import { AiRecommendationPanel } from "./AiRecommendationPanel";
import { BriefSummaryPanel } from "./BriefSummaryPanel";
import { CampaignKolPanel } from "./CampaignKolPanel";

export const metadata = { title: "Campaign — KOLMatrix" };

const CONTACTED_STATUSES = new Set([
  "contacted",
  "quoted",
  "signed",
  "delivered",
  "paid",
]);

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CampaignDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const campaign = await runCampaignDetail(tenantId, id);
  if (!campaign) notFound();

  const availableKols = await runAvailableKolsForCampaign(tenantId, id);

  const t = await getTranslations("campaigns.detail");
  const tKolStatus = await getTranslations("campaigns.detail.kolStatus");
  const tErrors = await getTranslations("campaigns.detail.errors");

  const acceptedCount = campaign.kols.length;
  const contactedCount = campaign.kols.filter((k) =>
    CONTACTED_STATUSES.has(k.contactStatus)
  ).length;

  const productId = campaign.product?.isDeleted
    ? null
    : (campaign.product?.id ?? null);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-16">
      <Breadcrumb locale={locale} name={campaign.name} label={t("breadcrumb")} />

      <BriefSummaryPanel
        campaign={{
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          markets: campaign.markets,
          budgetAmount: campaign.budgetAmount,
          budgetCurrency: campaign.budgetCurrency,
          productTargetAudience:
            campaign.product && !campaign.product.isDeleted
              ? campaign.product.targetAudience
              : null,
        }}
        counts={{ accepted: acceptedCount, contacted: contactedCount }}
        locale={locale}
        labels={briefLabels(t)}
      />

      <AiRecommendationPanel
        productId={productId}
        campaignId={campaign.id}
        locale={locale}
        labels={aiPanelLabels(t)}
      />

      <CampaignKolPanel
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        kols={campaign.kols}
        available={availableKols}
        labels={kolPanelLabels(t)}
        statusLabels={kolStatusLabels(tKolStatus)}
        errorLabels={errorLabels(tErrors)}
      />
    </div>
  );
}

function Breadcrumb({
  locale,
  name,
  label,
}: {
  locale: string;
  name: string;
  label: string;
}) {
  return (
    <nav
      className="flex items-center gap-2 text-xs font-medium text-on-surface-variant"
      aria-label="Breadcrumb"
    >
      <Link
        href={`/${locale}/campaigns`}
        className="hover:text-cyan transition-colors"
        data-testid="campaign-breadcrumb-campaigns"
      >
        {label}
      </Link>
      <span>/</span>
      <span className="truncate text-on-surface">{name}</span>
    </nav>
  );
}

// ----------------------------------------------------------------------
// Label assemblers — plain object returns; no closures cross the RSC
// boundary (campaign-detail-fidelity.test.ts line 79 guards this).
// ----------------------------------------------------------------------

type TFn = Awaited<ReturnType<typeof getTranslations>>;

function briefLabels(t: TFn) {
  return {
    statusActive: t("brief.statusActive"),
    statusDraft: t("brief.statusDraft"),
    statusCompleted: t("brief.statusCompleted"),
    aiDrivenBadge: t("brief.aiDrivenBadge"),
    targetMarket: t("brief.targetMarket"),
    targetMarketDefault: t("brief.targetMarketDefault"),
    demographics: t("brief.demographics"),
    demographicsUnset: t("brief.demographicsUnset"),
    budget: t("brief.budget"),
    budgetUnset: t("brief.budgetUnset"),
    acceptedLabel: t("brief.acceptedLabel"),
    contactedLabel: t("brief.contactedLabel"),
    editBrief: t("brief.editBrief"),
    launchComm: t("brief.launchComm"),
  };
}

function aiPanelLabels(t: TFn) {
  return {
    empty: {
      eyebrow: t("aiPanel.empty.eyebrow"),
      heading: t("aiPanel.empty.heading"),
      body: t("aiPanel.empty.body"),
      reconnectCta: t("aiPanel.empty.reconnectCta"),
      kbCta: t("aiPanel.empty.kbCta"),
      helpLink: t("aiPanel.empty.helpLink"),
      info: t("aiPanel.empty.info"),
    },
    loading: {
      heading: t("aiPanel.loading.heading"),
      badge: t("aiPanel.loading.badge"),
      subtitle: t("aiPanel.loading.subtitle"),
      whyEyebrow: t("aiPanel.loading.whyEyebrow"),
      footer: t("aiPanel.loading.footer"),
    },
  };
}

function kolPanelLabels(t: TFn) {
  return {
    title: t("kolPanel.title"),
    empty: t("kolPanel.empty"),
    addButton: t("kolPanel.addButton"),
    aiNativeMigrationTooltip: t("kolPanel.aiNativeMigrationTooltip"),
    addDialog: {
      title: t("kolPanel.addDialog.title"),
      searchPlaceholder: t("kolPanel.addDialog.searchPlaceholder"),
      empty: t("kolPanel.addDialog.empty"),
      feeLabel: t("kolPanel.addDialog.feeLabel"),
      submit: t("kolPanel.addDialog.submit"),
      close: t("kolPanel.addDialog.close"),
    },
    columns: {
      creator: t("kolPanel.columns.creator"),
      contactStatus: t("kolPanel.columns.contactStatus"),
      fee: t("kolPanel.columns.fee"),
      actions: t("kolPanel.columns.actions"),
    },
    remove: t("kolPanel.remove"),
    removeConfirm: t("kolPanel.removeConfirm"),
  };
}

function kolStatusLabels(t: TFn) {
  return {
    pending: t("pending"),
    contacted: t("contacted"),
    quoted: t("quoted"),
    signed: t("signed"),
    delivered: t("delivered"),
    paid: t("paid"),
  };
}

function errorLabels(t: TFn) {
  return {
    campaign_not_found: t("notFound"),
    kol_not_found: t("kolNotFound"),
    link_not_found: t("linkNotFound"),
    already_linked: t("alreadyLinked"),
    invalid_fee: t("invalidFee"),
    invalid_status: t("invalidStatus"),
    feeInvalid: t("invalidFee"),
    invalid_input: t("generic"),
    unauthorized: t("unauthorized"),
    generic: t("generic"),
  };
}
