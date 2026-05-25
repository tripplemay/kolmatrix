---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup REVERIFYING (10/11, fix_rounds=3, staging deploy in_flight @ bf15b62)
- ✅ F001-F005 done (无变, 见 git log)
- ✅ F006 done (合并 e2e ec39157 + fix-round 1 always-skip 4 refine case a5a4cf1)
- ✅ F007 done (5-locale landing.* 完整 + parity 8/8 PASS @ fc71862)
- ✅ F009 done (75acf1e + bf15b62) — next/dynamic chunk-split: 3 client lazy 薄壳 (OutreachComposer/MatchKolTable/MatchRefineBar ssr:false) + server-side `await import()` (AiSuggestionsSidebar/BriefPageClient/ProductListPanel/DashboardContent) — 已验证 .next/static/chunks/ 独立 chunk artifacts
- ✅ F010 done (75acf1e) — 9 处 raw img → next/image (explicit dims + unoptimized 容忍异构平台 CDN); 9 处 eslint-disable 全删
- ✅ F011 done (bf15b62) — /match Suspense defer loadDatabaseStats + savedSearches; /reach Suspense defer 4 analytics calls; skeleton 共用 glass-panel animate-pulse 防 CLS
- 🧪 Reviewer L2 待跑: Lighthouse 4 路由 × 3 取中位数 (perf ≥80 / TBT <200ms / LCP <2.5s / CLS <0.05 / FCP <1.5s / a11y ≥90 不回归); e2e 全套 (Suspense loading state 可能需 waitFor); 视觉 baseline 验
- ⏸️ F008 仍 pending: Reviewer L2 全 PASS 后, prod redeploy + 24h audit + ≥5 marketer dogfood + §10 12 项 checklist 收尾
- 🆕 fix-round 2 新沉淀 3 候选 (v0.9.23 集中处理): #26 perf spec acceptance 起草必须分类 client vs server async / #27 异构 CDN avatar 用 next/image unoptimized + explicit dims 优于 remotePatterns 累积白名单 / #28 引入 lazy boundary 必须同步老 fidelity test importer+JSX 断言
- v0.9.23 候选累计 ~8 条 (fix-round 1 #21-24 + planner #25 + generator #26-28)
- 本批次 reverifying done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 fix-round 2 方案 A: F009+F010+F011 全做 (用户 ack)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. BL-070 F008: Reviewer L2 全 PASS 后 prod redeploy 触发 + 24h 监控 + ≥5 marketer dogfood + signoff
## 角色 / Backlog
- BL-070 reverifying: F009-F011 generator 域完成 @ bf15b62, 等 Reviewer L2 Lighthouse 复测 + e2e + 视觉 baseline 验
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 reverifying 🚧 10/11 / BL-070 done = 对外上线 ready
