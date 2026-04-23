/**
 * BM2-F005 · KolCampaign CRUD with transactional spendTotal recompute.
 *
 * Per audit §2 #H we recompute spendTotal inside the same withTenant
 * transaction as the KOL change rather than leaning on a DB trigger —
 * "避免隐形魔法" (spec §F005).
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

import {
  KOL_CAMPAIGN_STATUS_VALUES,
  type KolCampaignStatus,
} from "./kol-campaign-status";

export class CampaignKolError extends Error {
  constructor(
    public readonly code:
      | "campaign_not_found"
      | "kol_not_found"
      | "link_not_found"
      | "already_linked"
      | "invalid_status"
      | "invalid_fee"
      | "db_error",
    message: string
  ) {
    super(message);
    this.name = "CampaignKolError";
  }
}

function recomputeSpendTotal(kolFees: Array<Prisma.Decimal | null>): number {
  let total = 0;
  for (const fee of kolFees) {
    if (fee == null) continue;
    total += Number(fee.toString());
  }
  // Round to cents to keep the stored value tidy.
  return Math.round(total * 100) / 100;
}

async function syncCampaignSpend(
  tx: Prisma.TransactionClient,
  campaignId: string
): Promise<number> {
  const fees = await tx.kolCampaign.findMany({
    where: { campaignId },
    select: { kolFee: true },
  });
  const total = recomputeSpendTotal(fees.map((f) => f.kolFee));
  await tx.campaign.update({
    where: { id: campaignId },
    data: { spendTotal: total.toFixed(2) },
  });
  return total;
}

export async function addKolToCampaign(
  tenantId: string,
  actorId: string,
  campaignId: string,
  input: { kolId: string; kolFee?: number | null }
): Promise<{ kolCampaignId: string; newSpendTotal: number }> {
  if (input.kolFee != null && (input.kolFee < 0 || !Number.isFinite(input.kolFee))) {
    throw new CampaignKolError("invalid_fee", "fee must be >= 0");
  }

  try {
    return await withTenant(tenantId, async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new CampaignKolError("campaign_not_found", "campaign not found");
      }
      const kol = await tx.kol.findUnique({
        where: { id: input.kolId },
        select: { id: true },
      });
      if (!kol) {
        throw new CampaignKolError("kol_not_found", "kol not found");
      }
      const existing = await tx.kolCampaign.findUnique({
        where: {
          tenantId_kolId_campaignId: {
            tenantId,
            kolId: input.kolId,
            campaignId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new CampaignKolError(
          "already_linked",
          "kol is already in this campaign"
        );
      }

      const link = await tx.kolCampaign.create({
        data: {
          tenantId,
          campaignId,
          kolId: input.kolId,
          status: "pending",
          kolFee:
            input.kolFee == null || input.kolFee === 0
              ? null
              : input.kolFee.toFixed(2),
        },
        select: { id: true },
      });

      const newSpendTotal = await syncCampaignSpend(tx, campaignId);

      void logAudit({
        actorId,
        action: "campaign.kol.added",
        targetType: "kol_campaign",
        targetId: link.id,
        tenantId,
        after: {
          campaignId,
          kolId: input.kolId,
          kolFee: input.kolFee ?? null,
        },
      });

      return { kolCampaignId: link.id, newSpendTotal };
    });
  } catch (err) {
    if (err instanceof CampaignKolError) throw err;
    console.error("[addKolToCampaign] failed:", err);
    throw new CampaignKolError("db_error", "failed to add kol");
  }
}

export async function removeKolFromCampaign(
  tenantId: string,
  actorId: string,
  campaignId: string,
  kolId: string
): Promise<{ newSpendTotal: number }> {
  try {
    return await withTenant(tenantId, async (tx) => {
      const link = await tx.kolCampaign.findUnique({
        where: {
          tenantId_kolId_campaignId: { tenantId, kolId, campaignId },
        },
        select: { id: true, status: true, kolFee: true },
      });
      if (!link) {
        throw new CampaignKolError("link_not_found", "kol not in campaign");
      }

      await tx.kolCampaign.delete({ where: { id: link.id } });
      const newSpendTotal = await syncCampaignSpend(tx, campaignId);

      void logAudit({
        actorId,
        action: "campaign.kol.removed",
        targetType: "kol_campaign",
        targetId: link.id,
        tenantId,
        before: {
          kolId,
          status: link.status,
          kolFee: link.kolFee == null ? null : Number(link.kolFee.toString()),
        },
      });

      return { newSpendTotal };
    });
  } catch (err) {
    if (err instanceof CampaignKolError) throw err;
    console.error("[removeKolFromCampaign] failed:", err);
    throw new CampaignKolError("db_error", "failed to remove kol");
  }
}

interface UpdateKolCampaignPatch {
  contactStatus?: string;
  kolFee?: number | null;
}

export async function updateKolCampaign(
  tenantId: string,
  actorId: string,
  campaignId: string,
  kolId: string,
  patch: UpdateKolCampaignPatch
): Promise<{ newSpendTotal: number }> {
  if (
    patch.contactStatus !== undefined &&
    !(KOL_CAMPAIGN_STATUS_VALUES as readonly string[]).includes(
      patch.contactStatus
    )
  ) {
    throw new CampaignKolError("invalid_status", "unknown status");
  }
  if (
    patch.kolFee != null &&
    (patch.kolFee < 0 || !Number.isFinite(patch.kolFee))
  ) {
    throw new CampaignKolError("invalid_fee", "fee must be >= 0");
  }

  try {
    return await withTenant(tenantId, async (tx) => {
      const current = await tx.kolCampaign.findUnique({
        where: {
          tenantId_kolId_campaignId: { tenantId, kolId, campaignId },
        },
        select: { id: true, status: true, kolFee: true },
      });
      if (!current) {
        throw new CampaignKolError("link_not_found", "kol not in campaign");
      }

      const data: Prisma.KolCampaignUpdateInput = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      let statusChanged = false;
      let feeChanged = false;

      if (
        patch.contactStatus !== undefined &&
        patch.contactStatus !== current.status
      ) {
        before.status = current.status;
        after.status = patch.contactStatus;
        data.status = patch.contactStatus;
        statusChanged = true;
      }
      if (patch.kolFee !== undefined) {
        const currentFee =
          current.kolFee == null ? null : Number(current.kolFee.toString());
        const nextFee =
          patch.kolFee == null || patch.kolFee === 0 ? null : patch.kolFee;
        if (currentFee !== nextFee) {
          before.kolFee = currentFee;
          after.kolFee = nextFee;
          data.kolFee = nextFee == null ? null : nextFee.toFixed(2);
          feeChanged = true;
        }
      }

      if (!statusChanged && !feeChanged) {
        // No-op — still recompute spend so callers always get the
        // latest server-side total (cheap, single query).
        const total = await syncCampaignSpend(tx, campaignId);
        return { newSpendTotal: total };
      }

      await tx.kolCampaign.update({ where: { id: current.id }, data });
      const newSpendTotal = await syncCampaignSpend(tx, campaignId);

      if (statusChanged) {
        void logAudit({
          actorId,
          action: "campaign.kol.status_changed",
          targetType: "kol_campaign",
          targetId: current.id,
          tenantId,
          before: { status: before.status },
          after: { status: after.status },
        });
      }
      if (feeChanged) {
        void logAudit({
          actorId,
          action: "campaign.kol.fee_updated",
          targetType: "kol_campaign",
          targetId: current.id,
          tenantId,
          before: { kolFee: before.kolFee },
          after: { kolFee: after.kolFee },
        });
      }

      return { newSpendTotal };
    });
  } catch (err) {
    if (err instanceof CampaignKolError) throw err;
    console.error("[updateKolCampaign] failed:", err);
    throw new CampaignKolError("db_error", "failed to update kol");
  }
}

export function coerceKolCampaignStatus(s: string): KolCampaignStatus {
  if ((KOL_CAMPAIGN_STATUS_VALUES as readonly string[]).includes(s)) {
    return s as KolCampaignStatus;
  }
  return "pending";
}
