---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔄 BL-061-apify-fork-totallikes-verify building — 3/5 done（F001 by Planner ops + F002 + F004 by Generator）/ F003 + F005 阻塞等用户决议
- ✅ F001 fork-sync deploy @ HEAD=1374473（5/10 13:30 by Planner ops，4 sed/awk hot-fix 落地）
- ✅ F002 staging deeper Prisma 实物核查（5/10 17:00 @ 3dd52af）— 3/3 目标 handle PASS：TT gaming 0.75 / YT ISSEI 18.83 / IG ninja NULL（fork §6.3 known）
- ⛔ **F003 阻塞** — 全量 non_null_pct 实测 6.7%（83/1231）远低于 spec 80% 阈值；根因：apify-kol service 1148 个 hashtag-discovery KOL 未触发 profile 调用（postsCount=0/totalLikes=0），mapper 无 bug
- ✅ F004 UI tooltip + 5 语言 i18n（5/10 17:21 @ e810c8e）— KolOverviewInfo + KolResultCard 加 info icon，messages/{en,zh,ja,ko,es}.json 加 kol.engagementRate.tooltip key，2 单测 PASS，视觉 baseline regen @ 7a3e96a；staging deployed @ e810c8e healthy
- ⛔ F005 阻塞 — 依赖 F003 决议 + 用户手动 prod redeploy
## ✅ BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🚀 5/13 上线对外（buffer 3 天 — 已用 5/10 一天）
- F003 决议越早越好；推荐 C 或 B+C 组合（详 docs/test-reports/BL-061-F002-deeper-2026-05-10.md §6）
## 用户手工待办（按优先级）
1. **决议 BL-061 F003 阻塞方案**（A/B/C/D 详见 F002 报告 §6；推荐 C：调降阈值 80%→5% + B：脚本 POST /admin/seeds 头部 N KOL 加快主路径）
2. F003 决议落地后 F005 prod redeploy（GitHub Actions 'Deploy to Production' workflow_dispatch HEAD = 当前 main / 当前 e810c8e）
3. fork 上游待修：(a) packages/service/Dockerfile 加 @apify-kol/apify COPY (b) docker-compose.yml ports default 3003:3003（写 docs/inbox/feedback-fork-dockerfile-2026-05-10.md 由 Planner backlog）
4. role-context/*.md 瘦身（evaluator 77 / generator 87 行已超 ≤50 限）— Planner backlog
5. 5/15 §4.8 seed_expansion / BL-054-flaky / BL-056-notifications 等 backlog
## 关键决议（已 lock）
- 5/9 BL-058 P0 方向 B lock（全等 fork，KOLMatrix 不动）；fork §3.3 mapper 数学等价证明
- 5/9 BL-059 单源 apify-kol；youtube.ts deprecate；30 天 soft delete 6/8 决策
- BL-058 P0 sub-feature 状态仍 fork-fix-completed-pending-deployment（待 BL-061 F005 关闭后切 closed-bl-061-verified）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条（BL-061 active）/ framework 6-layer 完整
