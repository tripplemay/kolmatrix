/**
 * Dashboard mocks — F007 决议 #3：email chart 14 天 + activity feed 5 条
 * 都是 mock。集中在此单文件，便于 B3+ 替换成真实数据 point-of-replacement。
 */

export interface EmailPerfPoint {
  date: string;
  sent: number;
  opened: number;
  replied: number;
}

export interface ActivityItem {
  id: string;
  icon: string;
  accent: "cyan" | "purple" | "secondary";
  text: string;
  time: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function buildEmailPerformanceSeries(length: number): EmailPerfPoint[] {
  const base = new Date();
  return Array.from({ length }).map((_, i) => {
    const d = new Date(base.getTime() - (length - 1 - i) * DAY_MS);
    const sent = 760 + Math.round(Math.sin(i / 2) * 140) + i * 32;
    const opened = Math.round(sent * (0.58 + Math.sin(i / 3) * 0.06));
    const replied = Math.round(opened * (0.18 + Math.cos(i / 4) * 0.03));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sent,
      opened,
      replied,
    };
  });
}

export const EMAIL_PERFORMANCE_DATA: EmailPerfPoint[] = buildEmailPerformanceSeries(14);

export const RECENT_ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    icon: "mail",
    accent: "cyan",
    text: "Batch email sent to 45 KOLs",
    time: "Honor of Kings Campaign · 10m ago",
  },
  {
    id: "2",
    icon: "check_circle",
    accent: "purple",
    text: "GamerXia accepted invite",
    time: "Genshin Impact · 1h ago",
  },
  {
    id: "3",
    icon: "publish",
    accent: "secondary",
    text: "New video published by ProGamerKR",
    time: "PUBG Mobile · 3h ago",
  },
  {
    id: "4",
    icon: "campaign",
    accent: "secondary",
    text: "Campaign draft saved",
    time: "Valo Major · 5h ago",
  },
  {
    id: "5",
    icon: "auto_awesome",
    accent: "cyan",
    text: "AI generated 150 new leads",
    time: "System · 1d ago",
  },
];
