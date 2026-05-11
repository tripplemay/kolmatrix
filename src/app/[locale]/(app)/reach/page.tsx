/**
 * BL-064-F001 · /reach — Phase 1 IA refactor 新路由壳（A2 embed-old）。
 *
 * 占位策略：re-export 旧 /outreach 的 default 页面组件，用户访问
 * /[locale]/reach 时看到的是 Email Center 现实装（含 composer + 30d
 * sending performance + top templates / recent replies / domain health
 * 等卡片）。BL-070 才会重写为 Reach 执行域 UI。
 */
export { default } from "../outreach/page";

export const metadata = { title: "Reach — KOLMatrix" };
