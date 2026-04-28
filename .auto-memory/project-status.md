---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B6-kol-daily-sync** — status=verifying（2026-04-28 15:20 BJ 切换）
- 进度：6/6 completed，fix_rounds=0
- role_assignments：planner=Kimi / generator=johnsong（本会话 cli=Kimi 接管）/ evaluator=Reviewer

## 关键决策（本批次）
- A 方案（13:15 lock）：F006 acceptance 拆分加速 — #1-3+#5 本批次 done，#4 接力条款延迟跨批次到 ~05-03
- Ⅱ+Ⅲ 组合（15:10 lock）：acceptance #5 措辞修订为"≥ 30 records 触达（insert OR update）+ log 完整 + 链路无 error"

## acceptance #5 PASS 证据
- staging 手动 sync：discover=73 inserted=8 updated=265 errors=0 quota=1805 level=INFO
- DB 触达：273 records last_synced_at ≥ 2026-04-28T07:01:00Z
- 报告：docs/test-reports/B6-F006-staging-manual-sync-2026-04-28.md

## 遗留问题（用户行动项 — verifying 之后处理）
- prod 在旧 SHA 26dbb7f（behind 277），不含 B6 sync script
- F003 cron deploy 步骤实际未做（VM /etc/cron.d/ 仅有 kolmatrix-cert-expiry）
- 需用户先触发 GitHub Actions Deploy to Production，再 ssh prod 执行 sudo cp cron 文件

## 接力条款（跨批次延迟验证）
- ~2026-05-03 day-5 staging total ≥ 1000 + CN+HK+TW ≥ 150
- 占位报告 docs/test-reports/B6-kol-seed-redo-handoff-validation-2026-05-03.md（含决策树）

## 下游 lock
- B6 done → MVP-demo-launch 合并 sprint（9 features）→ 邀请 ~05-19（A 方案提前 5 天）
