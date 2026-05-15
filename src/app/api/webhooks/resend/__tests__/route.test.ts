/**
 * BL-035-F006 (AI-H1) — Resend webhook receiver specs.
 *
 * The route stitches three concerns together: svix signature
 * verification, EmailLog status mapping, and a hard-bounce-clears-
 * Kol.email side effect. Each is exercised with dependencies stubbed
 * at the module boundary so the suite stays in jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";

const emailLogFindUnique = vi.fn();
const emailLogUpdate = vi.fn();
const kolUpdate = vi.fn();

const withTenantMock = vi.fn(async (_tid: string, fn: (tx: unknown) => unknown) =>
  fn({ kol: { update: kolUpdate } }),
);
vi.mock("@/lib/db", () => ({
  prisma: {
    emailLog: { findUnique: emailLogFindUnique, update: emailLogUpdate },
  },
  withTenant: (...args: unknown[]) =>
    withTenantMock(args[0] as string, args[1] as (tx: unknown) => unknown),
}));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

const { POST } = await import("../route");
const { applyWebhookEvent } = await import("../handler");

const SECRET = "whsec_" + Buffer.alloc(32, 1).toString("base64");
const TENANT = "11111111-2222-3333-4444-555555555555";
const KOL = "00000000-0000-4000-8000-000000000001";
const LOG_ID = "33333333-4444-5555-6666-777777777777";
const ORIGINAL_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function buildSignedRequest(secret: string, body: unknown): Request {
  const wh = new Webhook(secret);
  const messageId = "msg_" + Math.random().toString(36).slice(2);
  const payload = JSON.stringify(body);
  const sig = wh.sign(messageId, new Date(), payload);
  return new Request("https://example.test/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": messageId,
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": sig,
      "content-type": "application/json",
    },
    body: payload,
  });
}

beforeEach(() => {
  emailLogFindUnique.mockReset();
  emailLogUpdate.mockReset();
  kolUpdate.mockReset();
  withTenantMock.mockClear();
  logAuditMock.mockReset().mockResolvedValue(undefined);
  logEventMock.mockReset().mockResolvedValue(undefined);
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.RESEND_WEBHOOK_SECRET;
  } else {
    process.env.RESEND_WEBHOOK_SECRET = ORIGINAL_SECRET;
  }
});

describe("POST /api/webhooks/resend (BL-035-F006)", () => {
  it("returns 401 when the svix signature does not match", async () => {
    const req = new Request("https://example.test/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": "msg_x",
        "svix-timestamp": "0",
        "svix-signature": "v1,bogus",
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "email.delivered", data: { email_id: "x" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(emailLogFindUnique).not.toHaveBeenCalled();
  });

  it("returns 500 when RESEND_WEBHOOK_SECRET is not set (cannot silently accept)", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const req = new Request("https://example.test/api/webhooks/resend", {
      method: "POST",
      headers: { "svix-id": "x", "svix-timestamp": "0", "svix-signature": "v1,x" },
      body: JSON.stringify({ type: "email.delivered" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("maps email.delivered to status='delivered' + sets deliveredAt", async () => {
    emailLogFindUnique.mockResolvedValueOnce({
      id: LOG_ID,
      tenantId: TENANT,
      kolId: KOL,
    });
    emailLogUpdate.mockResolvedValueOnce({});

    const req = buildSignedRequest(SECRET, {
      type: "email.delivered",
      data: { email_id: "msgid-1" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; matched: number };
    expect(body).toMatchObject({ ok: true, matched: 1 });
    expect(emailLogUpdate).toHaveBeenCalledWith({
      where: { id: LOG_ID },
      data: expect.objectContaining({ status: "delivered" }),
    });
    const updateArgs = emailLogUpdate.mock.calls[0][0] as {
      data: { deliveredAt?: Date };
    };
    expect(updateArgs.data.deliveredAt).toBeInstanceOf(Date);
  });

  it("hard-bounces clear Kol.email and write an audit log entry", async () => {
    emailLogFindUnique.mockResolvedValueOnce({
      id: LOG_ID,
      tenantId: TENANT,
      kolId: KOL,
    });
    emailLogUpdate.mockResolvedValueOnce({});
    kolUpdate.mockResolvedValueOnce({});

    const req = buildSignedRequest(SECRET, {
      type: "email.bounced",
      data: {
        email_id: "msgid-2",
        bounce: { type: "permanent", reason: "DMARC policy reject" },
      },
    });
    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; hardBounceCleared: boolean };
    expect(body).toMatchObject({ ok: true, hardBounceCleared: true });

    expect(emailLogUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: LOG_ID },
      data: expect.objectContaining({
        status: "bounced",
        bounceReason: "DMARC policy reject",
      }),
    });
    expect(kolUpdate).toHaveBeenCalledWith({
      where: { id: KOL },
      data: { email: null },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kol.email_cleared_by_bounce",
        targetType: "kol",
        targetId: KOL,
        tenantId: TENANT,
      }),
    );
  });

  it("soft bounces only update status — Kol.email is preserved", async () => {
    emailLogFindUnique.mockResolvedValueOnce({
      id: LOG_ID,
      tenantId: TENANT,
      kolId: KOL,
    });
    emailLogUpdate.mockResolvedValueOnce({});

    const req = buildSignedRequest(SECRET, {
      type: "email.bounced",
      data: {
        email_id: "msgid-3",
        bounce: { type: "transient", reason: "mailbox temporarily full" },
      },
    });
    const res = await POST(req);
    const body = (await res.json()) as { hardBounceCleared: boolean };
    expect(body.hardBounceCleared).toBe(false);
    expect(kolUpdate).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("ignores unknown event types without breaking the response shape", async () => {
    const req = buildSignedRequest(SECRET, {
      type: "email.future_event",
      data: { email_id: "msgid-4" },
    });
    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; matched: number };
    expect(body).toEqual({ ok: true, matched: 0, hardBounceCleared: false });
    expect(emailLogFindUnique).not.toHaveBeenCalled();
  });

  it("returns matched=0 when the providerMessageId is unknown", async () => {
    emailLogFindUnique.mockResolvedValueOnce(null);

    const req = buildSignedRequest(SECRET, {
      type: "email.opened",
      data: { email_id: "missing-id" },
    });
    const res = await POST(req);
    const body = (await res.json()) as { matched: number };
    expect(body.matched).toBe(0);
    expect(emailLogUpdate).not.toHaveBeenCalled();
  });
});

describe("applyWebhookEvent (direct, no HTTP layer)", () => {
  it("noops on unknown event.type", async () => {
    const result = await applyWebhookEvent({
      type: "email.unknown",
      data: { email_id: "x" },
    });
    expect(result).toEqual({ matched: 0, hardBounceCleared: false });
    expect(emailLogFindUnique).not.toHaveBeenCalled();
  });
});
