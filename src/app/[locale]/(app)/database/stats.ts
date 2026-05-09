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
      tx.kol.count({ where: { isSaved: true, deletedAt: null } }),
      tx.kol.count({
        where: {
          isSaved: true,
          deletedAt: null,
          relationshipStatus: { in: [...ACTIVE_STATUSES] },
        },
      }),
      tx.kol.aggregate({
        where: { isSaved: true, deletedAt: null },
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

const BASELINE = {
  FPS: 0.2,
  MOBA: 0.15,
  RPG: 0.15,
  mobile: 0.15,
  Casual: 0.2,
  Esports: 0.1,
  Other: 0.05,
} as const;

const CATEGORY_MAP: Record<string, keyof typeof BASELINE> = {
  FPS: "FPS",
  shooter: "FPS",
  battle_royale: "FPS",
  MOBA: "MOBA",
  RPG: "RPG",
  mmorpg: "RPG",
  mobile: "mobile",
  mobile_gaming: "mobile",
  Casual: "Casual",
  party: "Casual",
  simulation: "Casual",
  Esports: "Esports",
};

export interface CoverageGapRow {
  category: keyof typeof BASELINE;
  baselinePct: number;
  actualPct: number;
  deltaPct: number;
}

export interface CoverageGapSummary {
  rows: CoverageGapRow[];
  topMissing: CoverageGapRow[];
}

function toBucket(raw: string): keyof typeof BASELINE {
  return CATEGORY_MAP[raw] ?? "Other";
}

export async function loadCoverageGapSummary(
  tenantId: string
): Promise<CoverageGapSummary> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.kol.findMany({
      where: {
        isSaved: true,
        deletedAt: null,
        isSuspicious: false,
      },
      select: {
        categories: true,
      },
    });

    const counts: Record<keyof typeof BASELINE, number> = {
      FPS: 0,
      MOBA: 0,
      RPG: 0,
      mobile: 0,
      Casual: 0,
      Esports: 0,
      Other: 0,
    };

    let totalTagged = 0;
    for (const row of rows) {
      if (!row.categories.length) {
        counts.Other += 1;
        totalTagged += 1;
        continue;
      }
      for (const cat of row.categories) {
        counts[toBucket(cat)] += 1;
        totalTagged += 1;
      }
    }

    const matrix = (Object.keys(BASELINE) as Array<keyof typeof BASELINE>).map(
      (key) => {
        const actualPct = totalTagged === 0 ? 0 : counts[key] / totalTagged;
        const baselinePct = BASELINE[key];
        return {
          category: key,
          baselinePct,
          actualPct,
          deltaPct: actualPct - baselinePct,
        };
      }
    );

    const topMissing = [...matrix]
      .sort((a, b) => a.deltaPct - b.deltaPct)
      .slice(0, 2);

    return { rows: matrix, topMissing };
  });
}
