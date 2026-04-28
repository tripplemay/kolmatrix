---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B6-kol-daily-sync** — status=fixing（2026-04-28 首轮验收未通过）
- 进度：5/6 completed，fix_rounds=0
- 报告：`docs/test-reports/B6-kol-daily-sync-verifying-2026-04-28.md`

## 已通过
- F001/F002/F004/F005/F006
- L1：typecheck/lint + unit(24) + integration(6 pass / 2 skipped)
- L2：staging health 正常，F006 #5 日志证据一致（discover=73 inserted=8 updated=265 errors=0）

## 阻断项
- F003：验收要求的 cron deploy 未落地 VM `/etc/cron.d`（仅有 `kolmatrix-cert-expiry`，缺 `kolmatrix-kol-sync` / `kolmatrix-kol-quality`）
- 因此“prod 首次自动跑”证据不可验证

## 备注
- F006 #4 已按文档定义为跨批次 day-5 验证（~05-03），不构成本轮阻断
