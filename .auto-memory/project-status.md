---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup REVERIFYING (7/8, fix_rounds=1, spec=0947d58, staging=05e5c1f)
- ✅ F001-F005 done (无变, 见 git log)
- ✅ F006 done (合并 e2e ec39157 + fix-round 1 a5a4cf1 把 4 refine result-branch case `test.skip(true, SKIP_REFINE_E2E_REASON)` always-skip — Playwright route.fulfill 不满足 Next.js RSC wire format, brief-flow.spec.ts 同问题 precedent; 覆盖留 RefineInputBar 10+AiRecPanel 5+MatchRefineBar 4 unit + staging dogfood)
- ✅ F007 done (3f3d9b1+...+cb35e51 原始 + fix-round 1 fc71862 补 5-locale landing.* 完整 namespace + auth.wantsDemoLabel + 9 KEEP_AS_EN allowlist + zh screenshot 真翻译 — i18n-locale-coverage 8/8 PASS)
- 🆕 fix-round 1 副带修 landing batch 遗留 (4 条; 不修则 BL-070 reverifying CI gate 红挡):
  - 13cdc3f migration ROLLBACK 注释 (`20260519100000_access_request_wants_demo_camelcase`)
  - a5a4cf1 `src/app/[locale]/request-access/schema.ts` 抽离 AccessRequestSchema (Next.js 16 'use server' file 仅允 async function exports)
  - 7009c8e bot-commit visual baseline regen (landing-zh-{desktop,mobile} + en-request-access)
  - 05e5c1f locale-detection.spec.ts 5 case 预期更新 (`/{locale}/login` → `/{locale}/?$`, resolveAuthAwareRoot anon → landing)
- 🆕 CI 基础设施: 637b163 ci.yml 加 workflow_dispatch (github-actions[bot] commit 默认不 cascade CI)
- ✅ Reviewer 2026-05-20 L1 reverifying PASS: `docs/test-reports/BL-070-reverifying-2026-05-20.md`
- ⏸️ F008 仍 pending: prod deploy ack / 24h 监控 / signoff doc (Reviewer + 用户协作, 不 Generator)
- CI 全绿 @ 05e5c1f (run 26121789868), staging health=healthy
- v0.9.23 候选 fix-round 1 净新增 4 条 → 累计 7 条 BL-070 sediment (#21 RSC mock 不可用 / #22 prisma rollback skeleton / #23 'use server' export 约束 / #24 bot commit 不 cascade); 合 Planner done 阶段集中沉淀
- 本批次 reverifying done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. BL-070 F008: prod deploy 触发 (用户 ack 时间窗) + 24h 监控 + ≥5 marketer dogfood spot check
## 角色 / Backlog
- BL-070 reverifying: F006/F007 已本地复验通过，等待 F008 prod signoff 步骤
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 reverifying 🚧 7/8 / BL-070 done = 对外上线 ready (距 ~2 周)
