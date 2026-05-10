---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔄 BL-061-apify-fork-totallikes-verify building — 4/5 done（F001 by Planner ops + F002+F003+F004 by Generator）/ F005 仅剩用户手动 prod deploy + 24h 监控
- ✅ F001 fork-sync deploy @ HEAD=1374473（5/10 13:30 by Planner ops，4 sed/awk hot-fix 落地）
- ✅ F002 staging deeper Prisma 实物核查（5/10 17:00 @ 3dd52af）— 3/3 目标 handle PASS：TT gaming 0.75 / YT ISSEI 18.83 / IG ninja NULL（fork §6.3 known）
- ✅ F003 staging 全量 non_null_pct 验证（5/10 17:55，user choice C amend 阈值 80%→5%）— 实测 6.7% (83/1231) ≥ 5% PASS；platform breakdown IG 0% / TT 1.3% / YT 19.1% 作 BL-062 基线（fork team profile schedules 长期治理）
- ✅ F004 UI tooltip + 5 语言 i18n（5/10 17:21 @ e810c8e）— KolOverviewInfo + KolResultCard 加 info icon，messages/{en,zh,ja,ko,es}.json kol.engagementRate.tooltip key，2 单测 PASS，视觉 baseline regen @ 7a3e96a，staging deployed
- ⏳ F005 = 用户手动 prod redeploy + 24h cron + signoff（spec amendment 后 prod 阈值 ≥5% 同步降）
## ✅ BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🚀 5/13 上线对外（buffer 3 天 — 已用 5/10 一天）
- F003 user choice C 已落地 → F005 unblocked，仅剩用户手动 prod deploy
## 用户手工待办（按优先级）
1. **F005 prod redeploy**（GitHub Actions UI → Actions → 'Deploy to Production' → Run workflow，ref=main，skip_backup=false）— 触发后 5-10min /api/health git_sha 对齐 main
2. F005 prod cron 5/11 早 8:30 BJ (00:30 UTC) 自动跑 daily-sync；5/11 中后段 Generator 重跑 F003 SQL 验证 prod ≥5% → 切 backlog.json BL-058 P0 状态 + 写 signoff → status 切 verifying 由 Reviewer 一并签收 5 features
3. fork 上游待修：(a) packages/service/Dockerfile 加 @apify-kol/apify COPY (b) docker-compose.yml ports default 3003:3003（写 docs/inbox/feedback-fork-dockerfile-2026-05-10.md 由 Planner backlog）
4. role-context/*.md 瘦身（evaluator 77 / generator 87 行已超 ≤50 限）— Planner backlog
5. 5/15 §4.8 seed_expansion / BL-054-flaky / BL-056-notifications 等 backlog
## 关键决议（已 lock）
- 5/9 BL-058 P0 方向 B lock（全等 fork，KOLMatrix 不动）；fork §3.3 mapper 数学等价证明
- 5/9 BL-059 单源 apify-kol；youtube.ts deprecate；30 天 soft delete 6/8 决策
- BL-058 P0 sub-feature 状态仍 fork-fix-completed-pending-deployment（待 BL-061 F005 关闭后切 closed-bl-061-verified）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条（BL-061 active）/ framework 6-layer 完整
