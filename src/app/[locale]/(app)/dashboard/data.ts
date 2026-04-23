/**
 * Dashboard server-side data layer.
 *
 * BM1-F007: swapped from mock / ai_score → real tenant data:
 *   - kolCount filtered to isGaming=true (gaming-focused MVP view)
 *   - valueScoreAvg replaces ai_score-based avg (MVP uses the formula
 *     from src/lib/kol/value-score.ts, normalised 0–100)
 *   - topKols sorted by valueScore (not ai_score), returns 5 rows
 *   - new productCount for the Products KPI tile
 *   - activeCampaigns / emailsSent7d stay real but will read 0 until
 *     BM2 ships Campaign / Email flows
 *
 * All mapper helpers stay pure — no Prisma imports — so they can be
 * composed without pulling the client into the test bundle.
 */
import type { TenantPrisma } from "@/lib/db";

export type Platform = "youtube" | "twitch" | "tiktok" | "instagram";

export interface DashboardCampaign {
  id: string;
  name: string;
  subtitle: string;
  progress: number;
  openRate: string;
  status: "active" | "completed";
}

export interface DashboardKol {
  id: string;
  name: string;
  avatar: string | null;
  followers: string;
  aiScore: number;
  platform: Platform;
  tags: string[];
}

const PLATFORMS: readonly Platform[] = ["youtube", "twitch", "tiktok", "instagram"];
function normalizePlatform(raw: string): Platform {
  return (PLATFORMS.includes(raw as Platform) ? raw : "youtube") as Platform;
}

function formatFollowers(count: number, platform: Platform): string {
  const unit = platform === "youtube" ? "Subs" : "Foll";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M ${unit}`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K ${unit}`;
  return `${count} ${unit}`;
}

export async function fetchDashboardData(tx: TenantPrisma) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    kolCount,
    productCount,
    activeCampaigns,
    emailsSent7d,
    valueScoreAgg,
    campaigns,
    topKols,
  ] = await Promise.all([
    tx.kol.count({ where: { isGaming: true } }),
    tx.product.count(),
    tx.campaign.count({ where: { status: "active" } }),
    tx.emailLog.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
    tx.kol.aggregate({
      _avg: { valueScore: true },
      where: { isGaming: true, valueScore: { not: null } },
    }),
    tx.campaign.findMany({
      where: { status: { in: ["active", "completed"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { _count: { select: { kolCampaigns: true } } },
    }),
    tx.kol.findMany({
      where: { isGaming: true },
      orderBy: [{ valueScore: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);

  const avgRaw = valueScoreAgg._avg.valueScore;
  const avgValueScore =
    avgRaw == null ? 0 : Math.round(Number(avgRaw.toString()));

  return {
    kolCount,
    productCount,
    activeCampaigns,
    emailsSent7d,
    avgValueScore,
    campaigns,
    topKols,
  };
}

type CampaignRow = Awaited<ReturnType<typeof fetchDashboardData>>["campaigns"][number];
type KolRow = Awaited<ReturnType<typeof fetchDashboardData>>["topKols"][number];

export function mapCampaign(c: CampaignRow): DashboardCampaign {
  const launchLabel = c.markets[0] ?? "Global";
  const rate = c.openRate ? Number(c.openRate) : 0;
  return {
    id: c.id,
    name: c.name,
    subtitle: `${launchLabel} Launch · ${c._count.kolCampaigns} KOLs`,
    progress: c.status === "completed" ? 100 : 75,
    openRate: `${(rate * 100).toFixed(1)}%`,
    status: c.status === "completed" ? "completed" : "active",
  };
}

export function mapKol(k: KolRow): DashboardKol {
  const platform = normalizePlatform(k.platform);
  return {
    id: k.id,
    name: k.displayName,
    avatar: null,
    followers: formatFollowers(k.followerCount, platform),
    aiScore: k.valueScore ?? 0,
    platform,
    tags: k.categories.slice(0, 2),
  };
}
