/**
 * BL-064-F003 · Top-level sidebar nav config — 4-route IA.
 *
 * 路由顺序：Brief → Match → Reach → Insight（spec §4 #D — 教学性强，
 * 新用户一眼明白产品逻辑）。
 *
 * Adjudication 2026-05-11 #1：Settings 移入 UserAvatarMenu dropdown，
 * 不再作为侧栏 nav 项。
 * Adjudication 2026-05-11 #3：sub-route /assets /crm /kols/[id] 保留
 * 路由但 deriveActiveNav 把它们映射到内容对应的新 nav id（assets→brief
 * / crm→reach / kols→match），deep link 不死。
 */
export type NavItemId = "brief" | "match" | "reach" | "insight";

export interface NavItem {
  id: NavItemId;
  href: string;
  /** Translation key under the `nav` namespace (e.g. "nav.brief"). */
  i18nKey: string;
  /** Translation key for the tooltip / description. */
  descriptionKey: string;
  /** Material Symbols icon name. */
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "brief",
    href: "/brief",
    i18nKey: "nav.brief",
    descriptionKey: "nav.briefDescription",
    icon: "edit_note",
  },
  {
    id: "match",
    href: "/match",
    i18nKey: "nav.match",
    descriptionKey: "nav.matchDescription",
    icon: "auto_awesome",
  },
  {
    id: "reach",
    href: "/reach",
    i18nKey: "nav.reach",
    descriptionKey: "nav.reachDescription",
    icon: "send",
  },
  {
    id: "insight",
    href: "/insight",
    i18nKey: "nav.insight",
    descriptionKey: "nav.insightDescription",
    icon: "insights",
  },
];

/**
 * Derive which sidebar nav item should be visually active for a given
 * URL. Handles three classes of input:
 *
 *   1. New IA top-level paths (`/brief`, `/match`, `/reach`, `/insight`).
 *   2. Legacy paths that BL-064-F002 302-redirects (`/dashboard`,
 *      `/discovery`, `/database`, `/knowledge-base`, `/outreach`, `/roi`,
 *      `/weekly-report`, `/analytics`). These are still listed here as
 *      a defensive fallback for any caller that bypasses middleware
 *      (e.g. unit tests, Storybook).
 *   3. Sub-routes that are intentionally NOT redirected (adjudication
 *      #3): `/assets` → brief, `/crm` → reach, `/kols/[id]` → match,
 *      and `/campaigns` (split between brief/match by depth).
 */
export function deriveActiveNav(pathname: string): NavItemId {
  const path = pathname.replace(/^\/(en|zh|ja|ko|es)(?=\/|$)/, "") || "/";

  // 1. New IA top-level routes
  if (path.startsWith("/brief")) return "brief";
  if (path.startsWith("/match")) return "match";
  if (path.startsWith("/reach")) return "reach";
  if (path.startsWith("/insight")) return "insight";

  // 2. Legacy top-level routes (defensive — F002 normally 302-redirects)
  if (path.startsWith("/knowledge-base")) return "brief";
  if (path.startsWith("/discovery")) return "match";
  if (path.startsWith("/database")) return "match";
  if (path.startsWith("/outreach")) return "reach";
  if (path.startsWith("/emails")) return "reach";
  if (path.startsWith("/dashboard")) return "insight";
  if (path.startsWith("/roi")) return "insight";
  if (path.startsWith("/weekly-report")) return "insight";
  if (path.startsWith("/analytics")) return "insight";

  // 3. Kept sub-routes (adjudication #3)
  if (path.startsWith("/assets")) return "brief"; // KB→Asset flow lives under Brief in new IA
  if (path.startsWith("/crm")) return "reach"; // CRM under Reach (email surface)
  if (path.startsWith("/kols")) return "match"; // KOL detail page belongs to Match

  // /campaigns family split — /campaigns/new is brief (creation),
  // /campaigns + /campaigns/[id] live in match (selection workflow)
  if (path.startsWith("/campaigns/new")) return "brief";
  if (path.startsWith("/campaigns")) return "match";

  // Fallback: insight (canonical landing per adjudication #1 / vision §2)
  return "insight";
}
