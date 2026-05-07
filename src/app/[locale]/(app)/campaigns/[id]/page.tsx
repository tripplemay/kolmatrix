/**
 * BM2-F005 + MVP-vf-F005 · Campaign detail page /campaigns/:id
 *
 * Layout per the Stitch campaign-detail prototype:
 *   ┌──────────────────────────────────────────────┬──────────────┐
 *   │ Breadcrumb                                    │              │
 *   │ Header (4 KPI + edit)                         │              │
 *   │ KOL panel (table + Add Dialog)                │  Right rail  │
 *   │ Email Performance chart                       │  • Health    │
 *   │ Revenue + Status grid                         │  • AI hints  │
 *   │ Outreach CTA                                  │  • Activity  │
 *   └──────────────────────────────────────────────┴──────────────┘
 *
 * The right column (320 px) hosts the three Insights cards stacked
 * vertically. Existing F005 sub-components (Header / Revenue /
 * Status / KolPanel) are untouched aside from the panel split — the
 * page-level work here is the layout grid + Insights wiring.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  runCampaignDetail,
  runAvailableKolsForCampaign,
} from "@/lib/campaigns/detail";
import { loadCampaignDetailInsights } from "@/lib/campaigns/detail-insights";

import { ActivityTimelineCard } from "./ActivityTimelineCard";
import { AiSuggestionsCard } from "./AiSuggestionsCard";
import { CampaignHeader } from "./CampaignHeader";
import { CampaignHealthCard } from "./CampaignHealthCard";
import { CampaignKolPanel } from "./CampaignKolPanel";
import { CampaignRevenueRecorder } from "./CampaignRevenueRecorder";
import { CampaignStatusController } from "./CampaignStatusController";
import { EmailPerformanceChart } from "./EmailPerformanceChart";

export const metadata = { title: "Campaign — KOLMatrix" };

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

  const [availableKols, insights] = await Promise.all([
    runAvailableKolsForCampaign(tenantId, id),
    loadCampaignDetailInsights(tenantId, id, {
      spendTotal: campaign.spendTotal,
      revenueRecorded: campaign.revenueRecorded,
      budgetAmount: campaign.budgetAmount,
      endDate: campaign.endDate,
    }),
  ]);

  const t = await getTranslations("campaigns.detail");
  const tStatus = await getTranslations("campaigns.status");
  const tKolStatus = await getTranslations("campaigns.detail.kolStatus");
  const tErrors = await getTranslations("campaigns.detail.errors");
  const tEmailChart = await getTranslations(
    "campaigns.detail.insights.emailChart"
  );
  // BL-051a-F009 — productDeleted strings live in the knowledgeBase
  // namespace because they describe a product lifecycle state, not a
  // campaign concern; loading both lets headerLabels stay
  // self-contained.
  const tKb = await getTranslations("knowledgeBase");

  const hasEmailableKols = campaign.kols.some(
    (k) => k.hasEmail && k.contactStatus !== "paid"
  );
  const outreachHref = `/${locale}/outreach?campaignId=${campaign.id}`;

  return (
    <div className="mx-auto max-w-[1600px] pb-16">
      <Breadcrumb locale={locale} name={campaign.name} label={t("breadcrumb")} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="flex min-w-0 flex-col gap-6">
          <CampaignHeader
            campaign={{
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              game: campaign.game,
              budgetAmount: campaign.budgetAmount,
              spendTotal: campaign.spendTotal,
              revenueRecorded: campaign.revenueRecorded,
              roiPercent: campaign.roiPercent,
              startDate: campaign.startDate,
              endDate: campaign.endDate,
              product: campaign.product,
              ownerName: campaign.ownerName,
              locale,
            }}
            labels={headerLabels(t, tStatus, tErrors, tKb, campaign.status)}
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

          <EmailPerformanceChart
            data={insights.emailSeries}
            labels={{
              title: tEmailChart("title"),
              empty: tEmailChart("empty"),
              contacted: tEmailChart("contacted"),
              replied: tEmailChart("replied"),
            }}
          />

          <section className="grid gap-6 lg:grid-cols-2">
            <CampaignRevenueRecorder
              campaignId={campaign.id}
              status={campaign.status}
              revenue={campaign.revenueRecorded}
              spendTotal={campaign.spendTotal}
              roiPercent={campaign.roiPercent}
              labels={revenueLabels(t)}
              errorLabels={revenueErrorLabels(tErrors)}
            />
            <CampaignStatusController
              campaignId={campaign.id}
              status={campaign.status}
              startedAt={campaign.startedAt}
              closedAt={campaign.closedAt}
              labels={statusControllerLabels(t, tStatus)}
              statusLabels={{
                draft: tStatus("draft"),
                active: tStatus("active"),
                completed: tStatus("completed"),
              }}
              errorLabels={statusErrorLabels(tErrors)}
            />
          </section>

          <OutreachCta
            href={outreachHref}
            title={t("outreach.title")}
            ready={hasEmailableKols ? t("outreach.ready") : t("outreach.noEmailable")}
            cta={t("outreach.cta")}
            enabled={hasEmailableKols}
          />
        </main>

        <aside
          className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start"
          data-testid="campaign-detail-insights"
        >
          <CampaignHealthCard health={insights.health} />
          <AiSuggestionsCard
            tenantId={tenantId}
            campaignId={campaign.id}
            locale={locale}
            uncontactedKolCount={insights.health.uncontactedKolCount}
          />
          <ActivityTimelineCard rows={insights.activity} />
        </aside>
      </div>
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
        className="transition-colors hover:text-cyan"
        data-testid="campaign-breadcrumb-campaigns"
      >
        {label}
      </Link>
      <span>/</span>
      <span className="truncate text-on-surface">{name}</span>
    </nav>
  );
}

function OutreachCta({
  href,
  title,
  ready,
  cta,
  enabled,
}: {
  href: string;
  title: string;
  ready: string;
  cta: string;
  enabled: boolean;
}) {
  return (
    <section
      className="glass-panel flex flex-col gap-3 rounded-2xl border border-on-surface/5 p-6 md:flex-row md:items-center md:justify-between"
      data-testid="campaign-outreach-cta"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{ready}</p>
      </div>
      {enabled ? (
        <Link
          href={href}
          className="gradient-cta inline-flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-bold text-on-primary"
          data-testid="campaign-outreach-link"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            forward_to_inbox
          </span>
          {cta}
        </Link>
      ) : null}
    </section>
  );
}

// ----------------------------------------------------------------------
// Label assemblers — keep page.tsx body legible by extracting the dense
// nested-prop construction used by the existing F005 children. Each
// returns a plain object (no closures cross the RSC boundary).
// ----------------------------------------------------------------------

function headerLabels(
  t: Awaited<ReturnType<typeof getTranslations>>,
  tStatus: Awaited<ReturnType<typeof getTranslations>>,
  tErrors: Awaited<ReturnType<typeof getTranslations>>,
  tKb: Awaited<ReturnType<typeof getTranslations>>,
  status: string
) {
  const statusKey =
    status === "draft" || status === "active" || status === "completed"
      ? status
      : "all";
  return {
    statusBadge: tStatus(statusKey as "all" | "draft" | "active" | "completed"),
    edit: t("edit"),
    save: t("save"),
    cancel: t("cancel"),
    kpi: {
      budget: t("kpi.budget"),
      spend: t("kpi.spend"),
      revenue: t("kpi.revenue"),
      roi: t("kpi.roi"),
    },
    fields: {
      name: t("fields.name"),
      budget: t("fields.budget"),
      startDate: t("fields.startDate"),
      endDate: t("fields.endDate"),
      game: t("fields.game"),
    },
    errors: {
      endBeforeStart: tErrors("endBeforeStart"),
      unauthorized: tErrors("unauthorized"),
      generic: tErrors("generic"),
      validation_failed: tErrors("validationFailed"),
      not_found: tErrors("notFound"),
    },
    unsetValue: t("unset"),
    productDeleted: tKb("productDeleted"),
    productDeletedTooltip: tKb("productDeletedTooltip"),
  };
}

function kolPanelLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    title: t("kolPanel.title"),
    empty: t("kolPanel.empty"),
    addButton: t("kolPanel.addButton"),
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

function kolStatusLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    pending: t("pending"),
    contacted: t("contacted"),
    quoted: t("quoted"),
    signed: t("signed"),
    delivered: t("delivered"),
    paid: t("paid"),
  };
}

function errorLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
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

function revenueLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    title: t("revenue.title"),
    lockedBody: t("revenue.lockedBody"),
    placeholder: t("revenue.placeholder"),
    save: t("revenue.save"),
    saving: t("revenue.saving"),
    clear: t("revenue.clear"),
    helper: t("revenue.helper"),
  };
}

function revenueErrorLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    revenueInvalid: t("revenueInvalid"),
    forbidden_when_completed: t("forbiddenWhenCompleted"),
    generic: t("generic"),
    not_found: t("notFound"),
    unauthorized: t("unauthorized"),
    invalid_input: t("generic"),
  };
}

function statusControllerLabels(
  t: Awaited<ReturnType<typeof getTranslations>>,
  tStatus: Awaited<ReturnType<typeof getTranslations>>
) {
  return {
    title: t("statusController.title"),
    transitionTo: {
      draft: t("statusController.transitionTo", { next: tStatus("draft") }),
      active: t("statusController.transitionTo", { next: tStatus("active") }),
      completed: t("statusController.transitionTo", { next: tStatus("completed") }),
    },
    reactivate: t("statusController.reactivate"),
    currentLabel: t("statusController.currentLabel"),
    startedAtLabel: t("statusController.startedAtLabel"),
    closedAtLabel: t("statusController.closedAtLabel"),
  };
}

function statusErrorLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    invalid_transition: t("invalidTransition"),
    not_found: t("notFound"),
    generic: t("generic"),
    unauthorized: t("unauthorized"),
    invalid_input: t("generic"),
  };
}
