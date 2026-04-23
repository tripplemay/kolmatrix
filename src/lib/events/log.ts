// BI4-F002 · Fire-and-forget business event logging.
//
// Feature code calls `logEvent({ type: "kol.created", ... })` after a
// domain action succeeds. Writes land in `event_log` via the base
// prisma client (no RLS on that table). Failures are swallowed with
// console.error so a downstream DB hiccup cannot tank the main flow
// — events are a nice-to-have for observability / future webhooks,
// never load-bearing for the business action that produced them.

import { prisma } from "@/lib/db";

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
  try {
    await prisma.eventLog.create({
      data: {
        type: data.type,
        tenantId: data.tenantId,
        actorId: data.actorId,
        resourceId: data.resourceId,
        payload: (data.payload ?? {}) as object,
      },
    });
  } catch (err) {
    console.error(`[logEvent] Failed to persist event "${data.type}":`, err);
  }
}
