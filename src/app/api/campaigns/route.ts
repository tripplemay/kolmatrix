/**
 * BM2-F003 · GET /api/campaigns
 *
 * Tenant-scoped campaign list for the /campaigns page. Same helper
 * (`runCampaignListSearch`) powers the RSC render in page.tsx, so this
 * route is a thin JSON adapter for future mobile / webhook consumers.
 *
 * Auth: session-gated. Anonymous requests return 401 without leaking
 * the tenant namespace.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseCampaignFilters } from "@/lib/campaigns/filters";
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
