---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup FIXING (9/11, fix_rounds=3, staging spot-check @ bf15b62)
- ✅ F001-F005 done (无变, 见 git log)
- ✅ F006 done (合并 e2e ec39157 + fix-round 1 always-skip 4 refine case a5a4cf1)
- ✅ F007 done (5-locale landing.* 完整 + parity 8/8 PASS @ fc71862)
- ✅ F009 done (75acf1e + bf15b62) — next/dynamic chunk-split 生效；L1 功能复验 + Lighthouse score/TBT/LCP 通过
- ❌ F010 未签收 — 9 处 raw img → next/image 已落地，但 `/en/match` Lighthouse CLS 3 次稳定 `0.348`（要求 `<0.05`），需回 fixing
- ✅ F011 done (bf15b62) — /match + /reach Suspense defer 未引入活跃 E2E 回归；FCP/LCP/TBT 通过
- 🧪 Reviewer 本轮结果: clean 3099 实例上 typecheck PASS / 关键 unit PASS / perf unit PASS / 定向 e2e `133 passed / 43 skipped / 0 failed`; visual baseline contract PASS，但 pixel diff 本地 29 skip（Linux-canonical）
- 📏 Lighthouse 3-run median: brief `97`, match `80`, reach `92`, insight `95`; 唯一 blocker = `/match` CLS `0.348`
- ⏸️ F008 仍 pending: 先修 `/match` CLS，再重跑 Lighthouse 4×3；之后才能继续 prod redeploy + 24h audit + ≥5 marketer dogfood + §10 12 项 checklist 收尾
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
- BL-070 fixing: F010 `/match` CLS blocker（0.348 > 0.05）待 Generator 修复；修后回 Reviewer 重跑 Lighthouse 4×3
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 fixing 🚧 9/11 / BL-070 done = 对外上线 ready
