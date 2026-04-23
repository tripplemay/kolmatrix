/**
 * BM2-F005 · Campaign field-edit + status / revenue transitions.
 *
 * All paths are transactional and emit `audit_log` via BI4-F003.
 * Status transitions live here too because "completed" toggles
 * affect both `closedAt` bookkeeping and the revenue-editor lock.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { logAudit } from "@/lib/audit/log";

import { CAMPAIGN_STATUS_VALUES } from "./status";

export class CampaignUpdateError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_transition"
      | "forbidden_when_completed"
      | "db_error",
    message: string
  ) {
    super(message);
    this.name = "CampaignUpdateError";
  }
}

/**
 * Direction-guarded status transitions.
 *
 * Allowed edges:
 *   draft → active
 *   active → completed
 *   completed → active    (Reactivate — unlocks revenue editor)
 *
 * All other pairs throw `invalid_transition` so the audit trail stays
 * meaningful. Same-state transitions are no-ops (skipped).
 */
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: ["active"],
};

export function isAllowedStatusTransition(
  current: string,
  next: string
): boolean {
  if (current === next) return true;
  return (ALLOWED_TRANSITIONS[current] ?? []).includes(next);
}

const dateSchema = z
  .union([z.date(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v instanceof Date) return v;
    if (v === "") return null;
    return new Date(v);
  });

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  budgetAmount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === "") return null;
      const n = typeof v === "string" ? Number(v) : v;
      if (Number.isNaN(n)) throw new Error("budgetInvalid");
      return n;
    }),
  startDate: dateSchema,
  endDate: dateSchema,
  game: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim().length === 0 ? null : v.trim())),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/**
 * Inline field edit (Header pencil button). Does NOT touch status,
 * spendTotal, or revenue — those have dedicated helpers below.
 */
export async function updateCampaignFields(
  tenantId: string,
  actorId: string,
  id: string,
  patch: UpdateCampaignInput
): Promise<void> {
  try {
    await withTenant(tenantId, async (tx) => {
      const current = await tx.campaign.findUnique({
        where: { id },
        select: {
          name: true,
          budgetAmount: true,
          startDate: true,
          endDate: true,
          game: true,
        },
      });
      if (!current) {
        throw new CampaignUpdateError("not_found", "campaign not found");
      }

      const data: Prisma.CampaignUpdateInput = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      if (patch.name !== undefined && patch.name !== current.name) {
        before.name = current.name;
        after.name = patch.name;
        data.name = patch.name;
      }
      if (patch.budgetAmount !== undefined) {
        const currentBudget =
          current.budgetAmount == null
            ? null
            : Number(current.budgetAmount.toString());
        if (patch.budgetAmount !== currentBudget) {
          before.budgetAmount = currentBudget;
          after.budgetAmount = patch.budgetAmount;
          data.budgetAmount =
            patch.budgetAmount == null ? null : patch.budgetAmount.toFixed(2);
        }
      }
      if (patch.startDate !== undefined) {
        const cur = current.startDate ? current.startDate.toISOString() : null;
        const nxt = patch.startDate ? patch.startDate.toISOString() : null;
        if (cur !== nxt) {
          before.startDate = cur;
          after.startDate = nxt;
          data.startDate = patch.startDate;
        }
      }
      if (patch.endDate !== undefined) {
        const cur = current.endDate ? current.endDate.toISOString() : null;
        const nxt = patch.endDate ? patch.endDate.toISOString() : null;
        if (cur !== nxt) {
          before.endDate = cur;
          after.endDate = nxt;
          data.endDate = patch.endDate;
        }
      }
      if (patch.game !== undefined && patch.game !== current.game) {
        before.game = current.game;
        after.game = patch.game;
        data.game = patch.game;
      }

      if (Object.keys(data).length === 0) return; // nothing changed

      await tx.campaign.update({ where: { id }, data });

      void logAudit({
        actorId,
        action: "campaign.fields_updated",
        targetType: "campaign",
        targetId: id,
        tenantId,
        before,
        after,
      });
    });
  } catch (err) {
    if (err instanceof CampaignUpdateError) throw err;
    console.error("[updateCampaignFields] failed:", err);
    throw new CampaignUpdateError("db_error", "failed to update campaign");
  }
}

export async function transitionCampaignStatus(
  tenantId: string,
  actorId: string,
  id: string,
  next: (typeof CAMPAIGN_STATUS_VALUES)[number]
): Promise<void> {
  try {
    await withTenant(tenantId, async (tx) => {
      const current = await tx.campaign.findUnique({
        where: { id },
        select: { status: true, startedAt: true, closedAt: true },
      });
      if (!current) {
        throw new CampaignUpdateError("not_found", "campaign not found");
      }
      if (!isAllowedStatusTransition(current.status, next)) {
        throw new CampaignUpdateError(
          "invalid_transition",
          `${current.status} → ${next} not allowed`
        );
      }
      if (current.status === next) return; // no-op

      const data: Prisma.CampaignUpdateInput = { status: next };
      if (next === "active" && !current.startedAt) {
        data.startedAt = new Date();
      }
      if (next === "completed") {
        data.closedAt = new Date();
      }
      if (next === "active" && current.status === "completed") {
        // Reactivate: clear closedAt so the list page stops marking it
        // completed-and-done.
        data.closedAt = null;
      }

      await tx.campaign.update({ where: { id }, data });
    });

    void logAudit({
      actorId,
      action: "campaign.status_transitioned",
      targetType: "campaign",
      targetId: id,
      tenantId,
      after: { status: next },
    });
    void logEvent({
      type: `campaign.${next}`,
      tenantId,
      actorId,
      resourceId: id,
    });
  } catch (err) {
    if (err instanceof CampaignUpdateError) throw err;
    console.error("[transitionCampaignStatus] failed:", err);
    throw new CampaignUpdateError("db_error", "failed to transition status");
  }
}

/**
 * Record / clear revenue for a completed campaign. While status !=
 * completed the caller may freely update; status == completed locks
 * writes (the UI must Reactivate first, which the helper above
 * switches back to `active`).
 */
export async function recordCampaignRevenue(
  tenantId: string,
  actorId: string,
  id: string,
  revenue: number | null
): Promise<void> {
  try {
    await withTenant(tenantId, async (tx) => {
      const current = await tx.campaign.findUnique({
        where: { id },
        select: { status: true, revenueRecorded: true },
      });
      if (!current) {
        throw new CampaignUpdateError("not_found", "campaign not found");
      }
      if (current.status === "completed") {
        throw new CampaignUpdateError(
          "forbidden_when_completed",
          "revenue is locked while status=completed"
        );
      }
      const currentRevenue =
        current.revenueRecorded == null
          ? null
          : Number(current.revenueRecorded.toString());
      if (currentRevenue === revenue) return;

      await tx.campaign.update({
        where: { id },
        data: {
          revenueRecorded: revenue == null ? null : revenue.toFixed(2),
        },
      });

      void logAudit({
        actorId,
        action: "campaign.revenue_recorded",
        targetType: "campaign",
        targetId: id,
        tenantId,
        before: { revenueRecorded: currentRevenue },
        after: { revenueRecorded: revenue },
      });
    });
  } catch (err) {
    if (err instanceof CampaignUpdateError) throw err;
    console.error("[recordCampaignRevenue] failed:", err);
    throw new CampaignUpdateError("db_error", "failed to record revenue");
  }
}
