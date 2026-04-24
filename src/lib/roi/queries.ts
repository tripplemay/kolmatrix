/**
 * BM2-F008 · Tenant-scoped Prisma loaders for the ROI page + APIs.
 *
 * All queries run inside `withTenant`. Decimal columns convert to
 * `number` at the boundary so the pure helpers in `./compute.ts`
 * stay framework-free.
 */
import { withTenant } from "@/lib/db";

import {
  computeCampaignRoi,
  computeRoiSummary,
  computeRoiTrend,
  type RoiSummary,
  type RoiTrendPoint,
} from "./compute";

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
  tenantId: string
): Promise<RoiSummary> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.campaign.findMany({
      where: { deletedAt: null },
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
  tenantId: string
): Promise<RoiCampaignRow[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.campaign.findMany({
      where: { status: "completed", deletedAt: null },
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
