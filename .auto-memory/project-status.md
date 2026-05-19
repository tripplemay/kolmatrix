---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-070-reach-insight-cleanup BUILDING（4/8, fix_rounds=0, spec=0947d58, role_assignments=null 默认映射, 项目近期最后一批）
- ✅ F001 done (2b24fc1 + CI 自修 191eca6, staging=2b24fc1): /reach 全量迁移 (git mv 17) + /outreach(/.*)? wildcard 301 + Match→Reach AiRecommendationPanel toast 衔接 + 5 locale toast i18n + L1+CI 全过
- ✅ F002 done (f6b8e09, staging=f6b8e09): customize.ts + topic-cloud.ts → runAigcAction SDK 迁移 (v0.9.22 #6 落地), -56 LOC 综合, 5 错误 code 映射, 副效果 topic-cloud.ts 首次加 cost-cap + ai.usage meter
- ✅ F003 done (d10e646): /insight 实装 (real route + 3 tab dashboard/reports/analytics) + git mv /weekly-report → /insight/weekly-report (16 files R rename) + 4 条 301 + 全 callsite /dashboard → /insight 同步 + 9 InsightTabs 单测 + 4 middleware 301 测试 + 2 visual baseline 暂 skip 留 F007
- ✅ F004 done (8c15543 + 自修轮 1 05b9a14 + 自修轮 2 cacd0b5, staging=cacd0b5): 二次清理 — 3 老路由 git rm (dashboard/knowledge-base/campaigns/new) + git mv 14 共享文件 (dashboard 数据/render → features/dashboard, KB 5+__tests__ → brief) + IA_REDIRECT_RULES 全清 10 条 + PROTECTED_PREFIXES 删 8 老路径 + safe-link.ts 白名单 + nav-config.ts fallback 同步 + e2e ia-refactor → ia-refactor-cleanup-2026-05-19 (17 path × 5 locale 验 404) + 5 broken e2e specs goto 改新 IA + visual-regression 4 处 baseline skip (F007 接管) + /campaigns/[id] UUID guard 防 catch-all 500 + 6 老路径 staging 验全 404 + 4 新 IA 路由 OK
- → F005 6 BL-066 unmount 组件 + i18n deprecated keys 5 locale 全删 (~4h) → F006 4 路由 IA e2e suite 全量重写 (~16h) → F007 视觉 baseline 全量 regen + reach/insight i18n 5 locale (~6h) → F008 staging+prod deploy + 24h 监控 + 12 项 checklist signoff (~8h)
- 8 决策点 5/18-19 全 lock；复用 v0.9.22 沉淀 (SDK + IaRedirectRule + Turbopack --webpack); BL-070 自身 0 incremental LLM cost
- 本批次 done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
- v0.9.23 候选 2 条 (待 done 阶段 Planner review): (1) 删显式子路由前必须先加上游 [id] UUID guard (BL-064 沉淀扩展) / (2) notFound() + next-intl 包装 HTTP status 不可预测 → e2e 验路由废弃应宽松验 status ∈ {200,404} + Location 不含错目的地
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1, signoff=BL-069-signoff-2026-05-18.md, 24h parse gate 17/21=80.95% PASS 边际）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3, 24h parse gate 16/20=80% PASS）
## ✅ BL-067-explainability-c3 DONE（7/7 + fix-round 1 + signoff 2026-05-16, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210, prod-audit PASS=11/0/0）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批 (本 batch F007)
- 5/14 BL-066 4 决策点 + 5 audit 决议；framework v0.9.21 沉淀（i18n template / IA redirect scope / 删除批次 CI 多轮自修 / Reviewer L1+角色门禁）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- BL-070 building: role_assignments=null 默认映射
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 building 🚧 4/8 (项目近期最后一批) / BL-070 done = 对外上线 ready (距 ~2 周)
