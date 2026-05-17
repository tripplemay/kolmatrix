---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-068-conversational-refine BUILDING（5/7, fix_rounds=0, spec=13d9794, role_assignments=null 默认映射）
- ✅ F001 aigcgateway action 注册 cmp8mk1qj0005bno3k590u7zs + prompt design + SSH env (1.5h, 5/16 17:40, 88012ac)
- ✅ F002 refine-actions.ts server action 9/9 单测 + 6 audit types (commit 494243c) + 3 BL-067 CI hotfix inline (commit 4487c79) (2h, 5/16 17:55)
- ✅ F003 RefineInputBar.tsx + AiRecommendationPanel refine cache + posMap reorder + 5 locale i18n + 5 vitest cases (commit ab933fc) (2h, 5/17 18:45)
- ✅ F004 src/lib/refine-cache.ts shared + MatchRefineBar.tsx wrapper + /match mount + productId select + 10 new vitest cases (commit 8da0840) (1.5h, 5/17 19:50)
- ✅ F005 F002 ApplyRefineSuccessData 加 errorKind discriminator (3 unparsable sub-paths) + RefineInputBar 5th 'permutation' toast variant + 10 new RefineInputBar.test.tsx (4 error paths + 5s timeout fake timers + 4 locale it.each) + 3 errorKind 断言加入现 F002 测 (1h actual vs 4h estimate, 5/17 20:50)
- → F006 5 语言 i18n 完整性 review (F003+F005 已加齐) + 新 e2e tests/e2e/campaign-refine-flow.spec.ts 6 case (6h) → F007 staging + 视觉 baseline regen + 24h cost 监控 + signoff (4h)
- **CI 7/8 jobs PASS, E2E 仍红**（campaign-explainability-flow.spec.ts:101 BL-067-F006 测 1）。根因：CI 无 AIGCGATEWAY_* env → smart-match embedding 调 fail → panel 渲 error testid → 测试只等 active/empty 故 30s timeout。**待 Planner 起 BL-067 followup batch 处理**（CI yaml 加 secrets / 测试 mock smart-match / 单行宽容 error testid 三选一），不属 BL-068 范围
- 8 决策点 5/16 全 lock：#1 ready-to-build / #2 /campaigns/[id] + /match 两处 / #3 重排现 top 30 / #4 toast unparsable + 保留现池 / #5 stateful localStorage 24h TTL / #6 audit log raw query / #7 全复用 BL-067 基础设施 / #8 顶部 inline input bar
- 复用 BL-067 沉淀：runAigcAction SDK (src/lib/aigc/run-action.ts) + checkLlmCostBudget (src/lib/ai/cost-cap.ts:133) + 5 locale JSON 模式 + silent fallback 哲学；cost 估算 5 用户 day = $1.25 meter (25% cap 利用率)
- F006 起工：F003 + F005 已 i18n 全 9 keys 5 locale 加齐, F006 主要新增 = e2e tests/e2e/campaign-refine-flow.spec.ts 6 case 实跑 /campaigns/[id] + /match 两路. e2e CI 环境无 AIGCGATEWAY_* env → smart-match endpoint fail → MatchRefineBar 渲 null + AiRecommendationPanel ErrorBanner (BL-067-F006 测 1 同根因). F006 e2e 设计必须 mock applyRefineAction 或 seed campaign-recommendations cache 直接 hydrate pool — 不能依赖真实 smart-match 调. 参考: tests/e2e/campaign-explainability-flow.spec.ts (BL-067-F006 模式). F002 server return shape 含 errorKind, e2e mock 时按需返 3 sub-paths. RefineInputBar 5 testid 全可用 (success / unparsable / permutation / cap / network)
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
- BL-068 building: role_assignments=null 默认映射 (cli=planner+generator johnsong / codex=evaluator); 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Backlog 20 条 / Phase 4 后续: BL-069 Brief 合并 / BL-070 Insight unify + 二次清理 / Phase 5 候选 (个性化学习 / skip-replace 写 DB / comparative query)
