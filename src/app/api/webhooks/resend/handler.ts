/**
 * BL-035-F006 (AI-H1) · Resend webhook event applier.
 *
 * Moved out of `route.ts` in BL-067 fix-round 1 (2026-05-15) because
 * Next.js 16's `--webpack` build does strict TS route-export checking
 * and rejects non-route-field exports from `src/app/api/.../route.ts`.
 * `applyWebhookEvent` is testable in isolation (see `__tests__/route.test.ts`
 * §`applyWebhookEvent (direct, no HTTP layer)`) so a sibling helper
 * module is the natural home.
 *
 * Pure domain logic — no HTTP request handling. `route.ts` keeps the
 * Webhook signature verification + POST handler.
 */
import { prisma, withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logEvent } from "@/lib/events/log";

export interface ResendBouncePayload {
  type: "permanent" | "transient" | string;
  reason?: string;
}

export interface ResendWebhookEvent {
  type:
    | "email.delivered"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked"
    | string;
  data: {
    email_id?: string;
    bounce?: ResendBouncePayload;
    [key: string]: unknown;
  };
}

export interface ApplyResult {
  matched: number;
  hardBounceCleared: boolean;
}

const STATUS_BY_EVENT_TYPE: Record<string, string | undefined> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

const TIMESTAMP_COLUMN_BY_STATUS: Record<string, string | undefined> = {
  delivered: "deliveredAt",
  opened: "openedAt",
  // bounced + complained + clicked don't have dedicated columns on
  // EmailLog today; status is enough to drive analytics + UI.
};

export async function applyWebhookEvent(
  event: ResendWebhookEvent,
  deps: {
    prismaClient?: typeof prisma;
    nowMs?: number;
  } = {},
): Promise<ApplyResult> {
  const status = STATUS_BY_EVENT_TYPE[event.type];
  if (!status) {
    return { matched: 0, hardBounceCleared: false };
  }
  const messageId = String(event.data.email_id ?? "");
  if (!messageId) {
    return { matched: 0, hardBounceCleared: false };
  }

  const prismaClient = deps.prismaClient ?? prisma;
  const log = await prismaClient.emailLog.findUnique({
    where: { providerMessageId: messageId },
    select: { id: true, tenantId: true, kolId: true },
  });
  if (!log) {
    return { matched: 0, hardBounceCleared: false };
  }

  const now = deps.nowMs ? new Date(deps.nowMs) : new Date();
  const tsColumn = TIMESTAMP_COLUMN_BY_STATUS[status];
  const updateData: Record<string, unknown> = { status };
  if (tsColumn) {
    updateData[tsColumn] = now;
  }
  const isHardBounce =
    event.type === "email.bounced" && event.data.bounce?.type === "permanent";
  if (isHardBounce && event.data.bounce?.reason) {
    updateData.bounceReason = String(event.data.bounce.reason).slice(0, 500);
  }

  await prismaClient.emailLog.update({
    where: { id: log.id },
    data: updateData,
  });

  let hardBounceCleared = false;
  if (isHardBounce && log.kolId) {
    await withTenant(log.tenantId, (tx) =>
      tx.kol.update({ where: { id: log.kolId! }, data: { email: null } }),
    );
    hardBounceCleared = true;
    await logAudit({
      actorId: "system",
      action: "kol.email_cleared_by_bounce",
      targetType: "kol",
      targetId: log.kolId,
      tenantId: log.tenantId,
      before: { reason: event.data.bounce?.reason ?? null },
      after: { email: null, providerMessageId: messageId },
    });
  }

  void logEvent({
    type: `email.webhook.${status}`,
    tenantId: log.tenantId,
    resourceId: log.id,
    payload: {
      providerMessageId: messageId,
      hardBounceCleared,
    },
  });

  return { matched: 1, hardBounceCleared };
}
