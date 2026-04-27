---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-visual-fidelity-hotfix** ✅ done（2026-04-27 Reviewer 复验签收），7/7，fix_rounds=1
- signoff：`docs/test-reports/MVP-visual-fidelity-hotfix-signoff-2026-04-27.md`

## 复验结论
- 上轮 4 项阻断全部闭环：
  - discovery/database fidelity E2E 文件已补齐并通过
  - campaigns-list-filter / campaign-detail-rsc-boundary integration 文件按 acceptance 对齐并通过
- L1：typecheck/lint + 目标 unit/integration 全 PASS
- L2 staging：preflight healthy（git_sha=406599f），E2E 20 PASS

## 视觉验收说明
- visual-regression 在当前执行节点按 Linux-canonical 策略 skip 13（非 Linux）
- baseline in git 结构与相关守门测试已通过，像素 diff 以 Linux runner 为准

## MVP 状态
- BM1 + BM2 + MVP-visual-fidelity 均已签收，可用于种子用户 demo
