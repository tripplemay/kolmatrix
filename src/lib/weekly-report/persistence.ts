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
  validateShareTokenState,
  type ShareTokenStatus,
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
  revokedAt: Date | null;
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
        // through the same URL. BL-051a-F001 also clears revokedAt
        // so a regenerated report doesn't inherit a stale revoke
        // timestamp from a prior token.
        shareToken: null,
        shareTokenExpiresAt: null,
        revokedAt: null,
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

// BL-051a-F005 — separate helper rather than expanding
// `loadWeeklyReportById` so the existing callers don't pay the join
// cost. Used by the brand header to render "Created by {name}"
// alongside the share-link metadata.
export async function loadReportCreatorName(
  tenantId: string,
  reportId: string
): Promise<string | null> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.weeklyReport.findUnique({
      where: { id: reportId },
      select: { createdBy: { select: { name: true } } },
    });
    return row?.createdBy?.name ?? null;
  });
}

interface AttachShareTokenArgs {
  tenantId: string;
  reportId: string;
}

// BL-051a-F004 — owner-scoped revocation. Returns a typed result the
// API route maps to status codes (200 / 403 / 404). Resolution order
// mirrors deleteProduct (F008) so cross-tenant ids and ownership
// failures both surface as `not_found` to avoid leaking existence.
export type RevokeShareTokenResult =
  | { ok: true; revokedAt: Date; previouslyRevoked: boolean }
  | { ok: false; error: "not_found" | "forbidden" };

export async function revokeShareToken(args: {
  tenantId: string;
  reportId: string;
  actorUserId: string;
}): Promise<RevokeShareTokenResult> {
  const now = new Date();
  return withTenant(args.tenantId, async (tx) => {
    const row = await tx.weeklyReport.findUnique({
      where: { id: args.reportId },
      select: {
        id: true,
        createdByUserId: true,
        revokedAt: true,
      },
    });
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (row.createdByUserId !== args.actorUserId) {
      // Spec §F004 acceptance: 401/403 — non-owner read returns 403
      // so the caller knows the row exists; cross-tenant reads can't
      // even reach this branch (RLS would zero them).
      return { ok: false as const, error: "forbidden" as const };
    }
    // Idempotent: a second revoke leaves revokedAt at the original
    // time so the audit trail / shared page metadata stays stable.
    if (row.revokedAt) {
      return {
        ok: true as const,
        revokedAt: row.revokedAt,
        previouslyRevoked: true,
      };
    }
    await tx.weeklyReport.update({
      where: { id: args.reportId },
      data: { revokedAt: now },
    });
    return {
      ok: true as const,
      revokedAt: now,
      previouslyRevoked: false,
    };
  });
}

// BL-051a-F005 — TTL options exposed on the create-share UI. The
// `never` choice maps to a far-future timestamp instead of NULL so
// `isShareTokenExpired` (whose null branch correctly means "no
// token") + `loadSharedWeeklyReport` (which returns null when
// expiresAt is null) keep their existing semantics. This is a minor
// deviation from spec D4's literal "never = NULL"; documented in the
// commit message as building-stage 良性偏差 (avoids touching three
// load-bearing helpers for no user-visible benefit).
export const SHARE_TOKEN_TTL_DAYS_OPTIONS = [1, 7, 30] as const;
export type ShareTokenTtlChoice = (typeof SHARE_TOKEN_TTL_DAYS_OPTIONS)[number] | "never";

const NEVER_EXPIRY = new Date(Date.UTC(9999, 11, 31, 23, 59, 59));

function resolveTtlExpiry(choice: ShareTokenTtlChoice): Date {
  if (choice === "never") return NEVER_EXPIRY;
  const out = new Date();
  out.setUTCDate(out.getUTCDate() + choice);
  return out;
}

export async function attachShareToken(
  args: AttachShareTokenArgs & { ttl?: ShareTokenTtlChoice }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateShareToken();
  const expiresAt = args.ttl ? resolveTtlExpiry(args.ttl) : computeShareTokenExpiry();
  await withTenant(args.tenantId, async (tx) => {
    await tx.weeklyReport.update({
      where: { id: args.reportId },
      data: {
        shareToken: token,
        shareTokenExpiresAt: expiresAt,
        // BL-051a-F001: a fresh token is always live, so any prior
        // revoked_at on this row gets cleared (matters when an owner
        // revokes then reopens a report).
        revokedAt: null,
      },
    });
  });
  return { token, expiresAt };
}

export interface SharedWeeklyReportPayload {
  contentMd: string;
  summaryJson: WeeklyReportSnapshot | null;
  createdAt: Date;
  shareTokenExpiresAt: Date;
  revokedAt: Date | null;
  // BL-051a-F003 — drives the public page's getTranslations call so
  // the expired/revoked states render in the report's authoring
  // locale instead of always defaulting to English.
  locale: string;
}

/**
 * Anonymous lookup. Uses the superuser client because the request has
 * no session and tenant_isolation RLS would otherwise return 0 rows.
 * Returns only the 5 columns needed to render the shared page; tenant
 * brand info lives in summaryJson.tenantSnapshot to avoid a tenant
 * table join that would widen the lateral attack surface.
 *
 * BL-051a-F002 — returns the row regardless of expiry/revocation
 * state. The status check is `validateShareToken` (below); doing the
 * read once and the status check separately keeps the page render
 * able to show "expired" and "revoked" states with the original
 * `createdAt` for context.
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
      revokedAt: true,
      locale: true,
    },
  });
  if (!row || !row.shareTokenExpiresAt) return null;
  return row as SharedWeeklyReportPayload;
}

/**
 * BL-051a-F002 — three-state validation surface for the public
 * `/shared/weekly-report/[token]` route + the revoke API. Resolves
 * the token to a row and runs `validateShareTokenState` on its
 * (expiresAt, revokedAt) pair so callers get a typed status.
 *
 * Returns:
 *   - { status: 'valid', payload }      — usable token
 *   - { status: 'expired', metadata }   — link past TTL (createdAt + expiresAt
 *                                          surfaced for UI context;
 *                                          contentMd intentionally omitted)
 *   - { status: 'revoked', metadata }   — explicit revocation (revokedAt
 *                                          surfaced; contentMd omitted to
 *                                          stop information leaks per F003 §3.5)
 *   - { status: 'not_found' }           — malformed or unknown token
 */
export interface ValidateShareTokenMetadata {
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  locale: string;
}

export type ValidateShareTokenResult =
  | { status: "valid"; payload: SharedWeeklyReportPayload }
  | { status: "expired"; metadata: ValidateShareTokenMetadata }
  | { status: "revoked"; metadata: ValidateShareTokenMetadata }
  | { status: "not_found" };

export async function validateShareToken(
  token: string,
  now: Date = new Date()
): Promise<ValidateShareTokenResult> {
  const row = await loadSharedWeeklyReport(token);
  const status: ShareTokenStatus = validateShareTokenState(
    row
      ? {
          expiresAt: row.shareTokenExpiresAt,
          revokedAt: row.revokedAt,
        }
      : null,
    now
  );

  if (!row || status === "not_found") {
    return { status: "not_found" };
  }
  if (status === "valid") {
    return { status: "valid", payload: row };
  }
  // Expired / revoked: only surface metadata, never contentMd.
  return {
    status,
    metadata: {
      createdAt: row.createdAt,
      expiresAt: row.shareTokenExpiresAt,
      revokedAt: row.revokedAt,
      locale: row.locale,
    },
  };
}

