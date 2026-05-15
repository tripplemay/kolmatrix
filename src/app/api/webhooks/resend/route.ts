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

// BL-067 fix-round 1: domain handler moved to ./handler so Next.js 16's
// strict route TS check (which disallows non-route exports from
// `src/app/api/.../route.ts`) doesn't reject the build. The HTTP entry
// point — signature verification + POST handler — stays in this file.
import { applyWebhookEvent, type ResendWebhookEvent } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
