/**
 * BM2-F008 · GET /api/roi/campaigns — completed campaigns sorted by ROI desc.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadRoiCampaigns } from "@/lib/roi/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const campaigns = await loadRoiCampaigns(tenantId);
  return NextResponse.json(
    { campaigns },
    { headers: { "cache-control": "no-store" } }
  );
}
