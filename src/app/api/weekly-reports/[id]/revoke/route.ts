/**
 * BL-051a-F004 · POST /api/weekly-reports/[id]/revoke
 *
 * Owner-only revoke for a weekly report's share token. Sets
 * `revoked_at = NOW()` so `validateShareToken` returns
 * `status='revoked'` on the next anonymous fetch (F002 + F003).
 *
 * Auth surface (spec §F004):
 *   - 401 unauthenticated
 *   - 403 caller is not the report owner
 *   - 404 unknown id (or cross-tenant id, masked as not_found)
 *   - 200 { ok: true, revokedAt, previouslyRevoked }
 *
 * audit_log: action='weekly_report.revoked'. The row outlives the
 * weekly report itself (no FK from audit_log), so revoke history is
 * preserved per ADR D5.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit/log";
import { revokeShareToken } from "@/lib/weekly-report/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await revokeShareToken({
    tenantId,
    reportId: id,
    actorUserId: userId,
  });

  if (!result.ok) {
    if (result.error === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Skip the audit row on a no-op idempotent revoke so re-clicking
  // the button doesn't pollute the trail with duplicate entries.
  if (!result.previouslyRevoked) {
    await logAudit({
      tenantId,
      actorId: userId,
      action: "weekly_report.revoked",
      targetType: "weekly_report",
      targetId: id,
      after: {
        revokedAt: result.revokedAt.toISOString(),
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      revokedAt: result.revokedAt.toISOString(),
      previouslyRevoked: result.previouslyRevoked,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
