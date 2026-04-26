/**
 * MVP-vf-F003 · Top KPI strip for /database (server component).
 *
 * Four cards mirror the Stitch kol-database prototype: Total KOLs,
 * Active Collabs, Avg AI Score, Follower Reach. Pulls aggregates from
 * `loadDatabaseStats(tenantId)` so the numbers sit alongside the row
 * loader and never duplicate logic.
 */
import { getTranslations } from "next-intl/server";

import { StatCard } from "@/components/common";

import type { DatabaseStats } from "./stats";

interface Props {
  stats: DatabaseStats;
}

function compactFollowers(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function QuickStats({ stats }: Props) {
  const t = await getTranslations("database.quickStats");
  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-testid="database-quick-stats"
    >
      <StatCard label={t("totalKols")} value={String(stats.total)} />
      <StatCard label={t("activeCollabs")} value={String(stats.activeCollabs)} />
      <StatCard
        label={t("avgScore")}
        value={stats.avgValueScore == null ? "—" : String(stats.avgValueScore)}
      />
      <StatCard
        label={t("followerReach")}
        value={compactFollowers(stats.followerReach)}
      />
    </div>
  );
}
