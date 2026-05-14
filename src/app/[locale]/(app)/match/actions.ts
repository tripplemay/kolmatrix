"use server";

/**
 * BL-065-F003 + F006 / BL-066-F005 · /match server actions.
 *
 * Hosts `bulkSoftDeleteKolsAction` (F003) — flips `deletedAt = now()`
 * on every selected KOL. Soft-delete preserves EmailLog / KolCampaign
 * / audit_log FKs while still hiding the row from the workbench.
 *
 * BL-066-F005 removed `addKolAction` (the manual Add-KOL form). AI
 * recommendation flow (AiRecommendationPanel + acceptKolToCampaignAction)
 * replaces it; marketers no longer manually add KOLs via /match.
 * Audit-log consumers reading `match.kol_added` events should expect
 * no new rows post BL-066 ship.
 *
 * `bulkSoftDeleteKolsAction` uses `rateLimitBatchSend` (20/min/user) —
 * the same gate that BM2 mutations use across the app.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const BulkDeleteSchema = z.object({
  kolIds: z
    .array(z.string().min(1).max(200))
    .min(1, "at_least_one")
    .max(200, "too_many"),
});

export type BulkSoftDeleteInput = z.input<typeof BulkDeleteSchema>;

export type BulkSoftDeleteActionResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string; retryAfter?: number };

export async function bulkSoftDeleteKolsAction(
  input: BulkSoftDeleteInput,
): Promise<BulkSoftDeleteActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return { ok: false, error: "unauthorized" };
  }

  const rl = await rateLimitBatchSend(userId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  const validation = BulkDeleteSchema.safeParse(input);
  if (!validation.success) {
    return { ok: false, error: "invalid_input" };
  }
  const { kolIds } = validation.data;

  try {
    const { count } = await withTenant(tenantId, (tx) =>
      tx.kol.updateMany({
        where: {
          id: { in: kolIds },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      }),
    );

    void logEvent({
      type: "match.kols_bulk_deleted",
      tenantId,
      actorId: userId,
      payload: { requested: kolIds.length, deleted: count },
    });

    revalidatePath("/[locale]/match", "page");
    return { ok: true, deleted: count };
  } catch (err) {
    void logEvent({
      type: "match.kols_bulk_delete_failed",
      tenantId,
      actorId: userId,
      payload: {
        requested: kolIds.length,
        message: (err as Error).message?.slice(0, 200) ?? "unknown",
      },
    });
    return { ok: false, error: "generic" };
  }
}

// BL-066-F005: addKolAction (manual Add KOL form) removed. Marketers
// no longer add KOLs manually; the AI recommendation flow
// (AiRecommendationPanel + acceptKolToCampaignAction) is the canonical
// path. messages/*.json match.headerActions / match.addKolForm keys are
// kept (with _deprecated_by_BL-066 marker) for BL-070 to delete.
