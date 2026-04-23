// BI4-F003 · Audit log helper.
//
// Per 2026-04-23 pre-impl adjudication (#A:D), this helper writes into
// the B0-foundation `audit_log` table (see prisma/schema.prisma AuditLog).
// The F003 spec's TypeScript surface (actorId / targetType / targetId /
// before / after) is preserved at the app layer and mapped to the B0
// column shape at persistence time:
//
//   actorId     → actor_user_id
//   targetType  → resource_type
//   targetId    → resource_id
//   before/after → payload Json = { before, after, sanitizedFields? }
//
// Failures console.error but do NOT throw — audit is load-bearing for
// compliance review, not for the business action that produced it.

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export interface AuditData {
  /** Required: which user triggered the action. */
  actorId: string;
  /** Dotted namespaced action, e.g. "user.role_changed", "data.exported" */
  action: string;
  /** Resource class — "user", "kol", "campaign", ... */
  targetType: string;
  /** Stable id of the resource touched. */
  targetId: string;
  /** Tenant scope; null for platform-level administrative actions. */
  tenantId?: string;
  /** Snapshot before the mutation. */
  before?: Record<string, unknown>;
  /** Snapshot after the mutation. */
  after?: Record<string, unknown>;
  /** Fields intentionally redacted from before/after (e.g. password hashes). */
  sanitizedFields?: string[];
  /** Source IP of the triggering request. */
  ipAddress?: string;
  /** User-Agent of the triggering request. */
  userAgent?: string;
}

export async function logAudit(data: AuditData): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (data.before !== undefined) payload.before = data.before;
  if (data.after !== undefined) payload.after = data.after;
  if (data.sanitizedFields && data.sanitizedFields.length > 0) {
    payload.sanitizedFields = data.sanitizedFields;
  }

  try {
    await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        actorUserId: data.actorId,
        action: data.action,
        resourceType: data.targetType,
        resourceId: data.targetId,
        payload: payload as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (err) {
    console.error(`[logAudit] Failed to persist audit "${data.action}":`, err);
  }
}
