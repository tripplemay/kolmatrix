<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-073-prod-hotfix DONE (8/8, fix_rounds=2) — signoff 完成
- Codex Reviewer 终签 PASS：stable `dimensionId` testid 复验确认 staging `/zh/match` 只有 `chip-group-no-data-monetization` 存在；`region/category/platform/language` 的 no-data hooks 都不存在，language 输入保持启用，符合 coverage>0 行为
- F007 保持通过：temp copy 把 `grid_view` 改成 `unknown_icon` 后，`tests/unit/material-symbols-coverage-unit.test.ts` 明确 FAIL，STRICT_MS_ICONS 拦截能力真实成立
- L1 通过：`npm run lint` = 0 errors / 3 warnings；`npx tsc --noEmit` PASS；targeted vitest 10/10 PASS
- staging 抽样通过：`/zh/match` 默认 20 cards；no-data 只落在 monetization 维度，不再存在 region 误读
- signoff: `docs/test-reports/BL-073-signoff-2026-05-26.md`
## ✅ BL-072-prod-hotfix DONE (8/8, fix_rounds=1, tag bl072-done @ bc24e09) — 4 prod hotfix + CI 防御三件套完成并终签
- Codex Reviewer 5/26 复验 PASS：唯一 blocker（/insight unused warning）已修；`npm run lint` 回到 0 errors / 3 warnings；signoff 已落 `docs/test-reports/BL-072-signoff-2026-05-26.md`
- L1 通过：lint 3 warnings soft-watch / `npx tsc --noEmit` PASS；上轮已验证 `npm test` 185 files 1322 tests PASS、stale path grep 0、subset regen 含 `table_rows`、zh insight keys 完整
- L2 复验通过：staging healthy；/zh/insight heading=Insight + 中文 subtitle/tabs、/match 两态 icon、/brief≈/insight 宽度均 1136px，无回归
- 4 个 prod-facing 问题已在 staging 验证通过；当前仅余 3 个历史 unused-style warning 记为 soft-watch，不阻断 done
## ✅ BL-071 DONE (10/10, fix_rounds=1, tag bl071-done @ 99c43fc) — framework v0.9.23 闭环
- 12 决策点 D1-D12 全 lock 实施; 11 项结构变更 + 31 条 sediment inline-merge + 0 chronological-append
- 关联: framework/CHANGELOG.md v0.9.23 + framework/archive/proposed-learnings-archive-v0.9.23.md
- 0 行业务代码改动 / signoff: docs/test-reports/BL-071-signoff-2026-05-26.md
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 完整完成 + 对外上线 ready
## ✅ BL-069 DONE（7/7）/ BL-068 DONE（7/7）/ BL-067 DONE（7/7）/ BL-066 DONE（9/9, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4
- 5/25 BL-071 12 决策点 D1-D12 全 lock (D7 inline-merge 强制规则首次大规模应用)
- 5/25 BL-072 4 项 lock (顺序 C / 范围 A 完整版 / i18n A brand kept-en / link 目标 A)
- 5/26 BL-071 done → BL-072 building (用户 ack)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops:** 24h 后跑 `ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'` + 邀 ≥5 marketer dogfood; 全过则 signoff §4 #9/#10 DEFERRED→PASS
4. **🚨 5/26 触发 prod deploy 至 main HEAD 1a3fdcf (含 BL-071 + BL-072 fix 共 36 commits)：** 用户 5/26 报"很多核心链路无法使用", Planner Kimi smoke audit 发现 prod 仍在 BL-070 era (fc79f43, 5/25 17:05 UTC deploy); typecheck/test 全绿 + 无 stale path 残留, 推断用户看到的是 BL-072 已修但未 deploy 的 4 user-visible bug。GitHub Actions → Deploy to Production → workflow_dispatch (main HEAD)。Deploy 后 curl health + 浏览器实测 4 issue + 4-step main flow。若 deploy 后仍有 issue → 起 BL-073 prod hotfix audit。
## 角色 / Backlog (BL-072 done 后)
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- BL-062 backlog：KOL data coverage gap 治理
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
- 框架沉淀 v0.9.24：BL-072 4 条候选 (IA refactor outbound 扫描 / subset Pattern 6 / i18n 消费侧探针 / 删路由前 grep)
