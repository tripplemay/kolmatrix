---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-kol-seed-redo** — status=done（2026-04-27）
- 进度：6/6 completed，fix_rounds=1
- Signoff：`docs/test-reports/MVP-kol-seed-redo-signoff-2026-04-27.md`

## 复验结论
- F002：按用户 16:00 修订阈值通过（total=760≥750 / CN+HK+TW=83≥80 / quota=8077≤8500）
- F003：upsert 键已切到 `(tenantId, platform, externalId)`；migration + integration(8) 通过
- F006：staging `git_sha=14b1ff7`，3 页面 glass-panel 默认阴影复验为 0

## 验证证据
- L1：typecheck/lint + unit(36) + integration(8) 全绿
- L2：`/api/health` healthy（14b1ff7）+ Playwright 样式探针通过

## 接力条款（跨批次）
- B6 reverifying 第 5 天验证：staging total ≥ 1000 且 CN+HK+TW ≥ 150

## 角色分配
- done 阶段已清空 `role_assignments`（回到默认映射）
