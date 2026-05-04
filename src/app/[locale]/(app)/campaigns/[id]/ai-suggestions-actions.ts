"use server";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import {
  CampaignSuggestError,
  type CampaignSuggestion,
  generateCampaignSuggestions,
} from "@/lib/campaigns/suggestions";

export type CampaignSuggestionsActionResult =
  | { ok: true; suggestions: CampaignSuggestion[]; traceId?: string }
  | { ok: false; error: string };

export async function generateCampaignSuggestionsAction(
  campaignId: string,
  locale: string
): Promise<CampaignSuggestionsActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId) return { ok: false, error: "unauthorized" };

  void logEvent({
    type: "campaign.suggestion_clicked",
    tenantId,
    actorId: userId ?? undefined,
    resourceId: campaignId,
  });

  try {
    const payload = await withTenant(tenantId, async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          name: true,
          status: true,
          game: true,
          budgetAmount: true,
          spendTotal: true,
          revenueRecorded: true,
          startDate: true,
          endDate: true,
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              uniqueSellingPoints: true,
            },
          },
        },
      });
      if (!campaign) return null;

      const pipelineRows = await tx.kolCampaign.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: { _all: true },
      });

      // BL-034 F003 defense-in-depth: even though audit_log now carries an
      // RLS policy and `tx` is pinned to this tenant via withTenant(), we
      // also filter by tenantId explicitly so a future refactor that
      // mistakenly runs this read outside withTenant cannot leak rows
      // whose resourceId happens to collide across tenants.
      const recentAudit = await tx.auditLog.findMany({
        where: {
          tenantId,
          OR: [
            { resourceType: "campaign", resourceId: campaignId },
            {
              resourceType: "kol_campaign",
              payload: { path: ["after", "campaignId"], equals: campaignId },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { action: true, createdAt: true },
      });

      return {
        campaign,
        pipelineRows,
        recentAudit,
      };
    });

    if (!payload) return { ok: false, error: "not_found" };

    const campaignMeta = {
      id: payload.campaign.id,
      name: payload.campaign.name,
      status: payload.campaign.status,
      game: payload.campaign.game,
      budgetAmount:
        payload.campaign.budgetAmount == null
          ? null
          : Number(payload.campaign.budgetAmount.toString()),
      spendTotal: Number(payload.campaign.spendTotal.toString()),
      revenueRecorded:
        payload.campaign.revenueRecorded == null
          ? null
          : Number(payload.campaign.revenueRecorded.toString()),
      startDate: payload.campaign.startDate?.toISOString() ?? null,
      endDate: payload.campaign.endDate?.toISOString() ?? null,
    };

    const pipeline = payload.pipelineRows.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));

    const recentActivity = payload.recentAudit.map((row) => ({
      action: row.action,
      createdAt: row.createdAt.toISOString(),
    }));

    const productContext = payload.campaign.product
      ? {
          id: payload.campaign.product.id,
          name: payload.campaign.product.name,
          category: payload.campaign.product.category,
          usp: payload.campaign.product.uniqueSellingPoints,
        }
      : null;

    const result = await generateCampaignSuggestions({
      locale,
      campaignMetaJson: JSON.stringify(campaignMeta),
      kolPipelineJson: JSON.stringify(pipeline),
      recentActivityJson: JSON.stringify(recentActivity),
      productContextJson: JSON.stringify(productContext),
    });

    void logEvent({
      type: "campaign.suggestions_generated",
      tenantId,
      actorId: userId ?? undefined,
      resourceId: campaignId,
      payload: {
        traceId: result.traceId ?? null,
        count: result.suggestions.length,
      },
    });

    return { ok: true, suggestions: result.suggestions, traceId: result.traceId };
  } catch (err) {
    const code = err instanceof CampaignSuggestError ? err.code : "generic";
    void logEvent({
      type: "campaign.suggestions_failed",
      tenantId,
      actorId: userId ?? undefined,
      resourceId: campaignId,
      payload: { code },
    });
    return { ok: false, error: code };
  }
}
