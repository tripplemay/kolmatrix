/**
 * MVP-vf-F004 · Tenant-scoped KPI strip on /campaigns.
 *
 * Four cards in the header reflect the tenant's full state regardless
 * of the filter row (so the marketer sees the at-a-glance health even
 * when they're zoomed into a status chip). Computed alongside the row
 * search via `Promise.all` so the page-level data load is one round.
 */
import { withTenant } from "@/lib/db";

export interface CampaignsListKpis {
  /** count(Campaign WHERE status='active'). */
  activeCampaigns: number;
  /**
   * Σ KolCampaign rows whose status is not yet terminal. Spec phrasing
   * "NOT IN (terminated, paid)" maps onto our 6-stage enum: only
   * `paid` is the terminal value (`terminated` is a Kol.relationship
   * concept, not a KolCampaign one). Anything pre-paid counts as
   * "in pipeline".
   */
  kolsInPipeline: number;
  /**
   * EmailLog reply-rate as a 0..1 fraction. `null` when no emails have
   * been sent yet — the UI renders "—" rather than 0% to make the
   * absence of data obvious.
   */
  avgReplyRate: number | null;
  /**
   * Σ Kol.followerCount over KOLs linked to ANY active campaign. The
   * Stitch prototype labels this "Reach Forecast"; this is the closest
   * deterministic proxy without a real audience-overlap engine.
   */
  reachForecast: number;
}

const ACTIVE_STATUS = "active";
const PIPELINE_STATUSES = [
  "pending",
  "contacted",
  "quoted",
  "signed",
  "delivered",
] as const;
const REPLY_STATUSES = ["replied"] as const;

/**
 * Distinct non-null `Campaign.game` values in the tenant's library.
 * Drives the "Game" filter dropdown without hardcoding a master list.
 */
export async function loadKnownGames(tenantId: string): Promise<string[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.campaign.findMany({
      where: { game: { not: null } },
      distinct: ["game"],
      select: { game: true },
      orderBy: { game: "asc" },
    });
    return rows
      .map((r) => r.game)
      .filter((g): g is string => typeof g === "string" && g.length > 0);
  });
}

export interface CampaignOwnerOption {
  id: string;
  name: string;
}

/**
 * Distinct campaign owners (= users that have authored ≥ 1 campaign in
 * the tenant). Drives the BIx-mvp-polish-pass F002 P1-3 Owner filter.
 * Returns `[]` when the tenant only has a single user (caller can hide
 * the filter altogether).
 */
export async function loadCampaignOwners(
  tenantId: string
): Promise<CampaignOwnerOption[]> {
  return withTenant(tenantId, async (tx) => {
    const userCount = await tx.user.count();
    if (userCount <= 1) return [];

    const rows = await tx.campaign.findMany({
      distinct: ["ownerUserId"],
      select: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { ownerUserId: "asc" },
    });

    return rows
      .map((r) => r.owner)
      .filter((o): o is { id: string; name: string; email: string } => o != null)
      .map((o) => ({ id: o.id, name: o.name || o.email }));
  });
}

export async function loadCampaignsListKpis(
  tenantId: string
): Promise<CampaignsListKpis> {
  return withTenant(tenantId, async (tx) => {
    const [
      activeCampaigns,
      kolsInPipeline,
      replyAgg,
      reach,
    ] = await Promise.all([
      tx.campaign.count({ where: { status: ACTIVE_STATUS } }),
      tx.kolCampaign.count({
        where: { status: { in: [...PIPELINE_STATUSES] } },
      }),
      Promise.all([
        tx.emailLog.count({}),
        tx.emailLog.count({ where: { status: { in: [...REPLY_STATUSES] } } }),
      ]),
      tx.kol.aggregate({
        where: {
          kolCampaigns: {
            some: { campaign: { status: ACTIVE_STATUS } },
          },
        },
        _sum: { followerCount: true },
      }),
    ]);

    const [emailTotal, replyCount] = replyAgg;
    const avgReplyRate = emailTotal > 0 ? replyCount / emailTotal : null;
    const reachForecast = reach._sum.followerCount ?? 0;

    return {
      activeCampaigns,
      kolsInPipeline,
      avgReplyRate,
      reachForecast,
    };
  });
}
