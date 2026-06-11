/**
 * BL-105-F001 · /campaigns/[id]/edit
 *
 * Restores the campaign-edit entry point removed in BL-070-F005 (audit
 * M1: updateCampaignFieldsAction et al. were left UI-less). Per ADR-013
 * the detail page stays AI-native read-only; all campaign-level edits
 * live here on a dedicated page. This page also resolves H6 — the
 * BriefSummaryPanel "Edit Brief" link already targets this route, so its
 * existence ends the 404.
 *
 * Gate: tenant scoping (RLS) + owner/admin (canEditCampaign). A tenant
 * member who is neither owner nor admin is redirected back to the
 * read-only detail page; a missing / cross-tenant campaign 404s.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { runCampaignDetail } from "@/lib/campaigns/detail";
import { CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/status";
import { isAllowedStatusTransition } from "@/lib/campaigns/update";

import { CampaignEditForm } from "./CampaignEditForm";
import { CampaignRevenueControl } from "./CampaignRevenueControl";
import { CampaignStatusControl } from "./CampaignStatusControl";
import { editErrorLabels } from "./error-labels";
import { canEditCampaign } from "./permissions";

export const metadata = { title: "Edit campaign — KOLMatrix" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CampaignEditPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  if (!UUID_RE.test(id)) notFound();

  const campaign = await runCampaignDetail(tenantId, id);
  if (!campaign) notFound();

  // Owner/admin gate — a non-owner non-admin tenant member can still view
  // the read-only detail, so send them back there rather than 404.
  if (!canEditCampaign(campaign.ownerUserId, session?.user?.id, session?.user?.role)) {
    redirect(`/${locale}/campaigns/${id}`);
  }

  const t = await getTranslations("campaigns.edit");
  const tStatus = await getTranslations("campaigns.status");

  // Single source of truth for allowed transitions = the lib guard;
  // computed server-side so the client control ships no server code.
  const allowedNext = CAMPAIGN_STATUS_VALUES.filter(
    (s) => s !== campaign.status && isAllowedStatusTransition(campaign.status, s),
  );
  const statusNames: Record<string, string> = {
    draft: tStatus("draft"),
    active: tStatus("active"),
    completed: tStatus("completed"),
  };
  const errors = editErrorLabels(t);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <nav
        className="flex items-center gap-2 text-xs font-medium text-on-surface-variant"
        aria-label="Breadcrumb"
      >
        <Link
          href={`/${locale}/campaigns/${id}`}
          className="hover:text-cyan transition-colors"
          data-testid="campaign-edit-breadcrumb"
        >
          {t("backToCampaign")}
        </Link>
        <span>/</span>
        <span className="truncate text-on-surface">{campaign.name}</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1
          data-testid="campaign-edit-title"
          className="text-2xl font-bold tracking-tight text-white"
        >
          {t("title")}
        </h1>
        <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
      </header>

      <CampaignEditForm
        campaign={{
          id: campaign.id,
          name: campaign.name,
          budgetAmount: campaign.budgetAmount,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          game: campaign.game,
        }}
        labels={{
          fields: {
            name: t("fields.name"),
            budgetAmount: t("fields.budgetAmount"),
            startDate: t("fields.startDate"),
            endDate: t("fields.endDate"),
            game: t("fields.game"),
          },
          save: t("save"),
          saving: t("saving"),
          saved: t("saved"),
          errors,
        }}
      />

      <CampaignStatusControl
        campaignId={campaign.id}
        current={campaign.status}
        allowedNext={allowedNext}
        labels={{
          label: t("statusControl.label"),
          current: t("statusControl.current"),
          moveToTemplate: t.raw("statusControl.moveTo") as string,
          applying: t("statusControl.applying"),
          updated: t("statusControl.updated"),
          noTransitions: t("statusControl.noTransitions"),
          statusNames,
          errors,
        }}
      />

      <CampaignRevenueControl
        campaignId={campaign.id}
        currentRevenue={campaign.revenueRecorded}
        locked={campaign.status === "completed"}
        labels={{
          label: t("revenue.label"),
          hint: t("revenue.hint"),
          lockedHint: t("revenue.lockedHint"),
          save: t("revenue.save"),
          saving: t("revenue.saving"),
          saved: t("revenue.saved"),
          errors,
        }}
      />
    </div>
  );
}
