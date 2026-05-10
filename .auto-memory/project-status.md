---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-061-apify-fork-totallikes-verify DONE — Codex Reviewer signed off @ 5/10 21:20
- ✅ F001 fork-sync deploy：apify-kol-service HEAD=1374473 + /health ok
- ✅ F002/F003 staging SQL：1231 total / 83 non-null / 6.7%；TT gaming 0.75 / YT ISSEI 18.83 / IG ninja NULL 接受
- ✅ F004 UI tooltip+i18n：local + staging `/discovery` 5 locale title 全匹配；`/en/kols/:id` detail tooltip PASS
- ✅ F005 prod SQL：1231 total / 82 non-null / 6.7%；3 handle 与 staging 一致；prod health git_sha=b618d5d healthy
- 📋 Reviewer signoff: docs/test-reports/BL-061-reviewer-signoff-2026-05-10.md
## ✅ BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🚀 5/13 上线对外（buffer 3 天 — 用 1.5 天，剩 5/11+5/12+5/13）
- BL-061 done @ 21:20 Codex signoff；CLI Planner 5/10 done 阶段处理完成；5/13 ready，等用户决定下批次
## 用户手工待办（按优先级）
1. Planner（CLI）走 done 阶段：处理 proposed-learnings + 询问下批次（候选 BL-062 数据 coverage 治理 / BL-054-flaky / BL-056-notifications / 用户提其他）
2. 5/17 第一次 weekly growth-curve check：重跑 BL-061 F003 SQL，判断是否启动 BL-062 加速路径
3. fork 上游待修：(a) packages/service/Dockerfile 加 @apify-kol/apify COPY (b) docker-compose.yml ports default 3003:3003（写 docs/inbox/feedback-fork-dockerfile-2026-05-10.md 由 Planner backlog）
4. role-context/*.md 瘦身（evaluator 77 / generator 87 行已超 ≤50 限）— Planner backlog
5. 5/15 §4.8 seed_expansion / BL-054-flaky / BL-056-notifications 等 backlog
## 关键决议（已 lock）
- 5/9 BL-058 P0 方向 B lock（全等 fork，KOLMatrix 不动）；fork §3.3 mapper 数学等价证明
- 5/9 BL-059 单源 apify-kol；youtube.ts deprecate；30 天 soft delete 6/8 决策
- BL-058 P0 sub-feature 已 closed-bl-061-verified；80%/95% coverage 长期目标转 BL-062
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-061 closed并入 features.json 已 done）/ framework 6-layer 完整
