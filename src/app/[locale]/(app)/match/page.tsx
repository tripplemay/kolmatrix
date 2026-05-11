/**
 * BL-064-F001 · /match — Phase 1 IA refactor 新路由壳（A2 embed-old）。
 *
 * 占位策略：re-export 旧 /discovery 的 default 页面组件，用户访问
 * /[locale]/match 时看到的是 Discovery 现实装。BL-065 才会合并
 * Discovery + Database + Campaigns/[id] KOL panel 为统一 Match 页。
 *
 * /match?campaignId=:id（BL-064 F002 /campaigns/[id] redirect 目标）+
 * /match?view=campaigns（/campaigns 列表 redirect 目标）的 searchParam
 * 由 Discovery 页 server-component 透传读取；BL-065 重写时改解析。
 */
export { default } from "../discovery/page";

export const metadata = { title: "Match — KOLMatrix" };
