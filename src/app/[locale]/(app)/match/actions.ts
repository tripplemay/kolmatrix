"use server";

/**
 * BL-065-F003 · /match server actions.
 *
 * `bulkSoftDeleteKolsAction` is the only action for now: a tenant-scoped
 * soft-delete that flips `deletedAt = now()` on every selected KOL.
 *
 * Why soft-delete and not hard-delete:
 *   - BL-020-F008 demo seeds + BM2 audit logs reference Kol rows by id
 *     (EmailLog FK / KolCampaign FK / audit_log FK). A hard DELETE would
 *     cascade-fail those FKs; the schema-wide soft-delete pattern (every
 *     domain model has `deletedAt`) keeps the audit trail intact.
 *   - The decision-point #D Planner-tilt in spec §4 is "保留全部 + 加确认
 *     modal". Soft-delete + UI confirmation gives marketers a reversible
 *     bulk action without exposing a destructive admin tool.
 *
 * Per-user rate limit via `rateLimitBatchSend` (20/min) — same gate
 * that AddKol uses. Logs `match.kols_bulk_deleted` events so the audit
 * trail captures actor + ids.
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
