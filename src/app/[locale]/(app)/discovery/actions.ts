"use server";

/**
 * BM1-F004 · KOL save toggle server action.
 *
 * Binds to the "Save" button on each discovery card. Flips isSaved so
 * the KOL surfaces in /database (F005). We log the toggle to event_log
 * for future opt-in / CRM analytics (BI4-F002 helper).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toggleSchema = z.object({
  kolId: z.string().regex(UUID_RE, "invalid_kol_id"),
  nextSaved: z.enum(["true", "false"]),
});

export type ToggleKolSavedState = {
  ok: boolean;
  kolId?: string;
  saved?: boolean;
  error?: "invalid_input" | "unauthorized" | "not_found" | "generic";
};

export async function toggleKolSaved(
  _prev: ToggleKolSavedState,
  formData: FormData
): Promise<ToggleKolSavedState> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = toggleSchema.safeParse({
    kolId: formData.get("kolId"),
    nextSaved: formData.get("nextSaved"),
  });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }
  const { kolId, nextSaved } = parsed.data;
  const isSaved = nextSaved === "true";

  try {
    const updated = await withTenant(tenantId, (tx) =>
      tx.kol.update({
        where: { id: kolId },
        data: { isSaved },
        select: { id: true, isSaved: true },
      })
    );

    void logEvent({
      type: isSaved ? "kol.saved" : "kol.unsaved",
      tenantId,
      actorId: userId,
      resourceId: kolId,
    });

    revalidatePath("/[locale]/discovery", "page");
    revalidatePath("/[locale]/kols", "page");
    // /database is gated on isSaved — Next prefetches it from the
    // sidebar while the user browses Discovery, and without this
    // invalidation the client Router Cache serves a stale copy that
    // omits the row we just flipped.
    revalidatePath("/[locale]/database", "page");

    return { ok: true, kolId: updated.id, saved: updated.isSaved };
  } catch (err) {
    console.error("[discovery] toggleKolSaved failed:", err);
    return { ok: false, error: "generic" };
  }
}
