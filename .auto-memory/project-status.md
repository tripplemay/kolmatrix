---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM2-campaign-outreach-roi** ✅ done（2026-04-26 Reviewer L2 复验通过），11/11，fix_rounds=1
  - L1：已通过（单测/集成/E2E smoke/typecheck/lint）
  - L2 staging rerun：7/7 PASS（bm1-flow + journey-a + journey-b + marketer-dashboard）
  - 历史阻断（outreach 500 / roi 404 / weekly-report 404）已不可复现
  - signoff：`docs/test-reports/BM2-campaign-outreach-roi-signoff-2026-04-26.md`
  - L2 复验报告：`docs/test-reports/BM2-campaign-outreach-roi-l2-staging-reverifying-2026-04-26.md`

## MVP 现状
- BM1 + BM2 全部签收，MVP 4 大能力齐备
- 待 Planner 启动下一批次（候选：MVP-visual-fidelity hotfix）

## 角色分配
- Planner Kimi / Generator johnsong / Evaluator Reviewer

## 遗留关注
- visual-regression 仍 Linux canonical（darwin 本地会策略性 skip）
- discovery fullPage 漂移长期根因仍在 backlog（当前 viewport-only 基线稳定）
