/**
 * BM2-F008 · GET /api/roi/summary — tenant ROI top-line summary.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadRoiSummary } from "@/lib/roi/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await loadRoiSummary(tenantId);
  return NextResponse.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}
