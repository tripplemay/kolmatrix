---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-070-reach-insight-cleanup BUILDING（6/8, fix_rounds=0, spec=0947d58, role_assignments=null 默认映射, 项目近期最后一批）
- ✅ F001 done (2b24fc1+191eca6, staging=2b24fc1): /reach 全量迁移 + /outreach 301 + Match→Reach toast 衔接
- ✅ F002 done (f6b8e09, staging=f6b8e09): customize.ts + topic-cloud.ts → runAigcAction SDK 迁移
- ✅ F003 done (d10e646): /insight 实装 + 3 tab + git mv /weekly-report + 4 条 301 + 2 visual baseline 留 F007
- ✅ F004 done (8c15543+05b9a14+cacd0b5, staging=cacd0b5): 3 老路由 git rm + IA_REDIRECT_RULES 全清 + safe-link/nav-config 同步 + UUID guard + 17 path × 5 locale 404 验
- ✅ F005 done (3e40600+31a7cfd, staging=31a7cfd): 6 BL-066 unmount 组件 git rm + 9 i18n deprecated markers + 6 整 ns + 7 nav.* 老 keys 5 locale 全清 — 17 files +28/-1690 净删 1700 LOC
- ✅ F006 done (ec39157, staging=ec39157, CI 一轮过 0 自修): 4 路由 IA e2e suite 全量重写 — match-flow 新建 22 case (合并 BL-065/066/067/068 4 spec + 共享 helpers 抽顶) + reach-flow 新建 6 case + insight-flow 新建 6 case + 4 已合并 specs git rm — 7 files +1174/-1288 净 -114 LOC
- → F007 视觉 baseline 全量 regen (~6h) → F008 staging+prod deploy + 24h 监控 + 12 项 checklist signoff (~8h, 部分依赖用户 ack + Evaluator signoff)
- 8 决策点 5/18-19 全 lock；复用 v0.9.22 沉淀 (SDK + IaRedirectRule + Turbopack --webpack); BL-070 自身 0 incremental LLM cost
- 本批次 done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
- v0.9.23 候选 3 条 (F004#1+#2 + F005#1): UUID guard 扩展 / notFound HTTP status 不可预测 / 删 i18n ns 前必须 grep callers
- BL-070 累积 4 轮 CI 自修 (F001#1 + F004#1#2 + F005#1), 符合 v0.9.21 '删除文件类批次 CI 多轮自修属预期'; F006 一轮过 (合并 + 抽 helpers 模式良好)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1, signoff=BL-069-signoff-2026-05-18.md）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7 + fix-round 1 + signoff 2026-05-16, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批 (本 batch F007)
- 5/14 BL-066 4 决策点 + 5 audit 决议；framework v0.9.21 沉淀（i18n template / IA redirect scope / 删除批次 CI 多轮自修 / Reviewer L1+角色门禁）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- BL-070 building: role_assignments=null 默认映射
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 building 🚧 6/8 (项目近期最后一批) / BL-070 done = 对外上线 ready (距 ~2 周)
