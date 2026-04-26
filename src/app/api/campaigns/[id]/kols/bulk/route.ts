/**
 * MVP-vf-F003 · POST /api/campaigns/[id]/kols/bulk
 *
 * Powers the /database Bulk Action Bar's "Add to Campaign" flow.
 * Body: `{ kolIds: string[] }`. Atomic per-campaign: one DB
 * transaction inserts the missing rows and recomputes spendTotal.
 *
 * Returns counts so the client can render a precise toast:
 *   { added: number, skipped: number, notFound: number, newSpendTotal: number }
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  CampaignKolError,
  bulkAddKolsToCampaign,
} from "@/lib/campaigns/kol-operations";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

function mapKolError(err: unknown): NextResponse {
  if (err instanceof CampaignKolError) {
    if (err.code === "campaign_not_found") {
      return NextResponse.json({ error: err.code }, { status: 404 });
    }
    if (err.code === "invalid_status" || err.code === "invalid_fee") {
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

  const rawIds = body.kolIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { error: "kolIds_required" },
      { status: 400 }
    );
  }
  const kolIds: string[] = [];
  const seen = new Set<string>();
  for (const v of rawIds) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    kolIds.push(trimmed);
  }
  if (kolIds.length === 0) {
    return NextResponse.json({ error: "kolIds_empty" }, { status: 400 });
  }

  try {
    const result = await bulkAddKolsToCampaign(tenantId, userId, id, kolIds);
    // Revalidate every page that surfaces campaign / KOL relationships
    // so the next navigation reads fresh DB state. Mirrors the
    // single-add endpoint's discipline (BM2 F009 lesson).
    revalidatePath(`/[locale]/campaigns/${id}`, "page");
    revalidatePath("/[locale]/campaigns", "page");
    revalidatePath("/[locale]/database", "page");
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapKolError(err);
  }
}
