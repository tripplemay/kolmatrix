"use server";

/**
 * BL-084-F005 · AI Match Panel decision actions (ADR-016 lifecycle).
 *
 *   acceptKolToCampaign  — suggested → accepted (source ai_smart_match)
 *   skipKolFromCampaign  — suggested → skipped  (excluded from future suggestions)
 *   swapKolToSwapPool    — suggested → swap_pool (候补列)
 *   reAddToSuggested     — swap_pool → suggested pool (DELETE row, F006 drag-back)
 *   undoLastDecision     — revert a decision within 5s (DELETE row + audit)
 *
 * Atomicity: withTenant() opens ONE $transaction with the tenant GUC set,
 * so the kol_campaign upsert + audit_log insert in each action's callback
 * commit or roll back together (spec §F005). Cache invalidation runs
 * after commit; it is best-effort.
 *
 * Constants / result types live in ./suggestion-actions.shared.
 */
import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { invalidateCampaignSuggestionsCache } from "@/lib/match/suggestions-cache";

import {
  UNDO_WINDOW_MS,
  type DecisionActionResult,
  type ReAddActionResult,
  type SuggestionDecision,
  type UndoActionResult,
} from "./suggestion-actions.shared";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DECIDED_ACTION = "kol.campaign_suggestion_decided";
const UNDONE_ACTION = "kol.campaign_suggestion_undone";
const READD_ACTION = "kol.campaign_suggestion_readded";

interface Actor {
  tenantId: string;
  userId: string;
}

async function authActor(): Promise<Actor | null> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
}

/**
 * Shared decision writer: upsert kol_campaign to `status` + audit, atomic.
 * Returns the audit_log id (= the undo decisionId).
 */
async function writeDecision(
  actor: Actor,
  kolId: string,
  campaignId: string,
  status: SuggestionDecision,
  undoExpiresAt: string,
): Promise<string> {
  const now = new Date();
  const auditId = await withTenant(actor.tenantId, async (tx) => {
    const kc = await tx.kolCampaign.upsert({
      where: {
        tenantId_kolId_campaignId: {
          tenantId: actor.tenantId,
          kolId,
          campaignId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        kolId,
        campaignId,
        suggestionStatus: status,
        suggestedAt: now,
        decidedAt: now,
        source: "ai_smart_match",
      },
      update: {
        suggestionStatus: status,
        decidedAt: now,
        ...(status === "accepted" ? { source: "ai_smart_match" } : {}),
      },
      select: { id: true },
    });

    const audit = await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: DECIDED_ACTION,
        resourceType: "kol_campaign",
        resourceId: kc.id,
        payload: {
          action: status,
          kolId,
          campaignId,
          actorUserId: actor.userId,
          undoExpiresAt,
        },
      },
      select: { id: true },
    });
    return audit.id;
  });
  return String(auditId);
}

async function decide(
  kolId: string,
  campaignId: string,
  status: SuggestionDecision,
): Promise<DecisionActionResult> {
  const actor = await authActor();
  if (!actor) return { ok: false, error: "unauthorized" };
  if (!UUID_RE.test(kolId) || !UUID_RE.test(campaignId)) {
    return { ok: false, error: "validation_failed" };
  }

  const undoExpiresAt = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();
  try {
    const decisionId = await writeDecision(
      actor,
      kolId,
      campaignId,
      status,
      undoExpiresAt,
    );
    await invalidateCampaignSuggestionsCache(actor.tenantId, campaignId);
    return { ok: true, decisionId, undoExpiresAt };
  } catch (err) {
    console.error(`[suggestion-actions] ${status} failed:`, err);
    return { ok: false, error: "internal_error" };
  }
}

export async function acceptKolToCampaign(
  kolId: string,
  campaignId: string,
): Promise<DecisionActionResult> {
  return decide(kolId, campaignId, "accepted");
}

export async function skipKolFromCampaign(
  kolId: string,
  campaignId: string,
): Promise<DecisionActionResult> {
  return decide(kolId, campaignId, "skipped");
}

export async function swapKolToSwapPool(
  kolId: string,
  campaignId: string,
): Promise<DecisionActionResult> {
  return decide(kolId, campaignId, "swap_pool");
}

/**
 * Move a swap_pool KOL back to the live suggestion pool: delete its
 * kol_campaign row so getCampaignSuggestions no longer excludes it. Used
 * by the F006 drag-back interaction.
 */
