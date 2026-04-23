/**
 * BM2-F005 · GET + PATCH /api/campaigns/[id]
 *
 * GET returns the full detail payload the UI RSC uses.
 * PATCH supports field edits + status transitions + revenue record
 * through a single endpoint keyed on `type`:
 *
 *   { type: "fields", fields: {...} }
 *   { type: "status", next: "active" | "completed" | "draft" }
 *   { type: "revenue", revenue: number | null }
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { runCampaignDetail } from "@/lib/campaigns/detail";
import { isCampaignStatus } from "@/lib/campaigns/status";
import {
  CampaignUpdateError,
  recordCampaignRevenue,
  transitionCampaignStatus,
  updateCampaignFields,
  updateCampaignSchema,
} from "@/lib/campaigns/update";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const campaign = await runCampaignDetail(tenantId, id);
  if (!campaign) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(campaign, {
    headers: { "cache-control": "no-store" },
  });
}

function mapUpdateError(err: unknown): NextResponse {
  if (err instanceof CampaignUpdateError) {
    if (err.code === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err.code === "invalid_transition") {
      return NextResponse.json(
        { error: "invalid_transition" },
        { status: 409 }
      );
    }
    if (err.code === "forbidden_when_completed") {
      return NextResponse.json(
        { error: "forbidden_when_completed" },
        { status: 409 }
      );
    }
  }
  return NextResponse.json({ error: "db_error" }, { status: 500 });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
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

  const type = String(body.type ?? "");
  try {
    if (type === "fields") {
      const parsed = updateCampaignSchema.safeParse(body.fields ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { error: "validation_failed" },
          { status: 400 }
        );
      }
      if (
        parsed.data.startDate &&
        parsed.data.endDate &&
        parsed.data.endDate.getTime() < parsed.data.startDate.getTime()
      ) {
        return NextResponse.json(
          { error: "endBeforeStart" },
          { status: 400 }
        );
      }
      await updateCampaignFields(tenantId, userId, id, parsed.data);
    } else if (type === "status") {
      const next = String(body.next ?? "");
      if (!isCampaignStatus(next)) {
        return NextResponse.json(
          { error: "invalid_status" },
          { status: 400 }
        );
      }
      await transitionCampaignStatus(tenantId, userId, id, next);
    } else if (type === "revenue") {
      const v = body.revenue;
      let revenue: number | null = null;
      if (v != null) {
        const n = typeof v === "string" ? Number(v) : (v as number);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "invalid_revenue" },
            { status: 400 }
          );
        }
        revenue = n;
      }
      await recordCampaignRevenue(tenantId, userId, id, revenue);
    } else {
      return NextResponse.json({ error: "unknown_type" }, { status: 400 });
    }
  } catch (err) {
    return mapUpdateError(err);
  }

  return NextResponse.json({ ok: true });
}
