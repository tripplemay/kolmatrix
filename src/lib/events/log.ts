// BI4-F002 · Fire-and-forget business event logging.
//
// Feature code calls `logEvent({ type: "kol.created", ... })` after a
// domain action succeeds. Writes land in `event_log`. Failures are
// swallowed with console.error so a downstream DB hiccup cannot tank the
// main flow — events are a nice-to-have for observability / future
// webhooks, never load-bearing for the business action that produced
// them.
//
// BL-034 F003: event_log gained an RLS policy
// (20260505010000_audit_event_log_rls). Tenant-scoped writes now must
// pin `app.tenant_id` via withTenant() so the policy lets the INSERT
// through. Platform-level events (no tenantId) continue to use the bare
// client and rely on the policy's `tenant_id IS NULL` branch.

import { prisma, withTenant } from "@/lib/db";

export interface EventData {
  /** Dotted namespaced action, e.g. "kol.created", "campaign.email_sent" */
  type: string;
  /** Tenant the event happened in (null = platform-level) */
  tenantId?: string;
  /** User that triggered the event (null = system / cron) */
  actorId?: string;
  /** Stable id of the resource touched (kol id, campaign id, ...) */
  resourceId?: string;
  /** Any event-specific structured detail; MUST be JSON-safe */
  payload?: Record<string, unknown>;
}

export async function logEvent(data: EventData): Promise<void> {
  const row = {
    type: data.type,
    tenantId: data.tenantId ?? null,
    actorId: data.actorId ?? null,
    resourceId: data.resourceId ?? null,
    payload: (data.payload ?? {}) as object,
  };

  try {
    if (data.tenantId) {
      await withTenant(data.tenantId, (tx) => tx.eventLog.create({ data: row }));
    } else {
      await prisma.eventLog.create({ data: row });
    }
  } catch (err) {
    console.error(`[logEvent] Failed to persist event "${data.type}":`, err);
  }
}
