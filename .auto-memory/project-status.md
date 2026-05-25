<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔁 BL-072-prod-hotfix REVERIFYING (7/7, fix_rounds=1, awaiting Codex re-signoff)
- fix-round 1 commit 6fa1897: 删 AnalyticsPanel locale 入参 + 调用点 prop (next-intl getTranslations 自动取 server context locale, 不需 prop)
- lint: 0 errors / 3 warnings (从 4 降, 低于 evaluator §10.3 阈值)
- 其余 L1 全 PASS: tsc 0 / vitest 185×1322 / 首轮 staging 6 项已全 PASS
- staging redeployed @ 6fa1897 @ 2026-05-26T00:55+0800 (git_sha match ✓ healthy)
- 关联首轮 fail 报告: docs/test-reports/BL-072-verifying-2026-05-26.md
- F002 pending → completed, evaluator_feedback cleared, Codex Reviewer 复验 F008
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
## 角色 / Backlog (BL-072 done 后)
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- BL-062 backlog：KOL data coverage gap 治理
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
- 框架沉淀 v0.9.24：BL-072 4 条候选 (IA refactor outbound 扫描 / subset Pattern 6 / i18n 消费侧探针 / 删路由前 grep)
