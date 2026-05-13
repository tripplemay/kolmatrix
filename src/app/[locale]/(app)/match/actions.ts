"use server";

/**
 * BL-065-F003 + F006 · /match server actions.
 *
 * Hosts two tenant-scoped actions that the workbench needs:
 *   1. `bulkSoftDeleteKolsAction` (F003) — flips `deletedAt = now()` on
 *      every selected KOL. Soft-delete preserves EmailLog / KolCampaign
 *      / audit_log FKs while still hiding the row from the workbench.
 *   2. `addKolAction` (F006 migration from BL-024-F001-3) — the manual
 *      "Add KOL" form action; moved here so /match owns the file F006
 *      doesn't delete (the /database folder is retired in the same
 *      commit). Event types renamed from `database.kol_added` to
 *      `match.kol_added` to match the new home; audit-log query
 *      consumers must learn both names during the migration window.
 *
 * Both actions use `rateLimitBatchSend` (20/min/user) — the same gate
 * that BM2 mutations use across the app.
 */
import { Prisma } from "@prisma/client";
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

// ----------------------------------------------------------------------
// BL-024-F001-3 — addKolAction (manual Add KOL form). Migrated to
// /match in BL-065-F006 from /database/actions.ts. Body kept verbatim
// except for the revalidatePath (/database → /match) and event-type
// rename (database.kol_added → match.kol_added).
// ----------------------------------------------------------------------

const ADD_KOL_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "bilibili",
  "x",
  "manual",
] as const;

const AddKolSchema = z.object({
  platform: z.enum(ADD_KOL_PLATFORMS),
  handle: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/.test(v), {
      message: "invalid_url",
    }),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "invalid_email",
    }),
  followerCount: z.number().int().min(0).max(2_000_000_000).optional().default(0),
});

export type AddKolInput = z.input<typeof AddKolSchema>;

export type AddKolActionResult =
  | { ok: true; kolId: string }
  | { ok: false; error: string; retryAfter?: number };

export async function addKolAction(input: AddKolInput): Promise<AddKolActionResult> {
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

  const validation = AddKolSchema.safeParse(input);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    const code =
      issue?.message === "invalid_url" || issue?.message === "invalid_email"
        ? issue.message
        : "invalid_input";
    return { ok: false, error: code };
  }
  const data = validation.data;

  const externalId = `manual:${data.handle.toLowerCase()}`;

  try {
    const created = await withTenant(tenantId, (tx) =>
      tx.kol.create({
        data: {
          tenantId,
          platform: data.platform,
          handle: data.handle,
          displayName: data.displayName,
          externalId,
          followerCount: data.followerCount,
          email: data.email || null,
          metadata: {
            source: "manual-add",
            added_at: new Date().toISOString(),
            added_by: userId,
            ...(data.url ? { profile_url: data.url } : {}),
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
    );

    void logEvent({
      type: "match.kol_added",
      tenantId,
      actorId: userId,
      resourceId: created.id,
      payload: { platform: data.platform, handle: data.handle },
    });

    revalidatePath("/[locale]/match", "page");
    return { ok: true, kolId: created.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "duplicate" };
    }
    void logEvent({
      type: "match.kol_add_failed",
      tenantId,
      actorId: userId,
      payload: {
        message: (err as Error).message?.slice(0, 200) ?? "unknown",
      },
    });
    return { ok: false, error: "generic" };
  }
}
