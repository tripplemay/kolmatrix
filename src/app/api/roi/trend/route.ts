/**
 * BM2-F008 · GET /api/roi/trend?days=N — daily ROI trend.
 *
 * `days` clamps to [1, 90]. Default 30. Returns N points ending today
 * (UTC); slots without completed campaigns show `roiPercent: null`.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadRoiTrend } from "@/lib/roi/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const raw = url.searchParams.get("days");
  let days = 30;
  if (raw != null) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "invalid_days" }, { status: 400 });
    }
    days = Math.min(90, Math.max(1, Math.round(n)));
  }
  const trend = await loadRoiTrend(tenantId, days);
  return NextResponse.json(
    { days, points: trend },
    { headers: { "cache-control": "no-store" } }
  );
}
