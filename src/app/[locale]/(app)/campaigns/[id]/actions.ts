"use server";

/**
 * BM2-F005 · Campaign-detail Server Actions.
 *
 * Powers every mutation on /campaigns/:id — field edits, status
 * transitions, revenue recording, and the full KolCampaign CRUD. Each
 * action revalidates the detail + list pages so the marketer sees the
 * freshly-computed spendTotal / ROI without a hard reload.
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  CampaignKolError,
  removeKolFromCampaign,
  updateKolCampaign,
} from "@/lib/campaigns/kol-operations";
import {
  CampaignUpdateError,
  recordCampaignRevenue,
  transitionCampaignStatus,
  updateCampaignFields,
  updateCampaignSchema,
} from "@/lib/campaigns/update";
import { isCampaignStatus } from "@/lib/campaigns/status";
import { isKolCampaignStatus } from "@/lib/campaigns/kol-campaign-status";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionState = {
  ok: boolean;
  error?: string;
};

async function requireSession(): Promise<{ tenantId: string; userId: string } | null> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (
    !tenantId ||
    !UUID_RE.test(tenantId) ||
    !userId ||
    !UUID_RE.test(userId)
  ) {
    return null;
  }
  return { tenantId, userId };
}

function revalidate(campaignId: string) {
  revalidatePath(`/[locale]/campaigns/${campaignId}`, "page");
  revalidatePath("/[locale]/campaigns", "page");
}

export async function updateCampaignFieldsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  if (!UUID_RE.test(id)) return { ok: false, error: "invalid_input" };

  const raw: Record<string, unknown> = {
    name: formData.get("name") ?? undefined,
    budgetAmount: formData.get("budgetAmount") ?? undefined,
    startDate: formData.get("startDate") ?? undefined,
    endDate: formData.get("endDate") ?? undefined,
    game: formData.get("game") ?? undefined,
  };
  // Drop keys that weren't submitted so the partial update only
  // touches fields the user actually changed.
  for (const k of Object.keys(raw)) {
    if (raw[k] === null || raw[k] === undefined) delete raw[k];
  }
  const parsed = updateCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "validation_failed" };
  }
  if (
    parsed.data.startDate &&
    parsed.data.endDate &&
    parsed.data.endDate.getTime() < parsed.data.startDate.getTime()
  ) {
    return { ok: false, error: "endBeforeStart" };
  }
  try {
    await updateCampaignFields(session.tenantId, session.userId, id, parsed.data);
  } catch (err) {
    if (err instanceof CampaignUpdateError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

export async function transitionStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!UUID_RE.test(id) || !isCampaignStatus(next)) {
    return { ok: false, error: "invalid_input" };
  }
  try {
    await transitionCampaignStatus(session.tenantId, session.userId, id, next);
  } catch (err) {
    if (err instanceof CampaignUpdateError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

export async function recordRevenueAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  const raw = String(formData.get("revenue") ?? "").trim();
  if (!UUID_RE.test(id)) return { ok: false, error: "invalid_input" };

  let revenue: number | null = null;
  if (raw !== "") {
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { ok: false, error: "revenueInvalid" };
    }
    revenue = Number(raw);
    if (!(revenue >= 0) || revenue > 9_999_999_999.99) {
      return { ok: false, error: "revenueInvalid" };
    }
  }
  try {
    await recordCampaignRevenue(session.tenantId, session.userId, id, revenue);
  } catch (err) {
    if (err instanceof CampaignUpdateError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

// BL-066-F005: addKolAction (campaigns/[id] AddKolDialog form) removed.
// AddKolDialog.tsx is gitrm'd in the same commit; AI recommendation flow
// (AiRecommendationPanel + acceptKolToCampaignAction in recommend-actions.ts)
// replaces it. addKolToCampaign lib helper is kept (bulkAddKolsToCampaign +
// other paths still use it).

export async function removeKolAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  const kolId = String(formData.get("kolId") ?? "");
  if (!UUID_RE.test(id) || !UUID_RE.test(kolId)) {
    return { ok: false, error: "invalid_input" };
  }
  try {
    await removeKolFromCampaign(session.tenantId, session.userId, id, kolId);
  } catch (err) {
    if (err instanceof CampaignKolError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

export async function updateKolContactStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  const kolId = String(formData.get("kolId") ?? "");
  const contactStatus = String(formData.get("contactStatus") ?? "");
  if (
    !UUID_RE.test(id) ||
    !UUID_RE.test(kolId) ||
    !isKolCampaignStatus(contactStatus)
  ) {
    return { ok: false, error: "invalid_input" };
  }
  try {
    await updateKolCampaign(session.tenantId, session.userId, id, kolId, {
      contactStatus,
    });
  } catch (err) {
    if (err instanceof CampaignKolError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

export async function updateKolFeeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const id = String(formData.get("campaignId") ?? "");
  const kolId = String(formData.get("kolId") ?? "");
  const raw = String(formData.get("kolFee") ?? "").trim();
  if (!UUID_RE.test(id) || !UUID_RE.test(kolId)) {
    return { ok: false, error: "invalid_input" };
  }
  let kolFee: number | null = null;
  if (raw !== "") {
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { ok: false, error: "feeInvalid" };
    }
    kolFee = Number(raw);
  }
  try {
    await updateKolCampaign(session.tenantId, session.userId, id, kolId, {
      kolFee,
    });
  } catch (err) {
    if (err instanceof CampaignKolError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }
  revalidate(id);
  return { ok: true };
}

// BL-035-F011 (CQ-H4): peekAllowedStatusTransitions removed —
// disabled-state hints in CampaignDetailClient now derive transitions
// inline from CAMPAIGN_STATUS_VALUES + isAllowedStatusTransition rather
// than paying for an extra server-action round-trip.
