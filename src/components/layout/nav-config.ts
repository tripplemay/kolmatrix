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
    href: "/emails",
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
    href: "/analytics",
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
  if (path.startsWith("/discovery")) return "kol-discovery";
  if (path.startsWith("/database")) return "kol-database";
  if (path.startsWith("/kols")) return "kol-database";
  if (path.startsWith("/campaigns")) return "campaigns";
  if (path.startsWith("/emails")) return "email-center";
  if (path.startsWith("/knowledge-base")) return "knowledge-base";
  if (path.startsWith("/analytics")) return "analytics";
  if (path.startsWith("/roi")) return "analytics";
  if (path.startsWith("/settings")) return "settings";
  return "dashboard";
}
