---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-026 Asset UX Redesign + Outreach-First** — 6/6 features done by Generator (2026-05-03)，切 verifying；staging deployed @ 5b41d9a (CI 25276007965 8/8 PASS)；Reviewer L1+L2 接手；signoff doc 待写
- 10 commits 全部 BL-026 标签合规；F002 fix 2x / F005 fix 1x / F006 fix 1x (e2e + unit test 必要更新 + visual-regression skip 修复 Playwright 1.39+)
## ✅ BL-025 素材中心 / Asset Library — DONE 2026-05-03
- 9/9 features Reviewer 首轮 PASS (fix_rounds=0)；signoff: docs/test-reports/BL-025-asset-library-signoff-2026-05-03.md
- BL-026 后端层 + 数据 + Material Symbols 守门保留；UI 层心智偏离由 BL-026 重构 (sidebar 删 / 4→3 tabs / Create blank 删)
## ✅ Framework v0.9.6 — DONE 2026-05-03
- 8 条 proposed-learnings 全部 Planner 预判落地 (commit 83205d4)
## Visual baselines 待 Reviewer regen (3 PNG 已删 + 5 新 entry 待加)
- 删: en-assets / en-assets-wizard-step1 / en-outreach (layout / composer 变了)
- 待加: en-assets / en-assets-drawer-open / en-assets-filter-dropdown / en-assets-empty-system-seed / en-outreach
- EXPECTED_BASELINES 17 → 14 → 19 (Reviewer 加 5 后)
- Reviewer 触发 update-visual-baselines workflow + 同步 visual-regression.spec.ts toHaveScreenshot 5 个新 entry
## 用户手工待办
1. **BL-026 done 后再 redeploy prod** — current 47827ad (含 BL-025 全)，BL-026 done 后切 5b41d9a+ 触发 deploy
2. ~2026-05-09 BIx F004 staging YouTube sync 走查 — SSH grep `/var/log/kolmatrix-kol-sync.log` 末 7 天 JSON
## 关键决议（已 lock）
- BL-025 架构方案 X (统一 Asset 表，ADR-011) + EmailTemplate dual-write — 不动
- BL-026 推翻 §F004.B 部分 (ADR-012)：心智 Outreach-First / drawer + top filter / 3 tabs / system_seed welcome
- F003.D Restore bug 选 Option A (server action 默认从 parent 复制 content)
## 角色 / Backlog / 时间线
- 默认映射 (role_assignments=null): CLI = planner+generator，Codex = evaluator
- Backlog 17 条: BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-026 high (verifying) / BL-027-i18n low / BL-028 low / 余 deferred
- 时间线：05-03 BL-025 ✅ + framework v0.9.6 ✅ + BL-026 building done → 05-03~04 BL-026 verifying → 05-04 BL-026 done → 05-04~ BL-020 启动 → 05-08~09 BL-024 done → 05-13 上线对外 (不变)

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
