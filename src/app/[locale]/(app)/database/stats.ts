/**
 * MVP-vf-F003 · Tenant-scoped stats for the /database Quick Stats KPI strip.
 *
 * Read-only aggregation that runs alongside the row-loading search so the
 * KPI strip reflects the same filter scope (e.g. "Active Collabs" honors
 * the relationshipStatus filter when you click a status pill).
 */
import { withTenant } from "@/lib/db";

export interface DatabaseStats {
  /** Total Kol rows in the tenant where isSaved=true. */
  total: number;
  /** Kol rows whose relationshipStatus is in the "active collabs" set. */
  activeCollabs: number;
  /** Average valueScore over saved KOLs that have one. `null` if no scores yet. */
  avgValueScore: number | null;
  /** Sum of follower_count over saved KOLs. */
  followerReach: number;
}

const ACTIVE_STATUSES = ["negotiating", "long_term"] as const;

export async function loadDatabaseStats(tenantId: string): Promise<DatabaseStats> {
  return withTenant(tenantId, async (tx) => {
    const [total, activeCollabs, agg] = await Promise.all([
      tx.kol.count({ where: { isSaved: true } }),
      tx.kol.count({
        where: {
          isSaved: true,
          relationshipStatus: { in: [...ACTIVE_STATUSES] },
        },
      }),
      tx.kol.aggregate({
        where: { isSaved: true },
        _avg: { valueScore: true },
        _sum: { followerCount: true },
      }),
    ]);

    return {
      total,
      activeCollabs,
      avgValueScore:
        agg._avg.valueScore == null ? null : Math.round(agg._avg.valueScore),
      followerReach: agg._sum.followerCount ?? 0,
    };
  });
}
