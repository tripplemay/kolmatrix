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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = "KOLMatrix Access <marketer@kolquest.com>";
const ADMIN_INBOX = "tripplezhou@gmail.com";

let cachedClient: Resend | null = null;

function getClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new Resend(RESEND_API_KEY);
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
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <p style="font-size:14px;margin:0 0 16px">A new access request has been submitted:</p>
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
    await client.emails.send({
      from: FROM_ADDRESS,
      to: [ADMIN_INBOX],
      subject,
      html: buildBodyHtml(req),
    });
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
