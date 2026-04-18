/**
 * Dashboard server-side data layer.
 *
 * 并行查询 6 项（KPI 4 + campaigns + topKols），以及 Prisma row →
 * Dashboard component props 的 mapper。抽到独立文件以确保 page.tsx JSX
 * ≤ 80 行。所有 mapper 都是纯函数，不直接导入 Prisma client。
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
  const [kolCount, activeCampaigns, emailsSent7d, aiScoreAgg, campaigns, topKols] =
    await Promise.all([
      tx.kol.count(),
      tx.campaign.count({ where: { status: "active" } }),
      tx.emailLog.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
      tx.kol.aggregate({ _avg: { aiScore: true } }),
      tx.campaign.findMany({
        where: { status: { in: ["active", "completed"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: { _count: { select: { kolCampaigns: true } } },
      }),
      tx.kol.findMany({
        where: { status: "active" },
        orderBy: { aiScore: "desc" },
        take: 4,
      }),
    ]);
  return {
    kolCount,
    activeCampaigns,
    emailsSent7d,
    avgAiScore: Number(aiScoreAgg._avg.aiScore ?? 0),
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
    aiScore: k.aiScore ?? 0,
    platform,
    tags: k.categories.slice(0, 2),
  };
}
