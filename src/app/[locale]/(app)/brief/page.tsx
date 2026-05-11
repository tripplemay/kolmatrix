/**
 * BL-064-F001 · /brief — Phase 1 IA refactor 新路由壳（A2 embed-old）。
 *
 * 占位策略：直接 re-export 旧 /knowledge-base 的 default 页面组件，
 * 用户访问 /[locale]/brief 时看到的内容仍是 KB 现实装。本批次仅做壳 +
 * activeNav 映射；BL-069 才会重写 Brief 页内部 UI（产品输入工作流）。
 *
 * metadata 单独导出覆盖旧页 title。next-intl locale params 由 Next.js
 * 自动注入到 default export 函数，re-export 透传无副作用。
 */
export { default } from "../knowledge-base/page";

export const metadata = { title: "Brief — KOLMatrix" };
