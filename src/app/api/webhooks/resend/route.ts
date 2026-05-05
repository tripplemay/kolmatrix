/**
 * BL-035-F006 (AI-H1) · Resend webhook receiver.
 *
 * Resend signs every webhook delivery with the [Svix] standard:
 * `svix-id`, `svix-timestamp`, `svix-signature` headers + the raw
 * request body. We hand all four to `Webhook.verify` from the
 * `svix` SDK, which:
 *   - replays the signature using `RESEND_WEBHOOK_SECRET`
 *   - rejects timestamps older than 5 minutes (Svix default)
 *   - throws if any of those checks fail
 *
 * On a verified delivery we:
 *   1. update `EmailLog.status` per `event.type` (delivered /
 *      bounced / complained / opened / clicked) and timestamp the
 *      matching column;
 *   2. for `email.bounced` with `bounce.type === "permanent"`
 *      (a hard bounce), null out the recipient KOL's email so the
 *      next batch send never picks it again, and audit-log the
 *      change so admin tooling can show "kol.email cleared because
 *      <providerMessageId> hard-bounced at <T>".
 *
 * Soft bounces (transient mailbox-full / out-of-office) only update
 * EmailLog.status — clearing email on these would punish recoverable
 * recipients.
 *
 * Failures are logged but never thrown back to Resend; we always
 * return a JSON `{ ok: bool }` so Resend doesn't retry on a partial
 * write (which would double-count the same event).
 */
import "dotenv/config";
import { NextResponse } from "next/server";
import { Webhook, type WebhookRequiredHeaders } from "svix";

import { prisma, withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logEvent } from "@/lib/events/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResendBouncePayload {
  type: "permanent" | "transient" | string;
  reason?: string;
}

interface ResendWebhookEvent {
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

interface VerifyResult {
  ok: true;
  event: ResendWebhookEvent;
}

interface VerifyFailure {
  ok: false;
  reason: "missing_secret" | "missing_headers" | "bad_signature";
}

function extractHeaders(req: Request): WebhookRequiredHeaders | null {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return null;
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  };
}

async function verifyWebhook(req: Request, rawBody: string): Promise<VerifyResult | VerifyFailure> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "missing_secret" };

  const headers = extractHeaders(req);
  if (!headers) return { ok: false, reason: "missing_headers" };

  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(rawBody, headers) as ResendWebhookEvent;
    return { ok: true, event: verified };
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
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

interface ApplyResult {
  matched: number;
  hardBounceCleared: boolean;
}

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

export async function POST(req: Request): Promise<Response> {
  // Read the raw body BEFORE parsing so the svix signature replays
  // against the exact bytes Resend signed.
  const rawBody = await req.text();
  const verification = await verifyWebhook(req, rawBody);
  if (!verification.ok) {
    if (verification.reason === "missing_secret") {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set");
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  try {
    const result = await applyWebhookEvent(verification.event);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[resend-webhook] apply failed:", err);
    // Return 200 so Resend does not retry — duplicate event delivery
    // would cascade through `findUnique` + `update` again with the
    // same shape, but the partial-write here suggests a transient
    // DB issue worth surfacing to ops without making it visible to
    // the upstream by failing the HTTP call.
    return NextResponse.json({ ok: false, error: "apply_failed" });
  }
}
