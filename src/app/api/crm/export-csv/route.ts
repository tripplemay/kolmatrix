/**
 * BIx-mvp-polish-pass F001 — `/crm` Export CSV.
 *
 * Streams a CSV with the tenant's KOL roster + relationship status +
 * KolCampaign roll-up + cumulative spend, filtered by the same time
 * toggle the page header uses. Downloaded directly via a plain
 * <a href="/api/crm/export-csv?range=...">; the Content-Disposition
 * header turns the response into a file save in every browser.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import {
  DEFAULT_CRM_RANGE,
  isCrmRange,
  rangeStart,
  type CrmRange,
} from "@/lib/crm/overview";

export const dynamic = "force-dynamic";

const ENGAGEMENT_STATUSES = ["signed", "delivered", "paid"] as const;

const HEADER_ROW = [
  "kol_id",
  "handle",
  "display_name",
  "platform",
  "country_code",
  "follower_count",
  "relationship_status",
  "campaign_count",
  "total_spend_usd",
  "created_at",
] as const;

/** RFC-4180 quoting: wrap in "..." if the cell contains , " or newline. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: ReadonlyArray<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

function safeFilenameFragment(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "tenant";
}

function todayStamp(now: Date = new Date()): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawRange = url.searchParams.get("range");
  const range: CrmRange = isCrmRange(rawRange) ? rawRange : DEFAULT_CRM_RANGE;
  const cutoff = rangeStart(range);

  const { tenantSlug, rows } = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: { slug: true },
    });

    const kols = await tx.kol.findMany({
      where: {
        deletedAt: null,
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        platform: true,
        countryCode: true,
        followerCount: true,
        relationshipStatus: true,
        createdAt: true,
        kolCampaigns: {
          select: {
            status: true,
            kolFee: true,
          },
        },
      },
      orderBy: { displayName: "asc" },
    });

    const dataRows = kols.map((k) => {
      const totalSpend = k.kolCampaigns
        .filter((kc) =>
          (ENGAGEMENT_STATUSES as readonly string[]).includes(kc.status)
        )
        .reduce((acc, kc) => acc + (kc.kolFee ? Number(kc.kolFee.toString()) : 0), 0);
      return [
        k.id,
        k.handle,
        k.displayName,
        k.platform,
        k.countryCode,
        k.followerCount,
        k.relationshipStatus,
        k.kolCampaigns.length,
        totalSpend.toFixed(2),
        k.createdAt.toISOString(),
      ];
    });

    return {
      tenantSlug: tenant?.slug ?? "tenant",
      rows: dataRows,
    };
  });

  const csv = [csvRow(HEADER_ROW), ...rows.map(csvRow), ""].join("\n");
  const filename = `crm-${safeFilenameFragment(tenantSlug)}-${todayStamp()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
