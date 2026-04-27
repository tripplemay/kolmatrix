---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-visual-fidelity-hotfix** ✅ done（2026-04-27 Reviewer 签收 + Planner 收尾完成），7/7，fix_rounds=1
- signoff：`docs/test-reports/MVP-visual-fidelity-hotfix-signoff-2026-04-27.md`
- L1 + L2 staging 全 PASS（E2E 20 PASS / visual 13 skip Linux-canonical）
- Stitch 还原度 🟢 通过
- BL-013 由 Generator 顺手修复（commits 05682cd + 0f688d2），backlog 已关闭

## ⚠️ Prod 与最新 main 不同步（待用户决定）
- HEAD = f2a5c66（hotfix done signoff）
- prod = 0f688d2（BL-013 followup，hotfix UI 重写之前）
- 建议用户立即触发 prod deploy 部署 f2a5c66（否则种子用户看到旧 UI）

## MVP 状态
- BM1 + BM2 + MVP-visual-fidelity 均已签收，4 大能力可用于种子用户 demo

## 下一批次候选（spec 已 decisions-locked，等用户启动信号）
- MVP-prod-launch-smoke micro-batch（半天，Reviewer）
- MVP-seed-demo-prep（4 features，2-2.5 day）
- BIx-staging-automation（demo done 立即，5 features，2.5 day）
- B4-extended-email-system（MVP 上线 4 周后 trigger 触发分阶段做）

## 角色分配
- 默认（无 role_assignments）= CLI Planner+Generator / Codex Evaluator
- 上次批次：planner=Kimi / generator=johnsong / evaluator=Reviewer
