/**
 * MVP-vf-F005 · Right-rail Insights data for /campaigns/:id.
 *
 * Three blocks the page consumes:
 *   - emailSeries — daily counts of EmailLog.sentAt + replies
 *     for the recharts line chart.
 *   - activity — last 10 audit_log rows scoped to this campaign.
 *   - health — derived from existing CampaignDetailRow (computed
 *     server-side here so the client component stays pure
 *     presentation).
 */
import { withTenant } from "@/lib/db";

export interface EmailSeriesPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  contacted: number;
  replied: number;
}

export interface ActivityRow {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string; // ISO
  payload: unknown;
}

export interface CampaignHealth {
  /** spendTotal / budgetAmount in [0,1]; null when no budget. */
  spendRate: number | null;
  /** revenueRecorded / budgetAmount in [0,1]; null when no budget or revenue. */
  revenueVsBudget: number | null;
  /** Days from now to endDate; negative = overdue. null when no endDate. */
  daysToCloseout: number | null;
  /** Count of KolCampaign rows still pre-paid (i.e. "uncontacted to delivered"). */
  uncontactedKolCount: number;
}

export interface CampaignDetailInsights {
  emailSeries: EmailSeriesPoint[];
  activity: ActivityRow[];
  health: CampaignHealth;
}

const PIPELINE_NOT_PAID = [
  "pending",
  "contacted",
  "quoted",
  "signed",
  "delivered",
] as const;

const ACTIVITY_LIMIT = 10;
const SERIES_DAYS = 14;

export async function loadCampaignDetailInsights(
  tenantId: string,
  campaignId: string,
  detail: {
    spendTotal: number;
    revenueRecorded: number | null;
    budgetAmount: number | null;
    endDate: string | null;
  }
): Promise<CampaignDetailInsights> {
  return withTenant(tenantId, async (tx) => {
    // --- email series (last 14 days) -------------------------------
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (SERIES_DAYS - 1));

    const emailRows = await tx.emailLog.findMany({
      where: {
        campaignId,
        OR: [
          { sentAt: { gte: since } },
          { repliedAt: { gte: since } },
        ],
      },
      select: { sentAt: true, repliedAt: true },
    });

    const seriesMap = new Map<string, { contacted: number; replied: number }>();
    for (let i = 0; i < SERIES_DAYS; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      seriesMap.set(d.toISOString().slice(0, 10), { contacted: 0, replied: 0 });
    }
    for (const r of emailRows) {
      if (r.sentAt) {
        const k = r.sentAt.toISOString().slice(0, 10);
        const slot = seriesMap.get(k);
        if (slot) slot.contacted += 1;
      }
      if (r.repliedAt) {
        const k = r.repliedAt.toISOString().slice(0, 10);
        const slot = seriesMap.get(k);
        if (slot) slot.replied += 1;
      }
    }
    const emailSeries: EmailSeriesPoint[] = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // --- activity (last 10 rows scoped to this campaign) ----------
    const auditRows = await tx.auditLog.findMany({
      where: {
        OR: [
          { resourceType: "campaign", resourceId: campaignId },
          {
            resourceType: "kol_campaign",
            payload: { path: ["after", "campaignId"], equals: campaignId },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LIMIT,
      select: {
        id: true,
        action: true,
        actorUserId: true,
        createdAt: true,
        payload: true,
      },
    });

    const actorIds = Array.from(
      new Set(
        auditRows
          .map((r) => r.actorUserId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    const actorMap = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const users = await tx.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      });
      for (const u of users) actorMap.set(u.id, u.name);
    }

    const activity: ActivityRow[] = auditRows.map((r) => ({
      id: String(r.id),
      action: r.action,
      actorName:
        r.actorUserId == null ? null : (actorMap.get(r.actorUserId) ?? null),
      createdAt: r.createdAt.toISOString(),
      payload: r.payload,
    }));

    // --- health ----------------------------------------------------
    const spendRate =
      detail.budgetAmount != null && detail.budgetAmount > 0
        ? Math.min(1, detail.spendTotal / detail.budgetAmount)
        : null;
    const revenueVsBudget =
      detail.budgetAmount != null &&
      detail.budgetAmount > 0 &&
      detail.revenueRecorded != null
        ? detail.revenueRecorded / detail.budgetAmount
        : null;
    const daysToCloseout = detail.endDate
      ? Math.ceil(
          (new Date(detail.endDate).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      : null;
    const uncontactedKolCount = await tx.kolCampaign.count({
      where: {
        campaignId,
        status: { in: [...PIPELINE_NOT_PAID] },
      },
    });

    return {
      emailSeries,
      activity,
      health: {
        spendRate,
        revenueVsBudget,
        daysToCloseout,
        uncontactedKolCount,
      },
    };
  });
}
