---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup FIXING（5/8, fix_rounds=0, spec=0947d58, role_assignments=null 默认映射, 项目近期最后一批 — Reviewer 首轮 verifying 失败，回退 fixing）
- ✅ F001 done (2b24fc1+191eca6, staging=2b24fc1): /reach 全量迁移 + /outreach 301 + Match→Reach toast 衔接
- ✅ F002 done (f6b8e09): customize.ts + topic-cloud.ts → runAigcAction SDK 迁移
- ✅ F003 done (d10e646): /insight 实装 + 3 tab + git mv /weekly-report + 4 条 301
- ✅ F004 done (8c15543+05b9a14+cacd0b5, staging=cacd0b5): 3 老路由 git rm + IA_REDIRECT_RULES 全清 + UUID guard + 17 path × 5 locale 404 验
- ✅ F005 done (3e40600+31a7cfd, staging=31a7cfd): 6 BL-066 unmount 组件 + 9 i18n deprecated markers + 6 整 ns + 7 nav.* 老 keys 5 locale 全清 — 净删 1700 LOC
- ✅ F006 done (ec39157, staging=ec39157, CI 一轮过 0 自修): 4 路由 IA e2e suite 全量重写 — match-flow 22 case + reach-flow 6 case + insight-flow 6 case + 4 已合并 specs git rm
- ✅ F007 done (3f3d9b1+8c633ab+ed7f6a4+cb35e51, staging=cb35e51): 视觉 baseline 全量 regen via update-visual-baselines workflow → 7 new (dashboard/en-network-status-online/en-insight-reports/en-insight-weekly-report/en-reach/en-reach-templates/en-reach-templates-badge) + 6 老 baseline git rm + 5 locale reach.*/insight.* 占位 ns + visual-regression unskip + visual-baselines-shape EXPECTED 同步 (CI 自修轮 1) — 最终 25 baselines 全 lock 新 IA chrome
- ❌ Reviewer 2026-05-20 首轮 verifying FAIL: `docs/test-reports/BL-070-verifying-2026-05-20.md`
- ❌ Blocker 1（F006）: `tests/e2e/match-flow.spec.ts` conversational refine 4 case 仍失败（729/764/801/831）；页面统一显示 `Refine timed out. Please try again.`
- ❌ Blocker 2（F007 / current main）: `tests/unit/i18n-locale-coverage.test.ts` 失败；`ja/ko/es` 各缺 85 个 landing 相关 leaves，`zh` 仍有 11 个未本地化 landing leaves
- ⏸️ F008 暂停：prod deploy / 24h 监控 / signoff checklist 必须等上述 blocker 修复后再推进
- 8 决策点 5/18-19 全 lock；复用 v0.9.22 沉淀 (SDK + IaRedirectRule + Turbopack --webpack); BL-070 自身 0 incremental LLM cost
- 本批次 done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
- v0.9.23 候选 3 条 (F004#1+#2 + F005#1): UUID guard 扩展 / notFound HTTP status 不可预测 / 删 i18n ns 前必须 grep callers
- BL-070 累积 5 轮 CI 自修 (F001#1 + F004#1#2 + F005#1 + F007#1), 符合 v0.9.21 '删除文件类批次 CI 多轮自修属预期'
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀（i18n template / IA redirect scope / 删除批次 CI 多轮自修 / Reviewer L1+角色门禁）
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 F008**: prod deploy 触发 (用户 ack 时间窗) + 24h 监控 + ≥5 marketer dogfood spot check
## 角色 / Backlog
- BL-070 building: role_assignments=null 默认映射
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 fixing 🚧 5/8 / BL-070 done = 对外上线 ready (距 ~2 周)
