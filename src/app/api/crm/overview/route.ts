/**
 * BM2-F007 · GET /api/crm/overview
 *
 * Tenant-scoped CRM aggregate (stage distribution, funnel, KPI,
 * recent changes). The `/crm` page reads via the helper directly in
 * RSC; this route is the JSON adapter for future mobile / webhook
 * consumers.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { runCrmOverview } from "@/lib/crm/overview";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const overview = await runCrmOverview(tenantId);
  return NextResponse.json(overview, {
    headers: { "cache-control": "no-store" },
  });
}
