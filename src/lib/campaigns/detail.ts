/**
 * BM2-F005 · Campaign detail query (tenant-scoped).
 *
 * Loads a single campaign with its product link and full KOL roster.
 * Returns `null` when the id is outside the tenant (RLS filtered) or
 * doesn't exist, so callers can 404 without a second round-trip.
 *
 * The KOL roster denormalises the join row plus the creator card so
 * the page can render without additional fetches: avatar, handle,
 * platform, follower count, contactStatus, kolFee, and whether the
 * creator has an email on file (drives F006's send-all gating).
 */
import { withTenant } from "@/lib/db";

import { computeRoiPercentInline } from "./search";

export interface CampaignKolRow {
  kolCampaignId: string;
  kolId: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
  hasEmail: boolean;
  contactStatus: string;
  kolFee: number | null;
  addedAt: string;
}

export interface CampaignDetailRow {
  id: string;
  name: string;
  status: string;
  game: string | null;
  markets: string[];
  kpiTarget: unknown;
  budgetAmount: number | null;
  budgetCurrency: string;
  spendTotal: number;
  revenueRecorded: number | null;
  roiPercent: number | null;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
  ownerName: string | null;
  product: {
    id: string;
    name: string;
    category: string;
    downloadUrl: string | null;
    // BL-066-F002 — surfaced for BriefSummaryPanel Demographics column
    // (per F002 audit §裁决 #1=A: product.targetAudience 直显). Schema
    // guarantees non-null String, so no fallback parsing needed.
    targetAudience: string;
    // BL-051a-F009 — surfaces tombstoned products to the detail UI so
    // the campaign card shows "(Product deleted)" instead of broken
    // metadata. F007 already prevents new campaigns from picking a
    // soft-deleted product, but pre-existing campaigns can still
    // reference one.
    isDeleted: boolean;
  } | null;
  kols: CampaignKolRow[];
}

export async function runCampaignDetail(
  tenantId: string,
  id: string
): Promise<CampaignDetailRow | null> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        game: true,
        markets: true,
        kpiTarget: true,
        budgetAmount: true,
        budgetCurrency: true,
        spendTotal: true,
        revenueRecorded: true,
        startDate: true,
        endDate: true,
        startedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        ownerUserId: true,
        owner: { select: { name: true } },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            downloadUrl: true,
            // BL-066-F002: needed by BriefSummaryPanel Demographics col.
            targetAudience: true,
            // BL-051a-F009: include the tombstone flag so the UI can
            // render the "(Product deleted)" defense. Prisma relation
            // includes don't auto-filter on deletedAt, so a soft-
            // deleted product still loads here.
            deletedAt: true,
          },
        },
        kolCampaigns: {
          select: {
            id: true,
            status: true,
            kolFee: true,
            createdAt: true,
            kol: {
              select: {
                id: true,
                displayName: true,
                handle: true,
                platform: true,
                avatarUrl: true,
                followerCount: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!row) return null;

    const budgetAmount =
      row.budgetAmount == null ? null : Number(row.budgetAmount.toString());
    const spend = Number(row.spendTotal.toString());
    const revenue =
      row.revenueRecorded == null
        ? null
        : Number(row.revenueRecorded.toString());

    const kols: CampaignKolRow[] = row.kolCampaigns.map((kc) => ({
      kolCampaignId: kc.id,
      kolId: kc.kol.id,
      displayName: kc.kol.displayName,
      handle: kc.kol.handle,
      platform: kc.kol.platform,
      avatarUrl: kc.kol.avatarUrl,
      followerCount: kc.kol.followerCount,
      hasEmail: Boolean(kc.kol.email && kc.kol.email.length > 0),
      contactStatus: kc.status,
      kolFee: kc.kolFee == null ? null : Number(kc.kolFee.toString()),
      addedAt: kc.createdAt.toISOString(),
    }));

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      game: row.game,
      markets: row.markets,
      kpiTarget: row.kpiTarget,
      budgetAmount,
      budgetCurrency: row.budgetCurrency,
      spendTotal: spend,
      revenueRecorded: revenue,
      roiPercent: computeRoiPercentInline(spend, revenue, row.status),
      startDate: row.startDate ? row.startDate.toISOString() : null,
      endDate: row.endDate ? row.endDate.toISOString() : null,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ownerUserId: row.ownerUserId,
      ownerName: row.owner?.name ?? null,
      product: row.product
        ? {
            id: row.product.id,
            name: row.product.name,
            category: row.product.category,
            downloadUrl: row.product.downloadUrl,
            targetAudience: row.product.targetAudience,
            isDeleted: row.product.deletedAt !== null,
          }
        : null,
      kols,
    };
  });
}

/**
 * Candidates NOT yet in the campaign. Used by the AddKolDialog.
 *
 * BL-063 F001: pool widened from "isSaved=true" to all non-soft-deleted
 * KOLs. ADR-013 deprecates the saved/discovered split — every campaign
 * pulls from the full tenant pool. The 100-row cap is MVP scaffolding;
 * BL-064+ replaces this with the AI-native recommend-by-relevance flow.
 */
export async function runAvailableKolsForCampaign(
  tenantId: string,
  campaignId: string
): Promise<
  Array<{
    id: string;
    displayName: string;
    handle: string;
    platform: string;
    avatarUrl: string | null;
    followerCount: number;
  }>
> {
  return withTenant(tenantId, async (tx) => {
    const linked = await tx.kolCampaign.findMany({
      where: { campaignId },
      select: { kolId: true },
    });
    const exclude = new Set(linked.map((l) => l.kolId));
    const pool = await tx.kol.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        handle: true,
        platform: true,
        avatarUrl: true,
        followerCount: true,
      },
      orderBy: [{ valueScore: "desc" }, { createdAt: "desc" }],
      take: 200, // small safety cap before the Set filter
    });
    return pool.filter((k) => !exclude.has(k.id)).slice(0, 100);
  });
}
