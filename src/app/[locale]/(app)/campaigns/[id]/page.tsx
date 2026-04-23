/**
 * BM2-F005 · Campaign detail page /campaigns/:id
 *
 * Per the pre-impl audit (docs/specs/BM2-f005-campaign-detail-preimpl-
 * audit.md §2), MVP keeps 4 sections out of Stitch's richer design:
 *   Section 1  Header + 4 KPI + breadcrumb
 *   Section 2  KOL panel (add/remove, contactStatus, kolFee)
 *   Section 3  Revenue + Status controller
 *   Section 4  "Email all KOLs with email" CTA → /outreach?campaignId=…
 *
 * All mutations live in actions.ts and map 1:1 to the REST routes
 * under /api/campaigns/[id]/... .
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  runCampaignDetail,
  runAvailableKolsForCampaign,
} from "@/lib/campaigns/detail";

import { CampaignHeader } from "./CampaignHeader";
import { CampaignKolPanel } from "./CampaignKolPanel";
import { CampaignRevenueRecorder } from "./CampaignRevenueRecorder";
import { CampaignStatusController } from "./CampaignStatusController";

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

  const availableKols = await runAvailableKolsForCampaign(tenantId, id);

  const t = await getTranslations("campaigns.detail");
  const tStatus = await getTranslations("campaigns.status");
  const tKolStatus = await getTranslations("campaigns.detail.kolStatus");
  const tErrors = await getTranslations("campaigns.detail.errors");

  const hasEmailableKols = campaign.kols.some(
    (k) => k.hasEmail && k.contactStatus !== "paid"
  );
  const outreachHref = `/${locale}/outreach?campaignId=${campaign.id}`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-16">
      <nav
        className="flex items-center gap-2 text-xs font-medium text-on-surface-variant"
        aria-label="Breadcrumb"
      >
        <Link
          href={`/${locale}/campaigns`}
          className="transition-colors hover:text-cyan"
          data-testid="campaign-breadcrumb-campaigns"
        >
          {t("breadcrumb")}
        </Link>
        <span>/</span>
        <span className="truncate text-on-surface">{campaign.name}</span>
      </nav>

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
        labels={{
          statusBadge: tStatus(
            (campaign.status === "draft" ||
            campaign.status === "active" ||
            campaign.status === "completed"
              ? campaign.status
              : "all") as "all" | "draft" | "active" | "completed"
          ),
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
        }}
      />

      <CampaignKolPanel
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        kols={campaign.kols}
        available={availableKols}
        labels={{
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
        }}
        statusLabels={{
          pending: tKolStatus("pending"),
          contacted: tKolStatus("contacted"),
          quoted: tKolStatus("quoted"),
          signed: tKolStatus("signed"),
          delivered: tKolStatus("delivered"),
          paid: tKolStatus("paid"),
        }}
        errorLabels={{
          campaign_not_found: tErrors("notFound"),
          kol_not_found: tErrors("kolNotFound"),
          link_not_found: tErrors("linkNotFound"),
          already_linked: tErrors("alreadyLinked"),
          invalid_fee: tErrors("invalidFee"),
          invalid_status: tErrors("invalidStatus"),
          feeInvalid: tErrors("invalidFee"),
          invalid_input: tErrors("generic"),
          unauthorized: tErrors("unauthorized"),
          generic: tErrors("generic"),
        }}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <CampaignRevenueRecorder
          campaignId={campaign.id}
          status={campaign.status}
          revenue={campaign.revenueRecorded}
          spendTotal={campaign.spendTotal}
          roiPercent={campaign.roiPercent}
          labels={{
            title: t("revenue.title"),
            lockedBody: t("revenue.lockedBody"),
            placeholder: t("revenue.placeholder"),
            save: t("revenue.save"),
            saving: t("revenue.saving"),
            clear: t("revenue.clear"),
            helper: t("revenue.helper"),
          }}
          errorLabels={{
            revenueInvalid: tErrors("revenueInvalid"),
            forbidden_when_completed: tErrors("forbiddenWhenCompleted"),
            generic: tErrors("generic"),
            not_found: tErrors("notFound"),
            unauthorized: tErrors("unauthorized"),
            invalid_input: tErrors("generic"),
          }}
        />

        <CampaignStatusController
          campaignId={campaign.id}
          status={campaign.status}
          startedAt={campaign.startedAt}
          closedAt={campaign.closedAt}
          labels={{
            title: t("statusController.title"),
            transitionTo: (next: string) =>
              t("statusController.transitionTo", {
                next:
                  next === "draft" || next === "active" || next === "completed"
                    ? tStatus(next)
                    : next,
              }),
            reactivate: t("statusController.reactivate"),
            currentLabel: t("statusController.currentLabel"),
            startedAtLabel: t("statusController.startedAtLabel"),
            closedAtLabel: t("statusController.closedAtLabel"),
          }}
          statusLabels={{
            draft: tStatus("draft"),
            active: tStatus("active"),
            completed: tStatus("completed"),
          }}
          errorLabels={{
            invalid_transition: tErrors("invalidTransition"),
            not_found: tErrors("notFound"),
            generic: tErrors("generic"),
            unauthorized: tErrors("unauthorized"),
            invalid_input: tErrors("generic"),
          }}
        />
      </section>

      <section
        className="glass-panel flex flex-col gap-3 rounded-2xl border border-on-surface/5 p-6 md:flex-row md:items-center md:justify-between"
        data-testid="campaign-outreach-cta"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">
            {t("outreach.title")}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {hasEmailableKols
              ? t("outreach.ready")
              : t("outreach.noEmailable")}
          </p>
        </div>
        {hasEmailableKols ? (
          <Link
            href={outreachHref}
            className="gradient-cta inline-flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-bold text-on-primary"
            data-testid="campaign-outreach-link"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden
            >
              forward_to_inbox
            </span>
            {t("outreach.cta")}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
