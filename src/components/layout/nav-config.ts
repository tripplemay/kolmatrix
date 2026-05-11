export type NavItemId =
  | "dashboard"
  | "kol-discovery"
  | "kol-database"
  | "campaigns"
  | "email-center"
  | "knowledge-base"
  | "analytics"
  | "settings";

export interface NavItem {
  id: NavItemId;
  href: string;
  label: string;
  i18nKey: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    i18nKey: "nav.dashboard",
    icon: "dashboard",
  },
  {
    id: "kol-discovery",
    href: "/discovery",
    label: "KOL Discovery",
    i18nKey: "nav.kolDiscovery",
    icon: "travel_explore",
  },
  {
    id: "kol-database",
    href: "/database",
    label: "KOL Database",
    i18nKey: "nav.kolDatabase",
    icon: "groups",
  },
  {
    id: "campaigns",
    href: "/campaigns",
    label: "Campaigns",
    i18nKey: "nav.campaigns",
    icon: "rocket_launch",
  },
  {
    id: "email-center",
    href: "/outreach",
    label: "Email Center",
    i18nKey: "nav.emailCenter",
    icon: "forward_to_inbox",
  },
  {
    id: "knowledge-base",
    href: "/knowledge-base",
    label: "Knowledge Base",
    i18nKey: "nav.knowledgeBase",
    icon: "inventory_2",
  },
  {
    id: "analytics",
    href: "/roi",
    label: "Analytics",
    i18nKey: "nav.analytics",
    icon: "query_stats",
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    i18nKey: "nav.settings",
    icon: "settings",
  },
];

export function deriveActiveNav(pathname: string): NavItemId {
  const path = pathname.replace(/^\/(en|zh|ja|ko|es)(?=\/|$)/, "") || "/";
  // BL-064-F001 transitional mapping — /brief /match /reach /insight 是新 IA
  // 路由壳（embed-old），F001 阶段 nav 仍是旧 8 项，把新路径映射到内容
  // 对应的旧 nav id 以保持高亮正确。F003 重写 nav-config 改为新 4-id IA
  // 后这段会一并重做。
  if (path.startsWith("/brief")) return "knowledge-base";
  if (path.startsWith("/match")) return "kol-discovery";
  if (path.startsWith("/reach")) return "email-center";
  if (path.startsWith("/insight")) return "dashboard";
  if (path.startsWith("/discovery")) return "kol-discovery";
  if (path.startsWith("/database")) return "kol-database";
  if (path.startsWith("/kols")) return "kol-database";
  if (path.startsWith("/campaigns")) return "campaigns";
  // Email Center primary route is /outreach (BM2-F006). /emails and
  // /crm are kept here so any direct-URL or legacy entrypoints still
  // light the correct sidebar item.
  if (path.startsWith("/outreach")) return "email-center";
  if (path.startsWith("/emails")) return "email-center";
  if (path.startsWith("/crm")) return "email-center";
  if (path.startsWith("/knowledge-base")) return "knowledge-base";
  // BL-025-F004 — /assets is reached from /knowledge-base ProductCard
  // chips (F007) and from /outreach Send-to-outreach (F008). It lives
  // under the Knowledge Base nav surface; we cannot add a new top-level
  // nav item per spec §F004.B (canonical 8-item rule).
  if (path.startsWith("/assets")) return "knowledge-base";
  // Analytics primary route is /roi (BM2-F009). /analytics is kept
  // for any legacy URL inbound; /weekly-report (BM2-F010) is part of
  // the same surface area.
  if (path.startsWith("/analytics")) return "analytics";
  if (path.startsWith("/roi")) return "analytics";
  if (path.startsWith("/weekly-report")) return "analytics";
  if (path.startsWith("/settings")) return "settings";
  return "dashboard";
}
