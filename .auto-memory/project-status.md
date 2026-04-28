---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B6-kol-daily-sync** — status=reverifying（2026-04-28 15:55 BJ）
- 进度：6/6 completed，fix_rounds=1
- 报告：`docs/test-reports/B6-kol-daily-sync-fixing-round-1-2026-04-28.md`

## fix-round 1 闭环（Z 路径）
- 用户 ~15:40 触发 prod redeploy → prod 升到 `83edd3b`
- F003 三项 acceptance 全部落地：
  - cron deploy（kolmatrix-kol-sync + kolmatrix-kol-quality）到 /etc/cron.d/
  - prod 首次跑：手动 npm run kol-sync:daily → /var/log/kolmatrix-kol-sync.log INFO 行 + DB 760→768
  - logrotate `su tripplezhou tripplezhou` directive 修复 + dry-run 通过

## 已通过项（首轮 + fix-round 1）
- F001/F002/F004/F005/F006（首轮 PASS）
- F003 fix-round 1 PASS
- L1：typecheck/lint + unit(83/542) + integration(32/241+2 skip)
- L2：staging git_sha=83edd3b，acceptance #5 273 触达 PASS
- prod manual sync evidence：discover=71 inserted=8 updated=263 errors=0 quota=1805

## 跨批次延迟项（不阻塞 done）
- F006 acceptance #4 接力条款 → ~2026-05-03 day-5 验证（占位报告 docs/test-reports/B6-kol-seed-redo-handoff-validation-2026-05-03.md）

## 下游 lock
- B6 done → MVP-demo-launch 合并 sprint（9 features）→ 邀请 ~05-19（A 方案提前 5 天）
