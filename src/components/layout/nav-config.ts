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
 *
 * **Deprecated nav.* i18n keys (cleaned up by BL-070-F005):**
 * The legacy `nav.dashboard / kolDiscovery / kolDatabase / campaigns /
 * emailCenter / knowledgeBase / analytics` keys are still present in
 * `messages/{en,zh,ja,ko,es}.json` under `_deprecated_by_BL-064` /
 * `_deprecated_by_BL-066/067/069` markers so any straggler t-call
 * doesn't crash; BL-070-F005 removes them now that the routes they
 * named no longer exist (BL-070-F004 retired them).
 *
 * `nav.settings` is intentionally NOT deprecated — it now lives in
 * the UserAvatarMenu dropdown (adjudication §1) but the key is still
 * read there.
 *
 * **BL-014 review pending markers (ja/ko/es):** The new
 * `nav.brief/match/reach/insight` (+ description) translations in
 * `messages/ja.json`, `ko.json`, `es.json` are LLM-generated loanwords
 * pending native-speaker review per BL-014 (see backlog.json).
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
  if (path.startsWith("/match")) return "match";
  if (path.startsWith("/reach")) return "reach";
  if (path.startsWith("/insight")) return "insight";

  // 2. Kept sub-routes (adjudication §3)
  if (path.startsWith("/assets")) return "brief"; // KB→Asset flow lives under Brief in new IA
  if (path.startsWith("/crm")) return "reach"; // CRM under Reach (email surface)
  if (path.startsWith("/kols")) return "match"; // KOL detail page belongs to Match
  if (path.startsWith("/roi")) return "insight"; // ROI deep-link folds into the Insight surface
  if (path.startsWith("/campaigns")) return "match"; // campaigns list + [id] live in match

  // Fallback: insight (canonical landing per adjudication §1 / vision §2)
  return "insight";
}
