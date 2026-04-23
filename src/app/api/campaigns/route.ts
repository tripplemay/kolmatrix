/**
 * BM2-F003 · GET /api/campaigns — tenant-scoped list
 * BM2-F004 · POST /api/campaigns — create (JSON contract for future
 *   non-browser clients; the /campaigns/new form uses the Server
 *   Action in app/.../new/actions.ts, which wraps the same helper).
 *
 * Auth: session-gated. Anonymous requests return 401 without leaking
 * the tenant namespace.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  CampaignCreateError,
  createCampaignRecord,
} from "@/lib/campaigns/create";
import { parseCampaignFilters } from "@/lib/campaigns/filters";
import {
  createCampaignSchemaWithDateOrder,
} from "@/lib/campaigns/schema";
import { runCampaignListSearch } from "@/lib/campaigns/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    raw[k] = v;
  }
  const filters = parseCampaignFilters(raw);
  const result = await runCampaignListSearch(tenantId, filters);

  return NextResponse.json(result, {
    // Campaign list shifts on every mutation — keep out of CDN caches.
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  // Merge ownerUserId from the session so API callers can't spoof it.
  const parsed = createCampaignSchemaWithDateOrder.safeParse({
    ...(body as Record<string, unknown>),
    ownerUserId: userId,
  });
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

  try {
    const result = await createCampaignRecord(tenantId, parsed.data);
    return NextResponse.json(
      { id: result.id },
      { status: 201, headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof CampaignCreateError) {
      if (err.code === "product_not_found") {
        return NextResponse.json(
          { error: "product_not_found" },
          { status: 404 }
        );
      }
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
