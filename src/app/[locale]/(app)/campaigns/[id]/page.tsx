/**
 * BL-066-F002 · Campaign detail page /campaigns/[id]
 *
 * Three-section AI-native layout per design-draft/bl066-campaign-detail-
 * ai-main-panel/main.html:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Breadcrumb                                    │
 *   │ BriefSummaryPanel (status pills + 4-col grid) │
 *   │ AiRecommendationPanel (smart-match top 30)    │
 *   │ AcceptedKolsPanel (read-only + source chip)   │
 *   └──────────────────────────────────────────────┘
 *
 * BL-070-F005 二次清理 — deleted the 6 unmount components
 * (CampaignHealthCard / ActivityTimelineCard / EmailPerformanceChart{,Impl}
 * / CampaignRevenueRecorder / CampaignStatusController) + detail-insights
 * loader that BL-066-F002 retired with `_deprecated_by_BL-066` markers.
 *
 * Counts derivation per F002 audit §裁决 #4=B 白名单:
 *   contacted = kols.filter(k => k.contactStatus in [contacted,quoted,
 *                signed,delivered,paid]).length
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { runCampaignDetail } from "@/lib/campaigns/detail";

import { AcceptedKolsPanel } from "./AcceptedKolsPanel";
import { AiRecommendationPanel } from "./AiRecommendationPanel";
import { BriefSummaryPanel } from "./BriefSummaryPanel";

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

// Campaign.id is a UUID v4 — `c[id]` accepts any string segment but
// only UUID-shaped values reach Prisma. BL-070-F004 retired the
// /campaigns/new explicit route, so `/campaigns/new` now falls through
// to this dynamic segment; without the guard, `findFirst({ id: 'new' })`
// raises a Prisma "invalid input syntax for type uuid" 500. Anything
// non-UUID notFound()s here so the legacy /campaigns/new URL surfaces
// the framework 404 instead.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  if (!UUID_RE.test(id)) notFound();

  const campaign = await runCampaignDetail(tenantId, id);
  if (!campaign) notFound();

  const t = await getTranslations("campaigns.detail");
  const tKolStatus = await getTranslations("campaigns.detail.kolStatus");

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
        tenantId={tenantId}
        locale={locale}
        labels={aiPanelLabels(t)}
      />

      <AcceptedKolsPanel
        locale={locale}
        kols={campaign.kols}
        labels={kolPanelLabels(t)}
        statusLabels={kolStatusLabels(tKolStatus)}
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
    active: {
      heading: t("aiPanel.active.heading"),
      sourcedFrom: t("aiPanel.active.sourcedFrom"),
      showNext: t("aiPanel.active.showNext"),
      whyPrefix: t("aiPanel.active.whyPrefix"),
      // BL-066 i18n template hotfix (CI FORMATTING_ERROR fix, 2026-05-16) —
      // per generator.md §"i18n template 使用约定 (v0.9.21)": templates with
      // `{matchScore}` / `{valueScore}` placeholders are client-side .replace
      // tokens, NOT ICU placeholders. Must use t.raw() to bypass the ICU
      // formatter; otherwise server SSR throws on the unbound placeholder.
      whyTemplate: t.raw("aiPanel.active.whyTemplate"),
      acceptCta: t("aiPanel.active.acceptCta"),
      skipCta: t("aiPanel.active.skipCta"),
      viewProfileCta: t("aiPanel.active.viewProfileCta"),
      followers: t("aiPanel.active.followers"),
      matchScore: t("aiPanel.active.matchScore"),
      noScore: t("aiPanel.active.noScore"),
      errorBanner: t("aiPanel.active.errorBanner"),
      retryCta: t("aiPanel.active.retryCta"),
      exhaustedBody: t("aiPanel.active.exhaustedBody"),
      // BL-067-F003 — `?` icon aria-label. Lives under `campaigns.detail.explainability.*`
      // namespace (per F006 spec) rather than the panel's own subtree so future
      // explainability keys can stack alongside it without re-namespacing.
      queryButtonLabel: t("explainability.queryButtonLabel"),
      // BL-070-F001 — Match→Reach 衔接 toast. `acceptToastMessage`
      // carries a `{handle}` placeholder consumed by client-side
      // String.replace at render time (per i18n template sediment
      // v0.9.21), so we read it via t.raw() to bypass the ICU
      // formatter — otherwise SSR throws on the unbound placeholder.
      acceptToastMessage: t.raw("aiPanel.active.acceptToastMessage") as string,
      acceptToastCta: t("aiPanel.active.acceptToastCta"),
      acceptToastDismiss: t("aiPanel.active.acceptToastDismiss"),
    },
    // BL-067-F004 — DetailedExplanationDialog labels. Title uses
    // `t.raw(...)` (template with `{handle}` placeholder; client-side
    // String.replace at render time per role-context i18n template
    // sediment v0.9.21).
    explainabilityDialog: {
      dialogTitle: t.raw("explainability.dialogTitle") as string,
      loading: t("explainability.loading"),
      unavailable: t("explainability.unavailable"),
      capExhaustedToast: t("explainability.capExhaustedToast"),
      closeCta: t("explainability.closeCta"),
      segments: {
        matchScore: { title: t("explainability.segments.matchScore.title") },
        categoryFit: { title: t("explainability.segments.categoryFit.title") },
        recentActivity: {
          title: t("explainability.segments.recentActivity.title"),
        },
        audienceFit: {
          title: t("explainability.segments.audienceFit.title"),
        },
        brandHistory: {
          title: t("explainability.segments.brandHistory.title"),
        },
      },
    },
    // BL-068-F003 — RefineInputBar labels. All keys are plain strings
    // (no ICU placeholders), so regular t() is correct; the dynamic
    // refine feedback content comes from the server action's `feedback`
    // field rendered as-is.
    refine: {
      inputPlaceholder: t("refine.inputPlaceholder"),
      applyButton: t("refine.applyButton"),
      resetButton: t("refine.resetButton"),
      loading: t("refine.loading"),
      feedbackPrefix: t("refine.feedbackPrefix"),
      unparsableToast: t("refine.unparsableToast"),
      capExhaustedToast: t("refine.capExhaustedToast"),
      networkError: t("refine.networkError"),
      permutationInvalid: t("refine.permutationInvalid"),
    },
  };
}

function kolPanelLabels(t: TFn) {
  return {
    title: t("kolPanel.title"),
    empty: t("kolPanel.empty"),
    columns: {
      creator: t("kolPanel.columns.creator"),
      source: t("kolPanel.columns.source"),
      contactStatus: t("kolPanel.columns.contactStatus"),
      fee: t("kolPanel.columns.fee"),
      addedAt: t("kolPanel.columns.addedAt"),
      actions: t("kolPanel.columns.actions"),
    },
    sourceChip: {
      ai: t("kolPanel.sourceChip.ai"),
      csv: t("kolPanel.sourceChip.csv"),
      legacy: t("kolPanel.sourceChip.legacy"),
    },
    viewProfile: t("kolPanel.viewProfile"),
    feeUnset: t("kolPanel.feeUnset"),
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