export async function reAddToSuggested(
  kolId: string,
  campaignId: string,
): Promise<ReAddActionResult> {
  const actor = await authActor();
  if (!actor) return { ok: false, error: "unauthorized" };
  if (!UUID_RE.test(kolId) || !UUID_RE.test(campaignId)) {
    return { ok: false, error: "validation_failed" };
  }

  try {
    const removed = await withTenant(actor.tenantId, async (tx) => {
      const res = await tx.kolCampaign.deleteMany({
        where: {
          tenantId: actor.tenantId,
          kolId,
          campaignId,
          suggestionStatus: "swap_pool",
        },
      });
      if (res.count === 0) return false;
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: READD_ACTION,
          resourceType: "kol_campaign",
          resourceId: null,
          payload: { kolId, campaignId, actorUserId: actor.userId },
        },
      });
      return true;
    });
    if (!removed) return { ok: false, error: "not_found" };
    await invalidateCampaignSuggestionsCache(actor.tenantId, campaignId);
    return { ok: true };
  } catch (err) {
    console.error("[suggestion-actions] reAdd failed:", err);
    return { ok: false, error: "internal_error" };
  }
}

/**
 * Remove an accepted (or swap_pool) KOL from the campaign entirely:
 * delete its kol_campaign row so it leaves the column and becomes
 * eligible for future suggestions again. Drives the F006 accepted-column
 * "Remove" button.
 */
export async function removeKolFromCampaign(
  kolId: string,
  campaignId: string,
): Promise<ReAddActionResult> {
  const actor = await authActor();
  if (!actor) return { ok: false, error: "unauthorized" };
  if (!UUID_RE.test(kolId) || !UUID_RE.test(campaignId)) {
    return { ok: false, error: "validation_failed" };
  }

  try {
    const removed = await withTenant(actor.tenantId, async (tx) => {
      const res = await tx.kolCampaign.deleteMany({
        where: {
          tenantId: actor.tenantId,
          kolId,
          campaignId,
          suggestionStatus: { in: ["accepted", "swap_pool"] },
        },
      });
      if (res.count === 0) return false;
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: UNDONE_ACTION,
          resourceType: "kol_campaign",
          resourceId: null,
          payload: {
            removed: true,
            kolId,
            campaignId,
            actorUserId: actor.userId,
          },
        },
      });
      return true;
    });
    if (!removed) return { ok: false, error: "not_found" };
    await invalidateCampaignSuggestionsCache(actor.tenantId, campaignId);
    return { ok: true };
  } catch (err) {
    console.error("[suggestion-actions] remove failed:", err);
    return { ok: false, error: "internal_error" };
  }
}

/**
 * Revert a decision within the 5s undo window: delete the kol_campaign
 * row created by the decision and write an undo audit row. Past the
 * window → `undo_expired`.
 */
export async function undoLastDecision(
  decisionId: string,
): Promise<UndoActionResult> {
  const actor = await authActor();
  if (!actor) return { ok: false, error: "unauthorized" };

  // decisionId is the audit_log BigInt id, serialised as a string.
  let auditId: bigint;
  try {
    auditId = BigInt(decisionId);
  } catch {
    return { ok: false, error: "validation_failed" };
  }

  try {
    const result = await withTenant(actor.tenantId, async (tx) => {
      const decision = await tx.auditLog.findFirst({
        where: {
          id: auditId,
          tenantId: actor.tenantId,
          action: DECIDED_ACTION,
        },
        select: { id: true, createdAt: true, payload: true, resourceId: true },
      });
      if (!decision) return { kind: "not_found" as const };

      const ageMs = Date.now() - decision.createdAt.getTime();
      if (ageMs > UNDO_WINDOW_MS) return { kind: "expired" as const };

      const payload = (decision.payload ?? {}) as {
        kolId?: string;
        campaignId?: string;
      };
      const kolId = payload.kolId;
      const campaignId = payload.campaignId;
      if (!kolId || !campaignId) return { kind: "not_found" as const };

      // Delete the kol_campaign row the decision created/updated.
      if (decision.resourceId) {
        await tx.kolCampaign.deleteMany({
          where: { id: decision.resourceId, tenantId: actor.tenantId },
        });
      } else {
        await tx.kolCampaign.deleteMany({
          where: { tenantId: actor.tenantId, kolId, campaignId },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: UNDONE_ACTION,
          resourceType: "kol_campaign",
          resourceId: decision.resourceId,
          payload: {
            undoneDecisionId: decisionId,
            kolId,
            campaignId,
            actorUserId: actor.userId,
          },
        },
      });
      return { kind: "ok" as const, kolId, campaignId };
    });

    if (result.kind === "not_found") return { ok: false, error: "not_found" };
    if (result.kind === "expired") return { ok: false, error: "undo_expired" };

    await invalidateCampaignSuggestionsCache(actor.tenantId, result.campaignId);
    return { ok: true, kolId: result.kolId, campaignId: result.campaignId };
  } catch (err) {
    console.error("[suggestion-actions] undo failed:", err);
    return { ok: false, error: "internal_error" };
  }
}
