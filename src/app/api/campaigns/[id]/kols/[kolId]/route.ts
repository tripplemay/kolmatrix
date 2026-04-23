/**
 * BM2-F005 · DELETE + PATCH /api/campaigns/[id]/kols/[kolId]
 *
 * PATCH body shapes:
 *   { contactStatus: "..." }        — single-field
 *   { kolFee: 100 | "100" | null }  — single-field
 *   { contactStatus: "...", kolFee: 100 } — combined atomic update
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  CampaignKolError,
  removeKolFromCampaign,
  updateKolCampaign,
} from "@/lib/campaigns/kol-operations";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string; kolId: string }>;
}

function mapKolError(err: unknown): NextResponse {
  if (err instanceof CampaignKolError) {
    if (err.code === "link_not_found") {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    if (err.code === "invalid_fee" || err.code === "invalid_status") {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "db_error" }, { status: 500 });
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, kolId } = await ctx.params;
  try {
    const result = await removeKolFromCampaign(tenantId, userId, id, kolId);
    return NextResponse.json(result);
  } catch (err) {
    return mapKolError(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, kolId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: { contactStatus?: string; kolFee?: number | null } = {};
  if (typeof body.contactStatus === "string") {
    patch.contactStatus = body.contactStatus;
  }
  if ("kolFee" in body) {
    const v = body.kolFee;
    if (v === null || v === "") {
      patch.kolFee = null;
    } else {
      const n = typeof v === "string" ? Number(v) : (v as number);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "invalid_fee" }, { status: 400 });
      }
      patch.kolFee = n;
    }
  }
  if (patch.contactStatus === undefined && patch.kolFee === undefined) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  try {
    const result = await updateKolCampaign(
      tenantId,
      userId,
      id,
      kolId,
      patch
    );
    return NextResponse.json(result);
  } catch (err) {
    return mapKolError(err);
  }
}
