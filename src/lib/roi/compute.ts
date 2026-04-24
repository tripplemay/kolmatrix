/**
 * BM2-F008 · ROI compute pure functions.
 *
 * Number-only API (no Prisma `Decimal` dep) so the helpers stay
 * trivially unit-testable from any caller. The DB-side queries in
 * `./queries.ts` convert Decimal columns at the boundary before
 * passing into these.
 *
 * Rules (spec §F008):
 *   - revenue null              → roiPercent = null, netProfit = 0
 *   - spend ≤ 0 (with revenue)  → roiPercent = null, netProfit = revenue
 *   - normal case               → netProfit = revenue - spend,
 *                                 roiPercent = netProfit / spend × 100
 *
 * Rounded to 1 decimal place to keep the wire payload tidy; the UI
 * formats further.
 */

export interface RoiResult {
  roiPercent: number | null;
  netProfit: number;
}

export function computeCampaignRoi(input: {
  spendTotal: number;
  revenueRecorded: number | null;
}): RoiResult {
  if (input.revenueRecorded == null) {
    return { roiPercent: null, netProfit: 0 };
  }
  const net = input.revenueRecorded - input.spendTotal;
  if (!Number.isFinite(input.spendTotal) || input.spendTotal <= 0) {
    return { roiPercent: null, netProfit: net };
  }
  const pct = Math.round((net / input.spendTotal) * 1000) / 10;
  return { roiPercent: pct, netProfit: net };
}

export interface RoiTrendPoint {
  date: string; // ISO YYYY-MM-DD
  spendTotal: number;
  revenue: number;
  roiPercent: number | null;
}

export interface RoiTrendCampaign {
  /** Day the campaign was closed; rows without `closedAt` are skipped. */
  closedAt: Date;
  spendTotal: number;
  revenueRecorded: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayStart(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * Bucket completed campaigns into N daily slots ending today (UTC).
 * Spend / revenue are whole-campaign numbers tagged with `closedAt`,
 * so a campaign closed on day D contributes its full totals to slot D.
 */
export function computeRoiTrend(
  campaigns: RoiTrendCampaign[],
  days: number,
  /** Test injection — defaults to "today UTC". */
  nowMs: number = Date.now()
): RoiTrendPoint[] {
  if (days <= 0) return [];
  const todayStart = dayStart(new Date(nowMs)).getTime();
  const earliestDayStart = todayStart - (days - 1) * DAY_MS;

  const buckets = new Map<string, { spend: number; revenue: number }>();
  for (let i = 0; i < days; i += 1) {
    const dayMs = earliestDayStart + i * DAY_MS;
    buckets.set(isoDay(new Date(dayMs)), { spend: 0, revenue: 0 });
  }

  for (const c of campaigns) {
    const t = c.closedAt.getTime();
    if (t < earliestDayStart || t > todayStart + DAY_MS - 1) continue;
    const key = isoDay(c.closedAt);
    const entry = buckets.get(key);
    if (!entry) continue;
    entry.spend += c.spendTotal;
    entry.revenue += c.revenueRecorded ?? 0;
  }

  return Array.from(buckets.entries()).map(([date, agg]) => {
    const { roiPercent } = computeCampaignRoi({
      spendTotal: agg.spend,
      revenueRecorded: agg.revenue > 0 ? agg.revenue : null,
    });
    return {
      date,
      spendTotal: Math.round(agg.spend * 100) / 100,
      revenue: Math.round(agg.revenue * 100) / 100,
      // If both spend and revenue are zero we want a "no data" marker
      // (null) rather than a misleading 0%.
      roiPercent: agg.spend === 0 && agg.revenue === 0 ? null : roiPercent,
    };
  });
}

export interface RoiSummaryCampaign {
  id: string;
  name: string;
  status: string;
  spendTotal: number;
  revenueRecorded: number | null;
}

export interface RoiSummary {
  totalSpend: number;
  totalRevenue: number;
  /** Mean of all completed campaigns' ROI%; null when no completed
   *  campaign has both a positive spend and a recorded revenue. */
  avgRoiPercent: number | null;
  topCampaign: { id: string; name: string; roiPercent: number } | null;
  campaignCount: { active: number; completed: number };
}

/**
 * Top-line summary for the /roi page. Active vs completed counts use
 * the campaign.status string as-is (caller is expected to have already
 * filtered by tenant). avgRoi looks only at *completed* campaigns
 * with both a positive spend and a non-null revenue — partial data
 * stays out of the mean to avoid distortions.
 */
export function computeRoiSummary(
  campaigns: RoiSummaryCampaign[]
): RoiSummary {
  let totalSpend = 0;
  let totalRevenue = 0;
  let active = 0;
  let completed = 0;
  const completedRois: Array<{
    id: string;
    name: string;
    roiPercent: number;
  }> = [];

  for (const c of campaigns) {
    totalSpend += c.spendTotal;
    if (c.revenueRecorded != null) totalRevenue += c.revenueRecorded;
    if (c.status === "active") active += 1;
    if (c.status === "completed") {
      completed += 1;
      const { roiPercent } = computeCampaignRoi({
        spendTotal: c.spendTotal,
        revenueRecorded: c.revenueRecorded,
      });
      if (roiPercent != null) {
        completedRois.push({ id: c.id, name: c.name, roiPercent });
      }
    }
  }

  const avgRoiPercent =
    completedRois.length > 0
      ? Math.round(
          (completedRois.reduce((acc, r) => acc + r.roiPercent, 0) /
            completedRois.length) *
            10
        ) / 10
      : null;

  let topCampaign: RoiSummary["topCampaign"] = null;
  for (const r of completedRois) {
    if (!topCampaign || r.roiPercent > topCampaign.roiPercent) {
      topCampaign = r;
    }
  }

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgRoiPercent,
    topCampaign,
    campaignCount: { active, completed },
  };
}
