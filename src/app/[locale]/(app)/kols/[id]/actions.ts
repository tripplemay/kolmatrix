"use server";

/**
 * BM1-F006 · KOL profile mutations.
 *
 * Two actions power the Overview tab: a relationship-status dropdown
 * that walks the CRM lifecycle enum, and a bookmark toggle that mirrors
 * `toggleKolSaved` from discovery/actions.ts but speaks in terms a
 * profile-page button can bind to with useActionState.
 *
 * Status changes are audited (logAudit — BI4-F003) because the
 * relationship lifecycle is the B2-compliance handoff point: reviewers
 * need before/after + actor for every CRM move. Save toggles stay on
 * the lighter event_log path already used by /discovery.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit/log";
import { withTenant } from "@/lib/db";
import { RELATIONSHIP_STATUSES, type RelationshipStatus } from "@/lib/kol/filters";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusSchema = z.object({
  kolId: z.string().regex(UUID_RE, "invalid_kol_id"),
  status: z.enum([...RELATIONSHIP_STATUSES] as [
    RelationshipStatus,
    ...RelationshipStatus[],
  ]),
});

export type UpdateRelationshipStatusState = {
  ok: boolean;
  status?: RelationshipStatus;
  kolId?: string;
  error?: "invalid_input" | "unauthorized" | "not_found" | "generic";
};

export async function updateKolRelationshipStatus(
  _prev: UpdateRelationshipStatusState,
  formData: FormData
): Promise<UpdateRelationshipStatusState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId) || !userId || !UUID_RE.test(userId)) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = statusSchema.safeParse({
    kolId: formData.get("kolId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }
  const { kolId, status } = parsed.data;

  try {
    const { before, after } = await withTenant(tenantId, async (tx) => {
      const existing = await tx.kol.findUnique({
        where: { id: kolId },
        select: { id: true, relationshipStatus: true },
      });
      if (!existing) return { before: null, after: null };
      const updated = await tx.kol.update({
        where: { id: kolId },
        data: { relationshipStatus: status },
        select: { id: true, relationshipStatus: true },
      });
      return {
        before: { relationshipStatus: existing.relationshipStatus },
        after: { relationshipStatus: updated.relationshipStatus },
      };
    });

    if (!before || !after) {
      return { ok: false, error: "not_found" };
    }
    if (before.relationshipStatus !== after.relationshipStatus) {
      void logAudit({
        actorId: userId,
        action: "kol.relationship_changed",
        targetType: "kol",
        targetId: kolId,
        tenantId,
        before,
        after,
      });
    }

    revalidatePath("/[locale]/kols/[id]", "page");
    revalidatePath("/[locale]/database", "page");

    return { ok: true, kolId, status };
  } catch (err) {
    console.error("[kol-profile] updateKolRelationshipStatus failed:", err);
    return { ok: false, error: "generic" };
  }
}
