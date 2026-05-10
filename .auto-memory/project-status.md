---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔄 BL-061-apify-fork-totallikes-verify verifying — 5/5 features Generator-side PASS @ 5/10 18:10，等 Codex Reviewer 签收
- ✅ F001 fork-sync deploy @ HEAD=1374473（Planner 13:30 ops + 4 sed/awk hot-fix）
- ✅ F002 staging 3 handle 实物核查（17:00 @ 3dd52af）— TT 0.75 / YT 18.83 / IG NULL 接受
- ✅ F003 全量 ≥5%（17:55 @ b618d5d，user choice C amend 80%→5%）— staging 6.7% PASS；platform 基线 IG 0%/TT 1.3%/YT 19.1%
- ✅ F004 UI tooltip + 5 lang i18n（17:21 @ e810c8e + visual baseline regen 7a3e96a）— 2 单测 PASS + staging deployed
- ✅ F005 prod redeploy + 验收（18:04，prod git_sha=b618d5d；prod sync inserted=938+updated=292；prod SQL 6.7%(82/1231)≥5% PASS；3 handle 与 staging 完全一致；BL-058 P0 closed-bl-061-verified）
- 📋 signoff: docs/test-reports/BL-061-signoff-2026-05-10.md（Generator side 收口完成）
## ✅ BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🚀 5/13 上线对外（buffer 3 天 — 用 1.5 天，剩 5/11+5/12+5/13）
- BL-061 Generator 已 5/5 PASS + status verifying → Codex Reviewer 启动签收 → PASS 切 done → 5/13 ready
## 用户手工待办（按优先级）
1. 在 Codex 端启动 Reviewer 角色（progress.json status=verifying 自动触发 evaluator.md 加载）— 跑 L1 + L2 + UI/SQL 复核 + 写 evaluator signoff
2. Reviewer PASS 后由 Planner（CLI）走 done 阶段：处理 proposed-learnings + 询问下批次（候选 BL-062 数据 coverage 治理 / BL-054-flaky / BL-056-notifications / 用户提其他）
3. fork 上游待修：(a) packages/service/Dockerfile 加 @apify-kol/apify COPY (b) docker-compose.yml ports default 3003:3003（写 docs/inbox/feedback-fork-dockerfile-2026-05-10.md 由 Planner backlog）
4. role-context/*.md 瘦身（evaluator 77 / generator 87 行已超 ≤50 限）— Planner backlog
5. 5/15 §4.8 seed_expansion / BL-054-flaky / BL-056-notifications 等 backlog
## 关键决议（已 lock）
- 5/9 BL-058 P0 方向 B lock（全等 fork，KOLMatrix 不动）；fork §3.3 mapper 数学等价证明
- 5/9 BL-059 单源 apify-kol；youtube.ts deprecate；30 天 soft delete 6/8 决策
- BL-058 P0 sub-feature 状态仍 fork-fix-completed-pending-deployment（待 BL-061 F005 关闭后切 closed-bl-061-verified）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条（BL-061 active）/ framework 6-layer 完整
