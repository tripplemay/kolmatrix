/**
 * BM2-F007 · PATCH /api/kols/[id]/relationship-status
 *
 * Thin REST wrapper around the shared CRM helper. /crm uses a Server
 * Action that calls the same helper directly; this route exists so
 * future mobile / external clients have a 1:1 spec-defined contract.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  CrmRelationshipError,
  updateKolRelationshipStatusHelper,
} from "@/lib/crm/update";
import { RELATIONSHIP_STATUSES } from "@/lib/kol/filters";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(RELATIONSHIP_STATUSES),
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
      { error: "validation_failed" },
      { status: 400 }
    );
  }

  try {
    const result = await updateKolRelationshipStatusHelper(
      tenantId,
      userId,
      id,
      parsed.data.status
    );
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    if (err instanceof CrmRelationshipError) {
      if (err.code === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (err.code === "invalid_status") {
        return NextResponse.json(
          { error: "invalid_status" },
          { status: 400 }
        );
      }
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
