/**
 * BM2-F010 · WeeklyReport persistence helpers.
 *
 * Two access modes:
 *   - Tenant-scoped (`upsertWeeklyReport`, `loadRecentWeeklyReports`,
 *     `loadWeeklyReportById`) — run inside `withTenant`, RLS-bound.
 *   - Anonymous-by-token (`loadWeeklyReportByShareToken`) — uses the
 *     superuser `prismaAdmin` client per Planner adjudication §13.4 #5.
 *     SELECTs only 4 columns + does NOT join the tenant table; brand
 *     header info comes out of `summaryJson.tenantSnapshot`.
 *
 * Upsert semantics (Planner §13 #I:B): a fresh generate for an
 * existing (tenantId, weekStart, weekEnd, locale) tuple overwrites
 * `contentMd` + `summaryJson` AND clears the share token (per
 * §13.5 #7 — old share URLs must not surface stale content).
 */
import { withTenant } from "@/lib/db";
import { prismaAdmin } from "@/lib/db-admin";

import {
  computeShareTokenExpiry,
  generateShareToken,
} from "./share-token";

export interface WeeklyReportSnapshot {
  tenantSnapshot: { name: string; logoUrl: string | null };
  kolActivity: unknown;
  roiData: unknown;
  prevWeekComparison: unknown;
  generatedAt: string;
  traceId?: string;
  cost?: number;
}

export interface WeeklyReportRow {
  id: string;
  tenantId: string;
  weekStart: Date;
  weekEnd: Date;
  locale: string;
  contentMd: string;
  summaryJson: WeeklyReportSnapshot | null;
  shareToken: string | null;
  shareTokenExpiresAt: Date | null;
  createdAt: Date;
  createdByUserId: string;
}

interface UpsertArgs {
  tenantId: string;
  createdByUserId: string;
  weekStart: Date;
  weekEnd: Date;
  locale: string;
  contentMd: string;
  summaryJson: WeeklyReportSnapshot;
}

export async function upsertWeeklyReport(
  args: UpsertArgs
): Promise<WeeklyReportRow> {
  return withTenant(args.tenantId, async (tx) => {
    const row = await tx.weeklyReport.upsert({
      where: {
        tenantId_weekStart_weekEnd_locale: {
          tenantId: args.tenantId,
          weekStart: args.weekStart,
          weekEnd: args.weekEnd,
          locale: args.locale,
        },
      },
      create: {
        tenantId: args.tenantId,
        weekStart: args.weekStart,
        weekEnd: args.weekEnd,
        locale: args.locale,
        contentMd: args.contentMd,
        summaryJson: args.summaryJson as object,
        createdByUserId: args.createdByUserId,
      },
      update: {
        contentMd: args.contentMd,
        summaryJson: args.summaryJson as object,
        // Per §13.5 #7: re-generation invalidates the previous share
        // link so old viewers can't see freshly-overwritten content
        // through the same URL.
        shareToken: null,
        shareTokenExpiresAt: null,
      },
    });
    return row as WeeklyReportRow;
  });
}

export interface RecentWeeklyReportRow {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  locale: string;
  createdAt: Date;
}

export async function loadRecentWeeklyReports(
  tenantId: string,
  limit = 10
): Promise<RecentWeeklyReportRow[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.weeklyReport.findMany({
      orderBy: [{ weekEnd: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        locale: true,
        createdAt: true,
      },
    });
    return rows;
  });
}

export async function loadWeeklyReportById(
  tenantId: string,
  id: string
): Promise<WeeklyReportRow | null> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.weeklyReport.findUnique({ where: { id } });
    return row as WeeklyReportRow | null;
  });
}

interface AttachShareTokenArgs {
  tenantId: string;
  reportId: string;
}

export async function attachShareToken(
  args: AttachShareTokenArgs
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateShareToken();
  const expiresAt = computeShareTokenExpiry();
  await withTenant(args.tenantId, async (tx) => {
    await tx.weeklyReport.update({
      where: { id: args.reportId },
      data: { shareToken: token, shareTokenExpiresAt: expiresAt },
    });
  });
  return { token, expiresAt };
}

export interface SharedWeeklyReportPayload {
  contentMd: string;
  summaryJson: WeeklyReportSnapshot | null;
  createdAt: Date;
  shareTokenExpiresAt: Date;
}

/**
 * Anonymous lookup. Uses the superuser client because the request has
 * no session and tenant_isolation RLS would otherwise return 0 rows.
 * Returns only the 4 columns needed to render the shared page; tenant
 * brand info lives in summaryJson.tenantSnapshot to avoid a tenant
 * table join that would widen the lateral attack surface.
 */
export async function loadSharedWeeklyReport(
  token: string
): Promise<SharedWeeklyReportPayload | null> {
  // Token is a 32-char base64url string from `generateShareToken`.
  // Reject anything else early so a malformed input never hits the
  // bypass-RLS client.
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;

  const row = await prismaAdmin.weeklyReport.findUnique({
    where: { shareToken: token },
    select: {
      contentMd: true,
      summaryJson: true,
      createdAt: true,
      shareTokenExpiresAt: true,
    },
  });
  if (!row || !row.shareTokenExpiresAt) return null;
  return row as SharedWeeklyReportPayload;
}

