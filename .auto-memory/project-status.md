---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-026 Asset UX Redesign + Outreach-First — DONE 2026-05-03
- 6/6 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BL-026-asset-ux-redesign-signoff-2026-05-03.md
- 主分支 HEAD: 05d0c80（CI 8/8 PASS 闭环）；staging git_sha=5b41d9a 不变（Reviewer follow-up 全是 test scaffolding 不影响 build artifacts）
- Visual baseline 5 个新（en-assets / -drawer-open / -filter-dropdown / -empty-system-seed / en-outreach）入 git；EXPECTED_BASELINES 14→19
- 12 条 Soft-watch 不阻塞：S1 grid breakpoint 微偏 / S2-S4 e2e+integration test 缺（移交 BL-026-followup mini-batch）/ S5-S6 spec primitive 偏 / S7-S9 trade-off / S10-S11 environment.md 待更正 / S12 prod redeploy 等用户
## ✅ BL-025 素材中心 / Asset Library — DONE 2026-05-03
- 9/9 features PASS（fix_rounds=0）；signoff: docs/test-reports/BL-025-asset-library-signoff-2026-05-03.md
- BL-026 重构 §F004.B（sidebar/4 tabs/Create blank 删）后端层 + Material Symbols 守门保留
## ✅ Framework v0.9.6 — DONE 2026-05-03
- 8 条 proposed-learnings 全部 Planner 预判落地（commit 83205d4）
## 用户手工待办（按优先级）
1. **Prod redeploy（高，BL-025+BL-026 上线前阻塞）** — GitHub Actions → "Deploy to Production" → Run workflow on main，把 c302eb4..05d0c80（BL-025 + BL-026 + hotfix bb637a1 + deploy script prisma generate hotfix）一并上 prod
2. ~2026-05-09 BIx F004 staging YouTube sync 走查 — SSH grep `/var/log/kolmatrix-kol-sync.log` 末 7 天 JSON
3. environment.md 更正 staging RAM 8GB（非 16GB） + 加 NODE_OPTIONS=--max-old-space-size=4096 部署步骤注释
## 关键决议（已 lock）
- BL-025 ADR-011 统一 Asset 表 + EmailTemplate dual-write — 不动
- BL-026 ADR-012 Outreach-First 心智重排 — 不动
- F003.D Restore bug → Option A（server action 默认从 parent 复制 content）
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 18 条：BL-026-followup（test backfill + visual playwright-quirks 沉淀）/ BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-027-i18n low / BL-028 low / 余 11 deferred
- 时间线：05-03 BL-025 ✅ + framework v0.9.6 ✅ + BL-026 ✅ → 05-04 BL-020 启动 → 05-08~09 BL-024 done → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
