/**
 * BM2-F006 · Aggregates for the /outreach analytics panels.
 *
 * All queries run inside `withTenant` so tenant isolation is enforced
 * by RLS. Backed by EmailLog rows seeded by prisma/seed.ts (~300 rows
 * per tenant at dev time) so the dashboard is never empty pre-F006
 * Journey.
 */
import { withTenant } from "@/lib/db";

export interface EmailQuickStats {
  sentToday: number;
  openRatePercent: number | null;
  replyRatePercent: number | null;
  bounceRatePercent: number | null;
  deliverabilityPercent: number | null;
  totalSent30d: number;
}

export interface Daily {
  day: string; // ISO yyyy-mm-dd
  sent: number;
  opened: number;
}

export interface TopTemplateRow {
  templateId: string | null;
  name: string | null;
  usage: number;
  openRate: number | null;
}

export interface RecentReplyRow {
  kolId: string;
  displayName: string;
  avatarUrl: string | null;
  repliedAt: string;
  subject: string;
}

export interface RecentlySentRow {
  id: string;
  kolId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  campaignName: string | null;
  subject: string;
  status: string;
  sentAt: string | null;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function runEmailQuickStats(
  tenantId: string
): Promise<EmailQuickStats> {
  return withTenant(tenantId, async (tx) => {
    const today = startOfToday();
    const since = new Date(Date.now() - THIRTY_DAYS);

    const [sentTodayCount, totals30d] = await Promise.all([
      tx.emailLog.count({
        where: { sentAt: { gte: today } },
      }),
      tx.emailLog.findMany({
        where: { createdAt: { gte: since } },
        select: {
          sentAt: true,
          openedAt: true,
          repliedAt: true,
          status: true,
        },
      }),
    ]);

    const total = totals30d.length;
    const sent = totals30d.filter((r) => r.sentAt != null).length;
    const opened = totals30d.filter((r) => r.openedAt != null).length;
    const replied = totals30d.filter((r) => r.repliedAt != null).length;
    const bounced = totals30d.filter((r) => r.status === "bounced").length;

    const openRatePercent =
      sent > 0 ? Math.round((opened / sent) * 1000) / 10 : null;
    const replyRatePercent =
      sent > 0 ? Math.round((replied / sent) * 1000) / 10 : null;
    const bounceRatePercent =
      total > 0 ? Math.round((bounced / total) * 1000) / 10 : null;
    const deliverabilityPercent =
      bounceRatePercent == null ? null : Math.round((100 - bounceRatePercent) * 10) / 10;

    return {
      sentToday: sentTodayCount,
      openRatePercent,
      replyRatePercent,
      bounceRatePercent,
      deliverabilityPercent,
      totalSent30d: sent,
    };
  });
}

export async function runSendingPerformance30d(
  tenantId: string
): Promise<Daily[]> {
  return withTenant(tenantId, async (tx) => {
    const since = new Date(Date.now() - THIRTY_DAYS);
    const rows = await tx.emailLog.findMany({
      where: { createdAt: { gte: since } },
      select: { sentAt: true, openedAt: true },
    });

    const days: Daily[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i -= 1) {
      const start = new Date(now - i * DAY_MS);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + DAY_MS);
      const iso = start.toISOString().slice(0, 10);
      let sent = 0;
      let opened = 0;
      for (const r of rows) {
        if (r.sentAt && r.sentAt >= start && r.sentAt < end) sent += 1;
        if (r.openedAt && r.openedAt >= start && r.openedAt < end)
          opened += 1;
      }
      days.push({ day: iso, sent, opened });
    }
    return days;
  });
}

export async function runTopTemplates(
  tenantId: string,
  limit = 3
): Promise<TopTemplateRow[]> {
  return withTenant(tenantId, async (tx) => {
    const grouped = await tx.emailLog.groupBy({
      by: ["templateId"],
      _count: { _all: true },
      where: { templateId: { not: null } },
      orderBy: { _count: { templateId: "desc" } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    // BL-099-F004 (ADR-018 D2) — read the template name from the
    // email_log.template_name snapshot instead of joining email_template
    // (which F005 drops). Per group we take the most recent send's
    // snapshot name. Small set (≤limit rows) so the per-group fan-out is
    // fine — the open-rate count already fans out the same way.
    const result: TopTemplateRow[] = [];
    for (const g of grouped) {
      if (!g.templateId) continue;
      const [opened, latest] = await Promise.all([
        tx.emailLog.count({
          where: { templateId: g.templateId, openedAt: { not: null } },
        }),
        tx.emailLog.findFirst({
          where: { templateId: g.templateId, templateName: { not: null } },
          select: { templateName: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      const usage = g._count._all;
      result.push({
        templateId: g.templateId,
        name: latest?.templateName ?? null,
        usage,
        openRate:
          usage > 0 ? Math.round((opened / usage) * 1000) / 10 : null,
      });
    }
    return result;
  });
}

export async function runRecentReplies(
  tenantId: string,
  limit = 3
): Promise<RecentReplyRow[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.emailLog.findMany({
      where: { repliedAt: { not: null } },
      orderBy: { repliedAt: "desc" },
      take: limit,
      select: {
        repliedAt: true,
        subject: true,
        kol: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    return rows.map((r) => ({
      kolId: r.kol?.id ?? "",
      displayName: r.kol?.displayName ?? "—",
      avatarUrl: r.kol?.avatarUrl ?? null,
      repliedAt: r.repliedAt!.toISOString(),
      subject: r.subject,
    }));
  });
}

export async function runRecentlySent(
  tenantId: string,
  limit = 10
): Promise<RecentlySentRow[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.emailLog.findMany({
      where: { sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true,
        subject: true,
        status: true,
        sentAt: true,
        kol: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { name: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      kolId: r.kol?.id ?? null,
      displayName: r.kol?.displayName ?? null,
      avatarUrl: r.kol?.avatarUrl ?? null,
      campaignName: r.campaign?.name ?? null,
      subject: r.subject,
      status: r.status,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    }));
  });
}
