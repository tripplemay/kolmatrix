/**
 * BM2-F006 · PATCH /api/kols/[id]
 *
 * Updates `email` + `emailSource` on a KOL so the /outreach composer
 * can inline-add a missing address for a saved creator. Independent
 * from BM1's /api/kols/[id]/relationship-status endpoint by design
 * (per audit §12.2 #L) — a future refactor can unify them (BL-011).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320)
    .refine((v) => /^.+@.+\..+$/.test(v), { message: "email_invalid" })
    .optional(),
  emailSource: z
    .enum(["manual", "youtube-about", "ai-extracted"])
    .optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  if (
    parsed.data.email === undefined &&
    parsed.data.emailSource === undefined
  ) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  try {
    const updated = await withTenant(tenantId, async (tx) => {
      const existing = await tx.kol.findUnique({
        where: { id },
        select: { id: true, email: true, emailSource: true },
      });
      if (!existing) return null;
      return tx.kol.update({
        where: { id },
        data: {
          ...(parsed.data.email !== undefined
            ? { email: parsed.data.email }
            : {}),
          ...(parsed.data.emailSource !== undefined
            ? { emailSource: parsed.data.emailSource }
            : {}),
        },
        select: { id: true, email: true, emailSource: true },
      });
    });

    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    void logEvent({
      type: "kol.email_updated",
      tenantId,
      actorId: userId,
      resourceId: id,
      payload: {
        email: updated.email,
        emailSource: updated.emailSource,
      },
    });

    return NextResponse.json(updated, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[PATCH /api/kols/[id]] failed:", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
