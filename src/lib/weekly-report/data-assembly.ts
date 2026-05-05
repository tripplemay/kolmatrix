/**
 * BM2-F010 · Tenant-scoped data assembly for the weekly report AI call.
 *
 * Produces the 3 JSON payloads the aigcgateway action expects:
 *   - kolActivity            (this week's flow)
 *   - roiData                (cumulative all-time state, mirrors F008)
 *   - prevWeekComparison     (this week's flow vs prior week's flow)
 *
 * Per Planner adjudication §13.2 sample, prev_week_comparison is "+20%"
 * style strings, and the value is null (→ empty string in the wire
 * payload) when there is no meaningful prior week to compare to.
 *
 * All queries run inside `withTenant`; the helper composes existing
 * F008 loaders rather than re-implementing aggregation.
 */
import { withTenant } from "@/lib/db";
import { loadRoiSummary } from "@/lib/roi/queries";

import { isoWeekEndUtc, isoWeekStartUtc } from "./dates";
import type {
  KolActivityShape,
  PrevWeekComparisonShape,
  RoiDataShape,
} from "./generate";

const DAY_MS = 24 * 60 * 60 * 1000;

// Re-exported for callers that already import the helpers from
// `./data-assembly`. New code should import from `./dates` directly.
export { isoWeekEndUtc, isoWeekStartUtc };

interface AssembleArgs {
  tenantId: string;
  weekStart: Date; // Monday 00:00 UTC
  weekEnd: Date; // Sunday 00:00 UTC (inclusive day)
}

export interface AssembledReportData {
  kolActivity: KolActivityShape;
  roiData: RoiDataShape;
  prevWeekComparison: PrevWeekComparisonShape | null;
}

function formatDelta(thisWeek: number, lastWeek: number): string {
  if (lastWeek === 0) {
    return thisWeek === 0 ? "0%" : "n/a";
  }
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export async function assembleWeeklyReportInput({
  tenantId,
  weekStart,
  weekEnd,
}: AssembleArgs): Promise<AssembledReportData> {
  // Sunday 23:59:59.999 UTC as the inclusive upper bound for date ranges.
  const weekEndExclusive = new Date(weekEnd.getTime() + DAY_MS);
  // BL-024-F003: prev period mirrors the current period length so
  // lastMonth (28d) compares against the previous 28d block, not the
  // previous 7d block. Round-trip via Math.round absorbs any DST jitter.
  const periodDays = Math.max(
    1,
    Math.round((weekEndExclusive.getTime() - weekStart.getTime()) / DAY_MS)
  );
  const prevWeekStart = new Date(weekStart.getTime() - periodDays * DAY_MS);

  return withTenant(tenantId, async (tx) => {
    const [
      newPartnerships,
      statusChangeRows,
      emailsSent,
      aiCustomizedEmails,
      campaignsThisWeek,
      campaignsLastWeek,
    ] = await Promise.all([
      tx.kolCampaign.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEndExclusive },
        },
      }),
      tx.auditLog.findMany({
        where: {
          resourceType: "kol",
          action: "kol.relationship_changed",
          createdAt: { gte: weekStart, lt: weekEndExclusive },
        },
        select: {
          payload: true,
          resourceId: true,
        },
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
      tx.emailLog.count({
        where: {
          status: { in: ["sent", "delivered", "opened", "replied"] },
          sentAt: { gte: weekStart, lt: weekEndExclusive },
        },
      }),
      tx.emailLog.count({
        where: {
          aiCustomized: true,
          sentAt: { gte: weekStart, lt: weekEndExclusive },
        },
      }),
      tx.campaign.findMany({
        where: {
          status: "completed",
          closedAt: { gte: weekStart, lt: weekEndExclusive },
        },
        select: { spendTotal: true, revenueRecorded: true },
      }),
      tx.campaign.findMany({
        where: {
          status: "completed",
          closedAt: { gte: prevWeekStart, lt: weekStart },
        },
        select: { spendTotal: true, revenueRecorded: true },
      }),
    ]);

    const summary = await loadRoiSummary(tenantId);

    const statusChanges = statusChangeRows
      .map((row) => {
        const payload = (row.payload ?? {}) as {
          before?: { status?: unknown; kolName?: unknown };
          after?: { status?: unknown; kolName?: unknown };
        };
        const from = String(payload.before?.status ?? "");
        const to = String(payload.after?.status ?? "");
        const kol = String(
          payload.after?.kolName ?? payload.before?.kolName ?? row.resourceId
        );
        return { kol, from, to };
      })
      .filter((c) => c.from && c.to)
      .slice(0, 10);

    const sumDecimal = (
      rows: Array<{ spendTotal: { toString(): string }; revenueRecorded: { toString(): string } | null }>,
      key: "spendTotal" | "revenueRecorded"
    ): number => {
      let total = 0;
      for (const r of rows) {
        const v = r[key];
        if (v != null) total += Number(v.toString());
      }
      return total;
    };

    const thisWeekSpend = sumDecimal(campaignsThisWeek, "spendTotal");
    const thisWeekRevenue = sumDecimal(campaignsThisWeek, "revenueRecorded");
    const lastWeekSpend = sumDecimal(campaignsLastWeek, "spendTotal");
    const lastWeekRevenue = sumDecimal(campaignsLastWeek, "revenueRecorded");

    const prevWeekComparison: PrevWeekComparisonShape | null =
      campaignsLastWeek.length === 0 && campaignsThisWeek.length === 0
        ? null
        : {
            totalSpendDelta: formatDelta(thisWeekSpend, lastWeekSpend),
            totalRevenueDelta: formatDelta(thisWeekRevenue, lastWeekRevenue),
          };

    return {
      kolActivity: {
        newPartnerships,
        statusChanges,
        emailsSent,
        aiCustomizedEmails,
      },
      roiData: {
        totalSpend: summary.totalSpend,
        totalRevenue: summary.totalRevenue,
        avgRoiPercent: summary.avgRoiPercent,
        topCampaign: summary.topCampaign
          ? {
              name: summary.topCampaign.name,
              roiPercent: summary.topCampaign.roiPercent,
            }
          : null,
      },
      prevWeekComparison,
    };
  });
}
