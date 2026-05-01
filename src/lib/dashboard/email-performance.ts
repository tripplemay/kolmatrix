import type { TenantPrisma } from "@/lib/db";

export interface EmailPerfPoint {
  date: string;
  sent: number;
  opened: number;
  replied: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregate the last 14 days of EmailLog into per-day buckets.
 * Bucketed by sentAt (more meaningful for chart distribution than createdAt).
 * sent = all delivered (non-bounced, non-queued) — forms the funnel ceiling.
 * opened = sentAt-bucketed rows where openedAt IS NOT NULL.
 * replied = sentAt-bucketed rows where repliedAt IS NOT NULL.
 */
export async function fetchEmailPerformance(tx: TenantPrisma): Promise<EmailPerfPoint[]> {
  const cutoff = new Date(Date.now() - 14 * DAY_MS);
  const rows = await tx.emailLog.findMany({
    where: { sentAt: { gte: cutoff } },
    select: { sentAt: true, status: true, openedAt: true, repliedAt: true },
  });

  // Build 14 ordered buckets keyed by "Mon D" locale string.
  const now = Date.now();
  const keys: string[] = [];
  const buckets = new Map<string, { sent: number; opened: number; replied: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    keys.push(key);
    buckets.set(key, { sent: 0, opened: 0, replied: 0 });
  }

  for (const row of rows) {
    if (!row.sentAt) continue;
    const key = new Date(row.sentAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const b = buckets.get(key);
    if (!b) continue;
    if (row.status !== "bounced" && row.status !== "queued") b.sent++;
    if (row.openedAt) b.opened++;
    if (row.repliedAt) b.replied++;
  }

  return keys.map((date) => ({ date, ...buckets.get(date)! }));
}
