/**
 * BM2-F003 · Campaign list query (tenant-scoped via withTenant).
 *
 * Responsibilities:
 *   - Apply the filter's WHERE + cursor pagination via BI4-F004 util
 *   - Aggregate KOL-count per campaign in a single groupBy (avoid N+1)
 *   - Return denormalised row shape ready for the table renderer
 *   - Expose `totalCount` so the UI can distinguish "tenant has 0
 *     campaigns" (empty-state CTA) from "filters return 0 rows"
 *     (adjust-filters hint) per adjudication §7 #F
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import { createCursorPaginator } from "@/lib/pagination/cursor";
import { computeCampaignRoi } from "@/lib/roi/compute";

import { buildCampaignWhere, type CampaignListFilters } from "./filters";

export interface CampaignListRow {
  id: string;
  name: string;
  status: string;
  startDate: string | null; // ISO
  endDate: string | null;
  closedAt: string | null;
  budgetAmount: number | null;
  spendTotal: number;
  revenueRecorded: number | null;
  roiPercent: number | null; // null when status != completed or spend = 0
  kolCount: number;
  ownerName: string | null;
  product: { id: string; name: string; category: string } | null;
  createdAt: string;
}

export interface CampaignListResult {
  items: CampaignListRow[];
  nextCursor: string | null;
  hasMore: boolean;
  /**
   * Total rows visible to the tenant, regardless of the current
   * filter. Used by the UI to switch between the "no campaigns yet"
   * CTA and the "no matches — tweak filters" hint.
   */
  tenantTotalCount: number;
}

const PAGE_SIZE = 20;

type RawCampaignRow = Prisma.CampaignGetPayload<{
  select: {
    id: true;
    name: true;
    status: true;
    startDate: true;
    endDate: true;
    closedAt: true;
    budgetAmount: true;
    spendTotal: true;
    revenueRecorded: true;
    createdAt: true;
    owner: { select: { name: true } };
    product: { select: { id: true; name: true; category: true } };
  };
}>;

/**
 * Status-gated ROI% wrapper around F008's `computeCampaignRoi`.
 *
 * The ROI engine itself is status-agnostic; the campaigns list +
 * detail UIs only show ROI for completed campaigns (so a partially-
 * spent active draft doesn't display a misleading "ROI"). This thin
 * helper enforces that gate at the boundary.
 */
export function computeRoiPercentInline(
  spend: number,
  revenue: number | null,
  status: string
): number | null {
  if (status !== "completed") return null;
  return computeCampaignRoi({
    spendTotal: spend,
    revenueRecorded: revenue,
  }).roiPercent;
}

export async function runCampaignListSearch(
  tenantId: string,
  filters: CampaignListFilters
): Promise<CampaignListResult> {
  const where = buildCampaignWhere(filters);

  return withTenant(tenantId, async (tx) => {
    const tenantTotalCount = await tx.campaign.count({});

    const paginator = createCursorPaginator<
      RawCampaignRow,
      Prisma.CampaignWhereInput
    >({
      model: {
        findMany: (args) =>
          tx.campaign.findMany({
            ...(args as Prisma.CampaignFindManyArgs),
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true,
              closedAt: true,
              budgetAmount: true,
              spendTotal: true,
              revenueRecorded: true,
              createdAt: true,
              owner: { select: { name: true } },
              product: { select: { id: true, name: true, category: true } },
            },
          }) as unknown as Promise<unknown[]>,
      },
      defaultOrderBy: "createdAt",
      defaultLimit: PAGE_SIZE,
      maxLimit: PAGE_SIZE,
    });

    const page = await paginator.query({
      where,
      cursor: filters.cursor,
      orderBy: "createdAt",
      direction: "desc",
      limit: PAGE_SIZE,
    });

    const campaignIds = page.items.map((c) => c.id);
    const kolCountMap = new Map<string, number>();
    if (campaignIds.length > 0) {
      const counts = await tx.kolCampaign.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds } },
        _count: { _all: true },
      });
      for (const c of counts) {
        kolCountMap.set(c.campaignId, c._count._all);
      }
    }

    const items: CampaignListRow[] = page.items.map((c) => {
      const budget =
        c.budgetAmount == null ? null : Number(c.budgetAmount.toString());
      const spend = Number(c.spendTotal.toString());
      const revenue =
        c.revenueRecorded == null
          ? null
          : Number(c.revenueRecorded.toString());
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        startDate: c.startDate ? c.startDate.toISOString() : null,
        endDate: c.endDate ? c.endDate.toISOString() : null,
        closedAt: c.closedAt ? c.closedAt.toISOString() : null,
        budgetAmount: budget,
        spendTotal: spend,
        revenueRecorded: revenue,
        roiPercent: computeRoiPercentInline(spend, revenue, c.status),
        kolCount: kolCountMap.get(c.id) ?? 0,
        ownerName: c.owner?.name ?? null,
        product: c.product
          ? {
              id: c.product.id,
              name: c.product.name,
              category: c.product.category,
            }
          : null,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return {
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      tenantTotalCount,
    };
  });
}
