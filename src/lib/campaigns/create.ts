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
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

import type { CreateCampaignInput } from "./schema";

export interface CreateCampaignResult {
  id: string;
}

/**
 * BL-069-F005 extension fields. Optional — BL-066 callers (Server
 * Action + /api/campaigns) pass `CreateCampaignInput` unchanged and
 * land in the back-compat path (budgetCurrency="USD", no briefMeta).
 */
export interface CreateCampaignExtras {
  /** ISO-4217 three-letter currency code. Defaults to "USD" (BL-066
   *  back-compat) when omitted; brief parser passes "CNY"/"JPY"/etc. */
  budgetCurrency?: string;
  /** Free-form brief metadata stashed in kpi_target JSON. F005 uses
   *  this to persist the LLM-parsed targetAudience + categories that
   *  Campaign schema doesn't have dedicated columns for. */
  briefMeta?: {
    targetAudience?: string;
    categories?: string[];
  };
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
  input: CreateCampaignInput,
  extras: CreateCampaignExtras = {}
): Promise<CreateCampaignResult> {
  try {
    const campaign = await withTenant(tenantId, async (tx) => {
      // Pre-check product ownership so we return a clean error rather
      // than leaking Prisma's P2003 foreign-key stack trace. The RLS
      // policy on `product` already ensures cross-tenant products are
      // invisible, so findUnique within withTenant handles both cases.
      // BL-051a-F007 — soft-deleted products can't anchor new
      // campaigns. findFirst layers deletedAt: null on top of the
      // unique id constraint.
      const product = await tx.product.findFirst({
        where: { id: input.productId, deletedAt: null },
        select: { id: true },
      });
      if (!product) {
        throw new CampaignCreateError(
          "product_not_found",
          `product ${input.productId} not found for tenant ${tenantId}`
        );
      }

      // kpi_target JSON — merges BM2's `brief` slot (free-text KPI
      // brief) with the BL-069-F005 extras (targetAudience + categories
      // from the LLM brief parser). Prisma wants the whole field
      // omitted (rather than set to null) when no keys would land, so
      // we accumulate keys into `kpiBuilder` (mutable record) and cast
      // to InputJsonValue at assignment time.
      const kpiBuilder: Record<string, unknown> = {};
      if (input.kpiTarget != null) kpiBuilder.brief = input.kpiTarget;
      if (extras.briefMeta?.targetAudience) {
        kpiBuilder.targetAudience = extras.briefMeta.targetAudience;
      }
      if (extras.briefMeta?.categories && extras.briefMeta.categories.length > 0) {
        kpiBuilder.categories = extras.briefMeta.categories;
      }
      const kpiPayload = kpiBuilder as Prisma.InputJsonValue;

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
          budgetCurrency: extras.budgetCurrency ?? "USD",
          startDate: input.startDate,
          endDate: input.endDate,
          ownerUserId: input.ownerUserId,
          game: input.game,
          markets: input.markets,
          ...(Object.keys(kpiBuilder).length === 0
            ? {}
            : { kpiTarget: kpiPayload }),
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
