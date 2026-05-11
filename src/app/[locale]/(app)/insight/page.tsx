/**
 * BL-064-F001 · /insight — Phase 1 IA refactor 新路由壳（A2 embed-old）。
 *
 * 占位策略：re-export 旧 /dashboard 的 default 页面组件，用户访问
 * /[locale]/insight 时看到的是 Dashboard 现实装（含 KPI row + workflow
 * steps + recent activity + ROI trend 等卡片）。BL-070 才会合并
 * Dashboard + ROI + WeeklyReport 为统一 Insight 反馈域 UI。
 */
export { default } from "../dashboard/page";

export const metadata = { title: "Insight — KOLMatrix" };
