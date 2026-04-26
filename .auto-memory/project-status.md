---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM2-campaign-outreach-roi** ✅ done（2026-04-26 Reviewer signoff），11/11，fix_rounds=1
  - reverifying 结论：4 阻断全部关闭（F011 baseline in git / F006 seed templates=10 / NAV href 修复 / HARNESS wait 3xx）
  - L1 回归：targeted unit 14/14，integration 6/6，journey A/B 2/2，typecheck/lint 通过
  - signoff：`docs/test-reports/BM2-campaign-outreach-roi-signoff-2026-04-26.md`

## MVP 现状
- BM1 + BM2 均已签收，MVP 4 大能力达成（Discovery/Database/Campaign+Outreach/ROI+Weekly Report）
- 待 Planner 启动下一批次（既定候选：MVP-visual-fidelity hotfix）

## 角色分配
- Planner Kimi / Generator johnsong / Evaluator Reviewer

## 关键约束与遗留
- visual-regression 仍为 Linux canonical；darwin 本地复验会平台跳过（本轮已记录于 signoff）
- discovery fullPage 漂移仍在 backlog（当前以 viewport-only baseline 稳定）

## 环境
- 本地 L1：Codex 专用端口 `3099`（codex-setup / codex-wait / codex-e2e）
- Prod `4b05cb60` / Staging `c96fb98`
