/**
 * BL-024-F001-1 — `/database` Export CSV.
 *
 * Reuses the same `parseFilters` + `buildKolWhere` (+ `isSaved=true`)
 * pipeline as `/database/page.tsx → search.ts` so the file the user
 * downloads matches the rows they're looking at.
 *
 * Row cap: default 5000 (URL `?limit=N` with N ≤ 50000) per
 * v0.9.11 §database-patterns.md §6 — explicit cap > silent OOM on
 * large tenants. The CSV body and header are sent in a single Response
 * (Next.js' Edge runtime streaming is more trouble than it's worth at
 * 5000 rows × ~200 B/row ≈ 1 MB). The Response itself is non-streamed
 * so Content-Length is honored end-to-end.
 *
 * Formula-injection: all free-text cells flow through `csvCell` from
 * `@/lib/csv/cell` which prefixes `=` / `+` / `-` / `@` rows with `'`
 * (Excel/Sheets safe-import). RFC-4180 quoting of `,` `"` `\n` `\r`
 * is the same helper.
 */
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { csvRow } from "@/lib/csv/cell";
import { withTenant } from "@/lib/db";
import { buildKolWhere, parseFilters } from "@/lib/kol/filters";

export const dynamic = "force-dynamic";

const HEADER_ROW = [
  "kol_id",
  "display_name",
  "handle",
  "platform",
  "follower_count",
  "engagement_rate_percent",
  "value_score",
  "categories",
  "language",
  "country_code",
  "email",
  "first_seen_at",
] as const;

const DEFAULT_ROW_LIMIT = 5_000;
const MAX_ROW_LIMIT = 50_000;

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

function parseRowLimit(raw: string | null): number {
  if (!raw) return DEFAULT_ROW_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ROW_LIMIT;
  return Math.min(n, MAX_ROW_LIMIT);
}

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawSearch: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "limit") continue;
    const existing = rawSearch[key];
    if (existing == null) {
      rawSearch[key] = value;
    } else if (Array.isArray(existing)) {
      rawSearch[key] = [...existing, value];
    } else {
      rawSearch[key] = [existing, value];
    }
  }
  const filters = parseFilters(rawSearch);
  const limit = parseRowLimit(url.searchParams.get("limit"));

  const baseWhere = buildKolWhere({ ...filters, includeNonGaming: true });
  const andClauses = Array.isArray(baseWhere.AND)
    ? (baseWhere.AND as Prisma.KolWhereInput[])
    : [];
  const where: Prisma.KolWhereInput = {
    AND: [...andClauses, { isSaved: true }],
  };

  const { tenantSlug, rows } = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: { slug: true },
    });

    const kols = await tx.kol.findMany({
      where,
      orderBy: { displayName: "asc" },
      take: limit,
      select: {
        id: true,
        displayName: true,
        handle: true,
        platform: true,
        followerCount: true,
        engagementRate: true,
        valueScore: true,
        categories: true,
        language: true,
        countryCode: true,
        email: true,
        createdAt: true,
      },
    });

    const dataRows = kols.map((k) => [
      k.id,
      k.displayName,
      k.handle,
      k.platform,
      k.followerCount,
      k.engagementRate ? Number(k.engagementRate.toString()).toString() : "",
      k.valueScore ?? "",
      k.categories.join("|"),
      k.language ?? "",
      k.countryCode ?? "",
      k.email ?? "",
      k.createdAt.toISOString(),
    ]);

    return {
      tenantSlug: tenant?.slug ?? "tenant",
      rows: dataRows,
    };
  });

  const csv = [csvRow(HEADER_ROW), ...rows.map(csvRow), ""].join("\n");
  const filename = `kols-${safeFilenameFragment(tenantSlug)}-${todayStamp()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
