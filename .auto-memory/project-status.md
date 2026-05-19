---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-070-reach-insight-cleanup BUILDING（2/8, fix_rounds=0, spec=0947d58, role_assignments=null 默认映射, 项目近期最后一批）
- ✅ F001 done (2b24fc1 + CI 自修 191eca6, staging=2b24fc1): /reach 全量迁移 (git mv 17) + /outreach(/.*)? wildcard 301 + Match→Reach AiRecommendationPanel toast 衔接 + 5 locale toast i18n + L1+CI 全过
- ✅ F002 done: customize.ts + topic-cloud.ts → runAigcAction SDK 迁移 (v0.9.22 #6 落地), customize.ts -47 LOC + topic-cloud.ts -9 LOC, 5 错误 code 映射 (missing_env/http_error/invalid_response/timeout/daily_cost_exceeded), opts.apiKey/baseUrl 删除走 env, 加 opts.tenantId for cost-cap. 副效果: topic-cloud.ts 首次加 cost-cap + ai.usage meter (per §5 #8 基础设施层归一化). 全 174 files 1268 tests PASS.
- → F003 /insight 路由 + Dashboard + Reports 合并 + 4 条 301 (10h) → F004 5 老路由目录 git rm + middleware redirect 删 (4h) → F005 6 BL-066 unmount 组件 + i18n deprecated keys 全删 (4h) → F006 4 路由 IA e2e suite 全量重写 (16h) → F007 视觉 baseline 全量 regen + reach/insight i18n 5 locale (6h) → F008 staging + prod deploy + 24h 监控 + 对外上线 12 项 checklist signoff (8h)
- 8 决策点 5/18-19 全 lock：#1 ready-to-build / #2 Reach 迁移+Match衔接+customize 迁 / #3 Insight 仅合并 / #4 二次清理全清 / #5 BL-070 同批即停 redirect (老路由 404) / #6 e2e 完整重写+老 e2e 清理 / #7 §10 12 项 checklist + signoff doc 验 / #8 全复用 v0.9.22
- 复用 v0.9.22 沉淀: runAigcAction SDK (F002) + IaRedirectRule status field (F004) + Turbopack --webpack 防御 (F008) + 13 条 archive 经验; BL-070 自身 0 incremental LLM cost
- 本批次 done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1, signoff=BL-069-signoff-2026-05-18.md, 24h parse gate 17/21=80.95% PASS 边际, Soft-watch S1 继续观察）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3, signoff=BL-068-signoff-2026-05-17.md, 24h parse gate 16/20=80% PASS, deduped 35% LLM noise tolerated via server fallback）
## ✅ BL-067-explainability-c3 DONE（7/7 + fix-round 1 + signoff 2026-05-16, prod redeploy 待用户 ack 时间窗 deploy-prod.sh 已含 --webpack 防御）
- 3 项 P5 裁决: §1 5 cat→3 cat 降级 (staging seed gap → BL-070 backlog) / §5 perf 留 dogfood / §8 真 24h soak 加速省略
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210, signoff=BL-066-signoff-2026-05-15.md, prod-audit PASS=11/FAIL=0/WARN=0）
- F009 prod deploy + recompute apply (1397 rows spread=52, audit_log 2617) + audit script v1→v5 5 次 fix / F008 e2e 6 case + redirect 移除 / F007 value-score v2 + ADR-014 / F006 AcceptedKolsPanel 重构 + source chip + backfill / F002 三段 layout 重写
- 3 audit 裁决: F002 #1A#2B#3B#4B#5C+#6 @ e2d6b71 / F006 #1C#2A#3C#4A#5B @ a682cde / F007 #1A#2B#3A#4B#5A#6A#7B#8C @ 1fc4d52
## ✅ BL-065 DONE 7/7 prod=c5b5c31 + BL-065-R1=4562895 + signoff 5/14
## ✅ BL-064 prod=9b1b15b / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批 (本 batch F007)
- 5/14 BL-066 4 决策点：#A 复用 smart-match endpoint / #B 完全删 AddKolDialog / #C BL-048 同 batch / #D Stitch 新建
- 5/14 BL-066 F002 audit 5 决议：限现字段派生 / skeleton 不调 smart-match / deprecated marker 不删 / 白名单 contactedCount / F006 不动底部
- 5/14 framework v0.9.21 沉淀（i18n template / IA redirect scope / 删除批次 CI 多轮自修 / Reviewer L1+角色门禁）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- BL-070 building: role_assignments=null 默认映射; 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 building 🚧 (项目近期最后一批) / BL-070 done = 对外上线 ready (距 ~2 周)
