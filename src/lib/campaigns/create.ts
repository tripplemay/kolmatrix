/**
 * BM2-F004 · Tenant-scoped campaign create helper.
 *
 * Wraps Prisma + RLS + event_log into one transactional unit so every
 * entry path (Server Action, POST /api/campaigns, later bulk imports)
 * produces the same shape of records and side-effects.
 *
 * The campaign is created with status='draft' and spendTotal=0 per
 * spec §F004. event_log receives a `campaign.created` row
 * (fire-and-forget — failures there don't roll back the campaign).
 */
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

import type { CreateCampaignInput } from "./schema";

export interface CreateCampaignResult {
  id: string;
}

export class CampaignCreateError extends Error {
  constructor(
    public readonly code:
      | "product_not_found"
      | "db_error",
    message: string
  ) {
    super(message);
    this.name = "CampaignCreateError";
  }
}

export async function createCampaignRecord(
  tenantId: string,
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  try {
    const campaign = await withTenant(tenantId, async (tx) => {
      // Pre-check product ownership so we return a clean error rather
      // than leaking Prisma's P2003 foreign-key stack trace. The RLS
      // policy on `product` already ensures cross-tenant products are
      // invisible, so findUnique within withTenant handles both cases.
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });
      if (!product) {
        throw new CampaignCreateError(
          "product_not_found",
          `product ${input.productId} not found for tenant ${tenantId}`
        );
      }

      return tx.campaign.create({
        data: {
          tenantId,
          name: input.name,
          productId: input.productId,
          status: "draft",
          spendTotal: "0",
          budgetAmount:
            input.budgetAmount == null
              ? null
              : input.budgetAmount.toFixed(2),
          budgetCurrency: "USD",
          startDate: input.startDate,
          endDate: input.endDate,
          ownerUserId: input.ownerUserId,
          game: input.game,
          markets: input.markets,
          // kpi_target is JSONB; stash the free-text brief under a
          // stable key so future structured targets can land next to it
          // without a schema migration. Prisma wants the field omitted
          // when empty rather than set to null (NullableJsonNullValue).
          ...(input.kpiTarget == null
            ? {}
            : { kpiTarget: { brief: input.kpiTarget } }),
        },
        select: { id: true },
      });
    });

    void logEvent({
      type: "campaign.created",
      tenantId,
      actorId: input.ownerUserId,
      resourceId: campaign.id,
      payload: {
        productId: input.productId,
        hasBudget: input.budgetAmount != null,
      },
    });

    return { id: campaign.id };
  } catch (err) {
    if (err instanceof CampaignCreateError) throw err;
    console.error("[createCampaignRecord] failed:", err);
    throw new CampaignCreateError("db_error", "failed to create campaign");
  }
}
