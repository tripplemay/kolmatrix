/**
 * BM2-F008 · Tenant-scoped Prisma loaders for the ROI page + APIs.
 *
 * All queries run inside `withTenant`. Decimal columns convert to
 * `number` at the boundary so the pure helpers in `./compute.ts`
 * stay framework-free.
 *
 * BL-024-F002: `loadRoiSummary` / `loadRoiCampaigns` accept an optional
 * `RoiRange`. Range filters apply to `closedAt` for completed campaigns
 * only — active campaign counts always reflect "currently active"
 * regardless of the toggle. Default `allTime` preserves the legacy
 * "no filter" behavior for callers (`/api/roi/*`, weekly-report assembly,
 * dashboard) that don't pass a range. `loadRoiTrend` keeps its
 * `days: number` argument so the existing `?days=N` API stays stable;
 * the page derives `days` via `rangeDays(range)`.
 */
import { withTenant } from "@/lib/db";

import {
  computeCampaignRoi,
  computeRoiSummary,
  computeRoiTrend,
  type RoiSummary,
  type RoiTrendPoint,
} from "./compute";
import { rangeStart, type RoiRange } from "./range";

function decimalToNumber(d: { toString(): string } | null): number | null {
  return d == null ? null : Number(d.toString());
}

export interface RoiCampaignRow {
  id: string;
  name: string;
  status: string;
  spendTotal: number;
  revenueRecorded: number | null;
  roiPercent: number | null;
  netProfit: number;
  closedAt: string | null;
  productName: string | null;
}

export async function loadRoiSummary(
  tenantId: string,
  range: RoiRange = "allTime",
  /** Test injection — defaults to current time. */
  nowMs?: number
): Promise<RoiSummary> {
  const cutoff = rangeStart(range, nowMs ? new Date(nowMs) : undefined);
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.campaign.findMany({
      where: {
        deletedAt: null,
        // Limit completed campaigns to the range window; non-completed
        // (active/draft) campaigns always count so the active KPI
        // reflects "right now" regardless of the toggle.
        ...(cutoff
          ? {
              OR: [
                { status: { not: "completed" } },
                { closedAt: { gte: cutoff } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        spendTotal: true,
        revenueRecorded: true,
      },
    });
    return computeRoiSummary(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        spendTotal: Number(r.spendTotal.toString()),
        revenueRecorded: decimalToNumber(r.revenueRecorded),
      }))
    );
  });
}

export async function loadRoiTrend(
  tenantId: string,
  days: number,
  /** Test injection — defaults to current time. */
  nowMs?: number
): Promise<RoiTrendPoint[]> {
  return withTenant(tenantId, async (tx) => {
    const since = new Date((nowMs ?? Date.now()) - days * 86_400_000);
    const rows = await tx.campaign.findMany({
      where: {
        status: "completed",
        closedAt: { gte: since },
      },
      select: {
        closedAt: true,
        spendTotal: true,
        revenueRecorded: true,
      },
    });
    return computeRoiTrend(
      rows
        .filter(
          (r): r is typeof r & { closedAt: Date } => r.closedAt != null
        )
        .map((r) => ({
          closedAt: r.closedAt,
          spendTotal: Number(r.spendTotal.toString()),
          revenueRecorded: decimalToNumber(r.revenueRecorded),
        })),
      days,
      nowMs
    );
  });
}

export async function loadRoiCampaigns(
  tenantId: string,
  range: RoiRange = "allTime",
  /** Test injection — defaults to current time. */
  nowMs?: number
): Promise<RoiCampaignRow[]> {
  const cutoff = rangeStart(range, nowMs ? new Date(nowMs) : undefined);
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.campaign.findMany({
      where: {
        status: "completed",
        deletedAt: null,
        ...(cutoff ? { closedAt: { gte: cutoff } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        spendTotal: true,
        revenueRecorded: true,
        closedAt: true,
        product: { select: { name: true } },
      },
    });
    const enriched = rows.map((r) => {
      const spend = Number(r.spendTotal.toString());
      const revenue = decimalToNumber(r.revenueRecorded);
      const { roiPercent, netProfit } = computeCampaignRoi({
        spendTotal: spend,
        revenueRecorded: revenue,
      });
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        spendTotal: spend,
        revenueRecorded: revenue,
        roiPercent,
        netProfit,
        closedAt: r.closedAt ? r.closedAt.toISOString() : null,
        productName: r.product?.name ?? null,
      };
    });
    // ROI desc; nulls last (use −Infinity for sort stability).
    enriched.sort(
      (a, b) =>
        (b.roiPercent ?? Number.NEGATIVE_INFINITY) -
        (a.roiPercent ?? Number.NEGATIVE_INFINITY)
    );
    return enriched;
  });
}
