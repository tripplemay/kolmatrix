/**
 * Resend email helper for BAux1-F003 access-request admin notification.
 *
 * The Server Action calls this *after* a successful DB write, so an
 * email-side failure never rolls back the intake record — admins can
 * always SSH into the DB and review `access_request` rows manually
 * (per docs/specs/BAux1-auth-pages-spec.md §6 risk mitigation).
 *
 * Sender address `marketer@kolquest.com` was validated end-to-end in
 * BI3-F005 (see .auto-memory/environment.md §Resend).
 */
import { Resend } from "resend";

const FROM_ADDRESS = "KOLMatrix Access <marketer@kolquest.com>";
const ADMIN_INBOX = "tripplezhou@gmail.com";

// NOTE: do NOT snapshot RESEND_API_KEY at module load — Vitest sets
// `process.env.RESEND_API_KEY` inside `it()` blocks after module
// initialization, so we must read it lazily each call.
let cachedClient: Resend | null = null;
let cachedKey: string | null = null;

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new Resend(key);
    cachedKey = key;
  }
  return cachedClient;
}

export type AccessRequestNotificationPayload = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  campaignsPerQuarter: string;
  games: string | null;
  wantsDemo: boolean;
  createdAt: Date;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBodyHtml(req: AccessRequestNotificationPayload): string {
  const rows: Array<[string, string]> = [
    ["Company", req.company],
    ["Name", `${req.firstName} ${req.lastName}`],
    ["Email", req.email],
    ["Role", req.role],
    ["Campaigns / quarter", req.campaignsPerQuarter],
    ["Games", req.games ?? "—"],
    ["Received at", req.createdAt.toISOString()],
    ["Request ID", req.id],
  ];
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6b7280;font-weight:600;vertical-align:top;white-space:nowrap">${escapeHtml(
            label
          )}</td>
          <td style="padding:6px 0;color:#0f172a;white-space:pre-wrap">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
  const demoBadge = req.wantsDemo
    ? `<div style="display:inline-block;margin-bottom:16px;padding:6px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;font-size:13px;font-weight:700;color:#92400e">
        DEMO REQUESTED — this lead wants a 1-on-1 demo
      </div>`
    : "";
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      ${demoBadge}<p style="font-size:14px;margin:0 0 16px">A new access request has been submitted:</p>
      <table style="font-size:14px;border-collapse:collapse;width:100%">${rowsHtml}</table>
      <p style="font-size:12px;color:#6b7280;margin:24px 0 0">
        To approve, SSH into the VPS and run the access-request approval runbook
        (UPDATE access_request SET status='approved' WHERE id='${escapeHtml(req.id)}';).
      </p>
    </div>`.trim();
}

export async function sendAccessRequestNotification(
  req: AccessRequestNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const subject = `[KOLMatrix] New access request: ${req.company}`;
  try {
    const client = getClient();
    const res = await client.emails.send({
      from: FROM_ADDRESS,
      to: [ADMIN_INBOX],
      subject,
      html: buildBodyHtml(req),
    });
    // Resend SDK 6.x returns { data, error } without throwing on 4xx/5xx.
    if (res && "error" in res && res.error) {
      const message =
        (res.error as { message?: string }).message ?? "resend_error";
      console.error("[access-request] Resend notification failed:", message);
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[access-request] Resend notification failed:", message);
    return { ok: false, error: message };
  }
}

// Test seam: exported for unit tests that verify the HTML body without
// actually invoking Resend.
export const __test__ = { buildBodyHtml, FROM_ADDRESS, ADMIN_INBOX };
