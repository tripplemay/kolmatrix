"use server";

/**
 * BM2-F007 · /crm Server Actions.
 *
 * `updateRelationshipAction` is the in-page select-driven mutation;
 * it shares the same `updateKolRelationshipStatusHelper` as the new
 * REST route so audit_log + event_log behaviour stays consistent.
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  CrmRelationshipError,
  updateKolRelationshipStatusHelper,
} from "@/lib/crm/update";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CrmActionState = { ok: boolean; error?: string };

export async function updateRelationshipAction(
  _prev: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (
    !tenantId ||
    !UUID_RE.test(tenantId) ||
    !userId ||
    !UUID_RE.test(userId)
  ) {
    return { ok: false, error: "unauthorized" };
  }

  const kolId = String(formData.get("kolId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID_RE.test(kolId)) {
    return { ok: false, error: "invalid_input" };
  }

  try {
    await updateKolRelationshipStatusHelper(tenantId, userId, kolId, status);
  } catch (err) {
    if (err instanceof CrmRelationshipError) {
      return { ok: false, error: err.code };
    }
    return { ok: false, error: "generic" };
  }

  // /crm + /database + /kols/:id may all be displaying the same KOL.
  revalidatePath("/[locale]/crm", "page");
  revalidatePath("/[locale]/database", "page");
  revalidatePath(`/[locale]/kols/${kolId}`, "page");
  return { ok: true };
}
