/**
 * BL-064-F003 · Top-level sidebar nav config — initially 4-route IA.
 * BL-074-F001 · Promoted to 5-route IA — add `campaigns` between brief
 * and match (Order B lock). See ADR-015.
 *
 * 路由顺序：Brief → Campaigns → Match → Reach → Insight（spec §4 #D
 * 改良 — 加 campaigns 一级 nav 让用户直接看活动列表, BL-073 issue #3
 * 用户反馈推动）。
 *
 * Adjudication 2026-05-11 #1：Settings 移入 UserAvatarMenu dropdown,
 * 不再作为侧栏 nav 项。
 * Adjudication 2026-05-11 #3：sub-route /assets /crm /kols/[id] 保留
 * 路由但 deriveActiveNav 把它们映射到内容对应的新 nav id（assets→brief
 * / crm→reach / kols→match），deep link 不死。
 *
 * BL-070-F005 二次清理 — the legacy `nav.dashboard / kolDiscovery /
 * kolDatabase / campaigns / emailCenter / knowledgeBase / analytics`
 * keys (and their `*Description` siblings) were deleted from all 5
 * locale bundles now that the routes they named no longer exist
 * (BL-070-F004 retired them). `nav.settings` stays — it's read by the
 * UserAvatarMenu dropdown (adjudication §1).
 *
 * **BL-014 review pending markers (ja/ko/es):** The new
 * `nav.brief/campaigns/match/reach/insight` (+ description) translations
 * in `messages/ja.json`, `ko.json`, `es.json` are LLM-generated
 * loanwords pending native-speaker review per BL-014 (see backlog.json).
 */
export type NavItemId = "brief" | "campaigns" | "match" | "reach" | "insight";

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
    // BL-074-F001 — campaigns 一级 nav, 在 brief 和 match 之间 (Order B
    // lock). Materialises the "用户先想做什么活动, 再去匹配 KOL" 心智
    // 流。详 ADR-015.
    id: "campaigns",
    href: "/campaigns",
    i18nKey: "nav.campaigns",
    descriptionKey: "nav.campaignsDescription",
    icon: "campaign",
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
 * URL. Handles two classes of input:
 *
 *   1. New IA top-level paths (`/brief`, `/match`, `/reach`, `/insight`).
 *   2. Sub-routes that are intentionally NOT 302'd (adjudication §3):
 *      `/assets` → brief, `/crm` → reach, `/kols/[id]` → match,
 *      `/roi` → insight, `/campaigns` → match.
 *
 * BL-070-F004 — every legacy top-level route (`/dashboard`,
 * `/discovery`, `/database`, `/knowledge-base`, `/outreach`,
 * `/emails`, `/weekly-report`, `/analytics`) was retired and now 404s,
 * so the defensive fallback rows for them were deleted. The default
 * branch returns `insight` (canonical landing) for any other unknown
 * path, including a stray hit on a deleted legacy URL.
 */
export function deriveActiveNav(pathname: string): NavItemId {
  const path = pathname.replace(/^\/(en|zh|ja|ko|es)(?=\/|$)/, "") || "/";

  // 1. New IA top-level routes
  if (path.startsWith("/brief")) return "brief";
  // BL-074-F001 — campaigns is now its own first-class nav (was folded
  // into match under BL-064/070 IA v1). Order matters: check campaigns
  // before match so /campaigns/[id] resolves to campaigns nav.
  if (path.startsWith("/campaigns")) return "campaigns";
  if (path.startsWith("/match")) return "match";
  if (path.startsWith("/reach")) return "reach";
  if (path.startsWith("/insight")) return "insight";

  // 2. Kept sub-routes (adjudication §3)
  if (path.startsWith("/assets")) return "brief"; // KB→Asset flow lives under Brief in new IA
  if (path.startsWith("/crm")) return "reach"; // CRM under Reach (email surface)
  if (path.startsWith("/kols")) return "match"; // KOL detail page belongs to Match
  if (path.startsWith("/roi")) return "insight"; // ROI deep-link folds into the Insight surface

  // Fallback: insight (canonical landing per adjudication §1 / vision §2)
  return "insight";
}
