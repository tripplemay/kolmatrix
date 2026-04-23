/**
 * BM2-F005 · POST /api/campaigns/[id]/kols — add a KOL to a campaign.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  CampaignKolError,
  addKolToCampaign,
} from "@/lib/campaigns/kol-operations";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

function mapKolError(err: unknown): NextResponse {
  if (err instanceof CampaignKolError) {
    if (err.code === "campaign_not_found" || err.code === "kol_not_found") {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    if (err.code === "already_linked") {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }
    if (err.code === "invalid_fee" || err.code === "invalid_status") {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "db_error" }, { status: 500 });
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kolId = typeof body.kolId === "string" ? body.kolId : "";
  if (!kolId) {
    return NextResponse.json({ error: "kolId_required" }, { status: 400 });
  }
  const rawFee = body.kolFee;
  let kolFee: number | null | undefined = undefined;
  if (rawFee != null && rawFee !== "") {
    const n = typeof rawFee === "string" ? Number(rawFee) : Number(rawFee);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "invalid_fee" }, { status: 400 });
    }
    kolFee = n;
  }

  try {
    const result = await addKolToCampaign(tenantId, userId, id, {
      kolId,
      kolFee,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapKolError(err);
  }
}

