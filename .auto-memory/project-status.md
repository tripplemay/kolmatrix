---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-024 B4 ghost-controls cleanup — VERIFYING（building 全完 @ 2026-05-06 03:11，staging deployed @ eacbbbb）
- 6/6 features done：F001 ✅ /database 头 3 按钮（Export CSV + Import CSV + Add KOL form）/ F002 ✅ /roi 4 range toggle / F003 ✅ /weekly-report (lastWeek/lastMonth=28d) / F004 ✅ /outreach/tracking list + status filter / F005 ✅ /outreach/suppression list / F006 ✅ deploy yml env bridge fix（BL-034 F001 retroactive）
- Staging health verified：status=healthy，db ok，redis ok（默认 health 不回 git_sha；带 token 的上一轮已对齐 main HEAD=eacbbbb）
- L1：6 个 BL-024 integration 文件 27/27 PASS；visual-baselines-shape PASS；浏览器 smoke 确认 /zh/database /zh/roi /zh/weekly-report /zh/outreach/tracking /zh/outreach/suppression 活控件正常
- spec：docs/specs/BL-024-ghost-controls-cleanup-spec.md（D1-D8 + §F006 hotfix 段）
- v0.9.13 framework 候选（done 阶段交 Planner）：1. spec 改 deploy-script 时同 commit 必须改对应 yml；2. aigcgateway mcp create_action_version 暴露 max_tokens
- Soft-watch：spec 文案要求 tracking-list.png / suppression-list.png 视觉基线，但现有 visual-regression contract 未包含这两页的专门 screenshot test
## 用户手工待办（按优先级）
1. **🟡 BL-024 + BL-035 + BL-034 + BL-020 prod redeploy 大合并**：等 Reviewer signoff 后用户驱动 GH Actions deploy-prod；F006 fix 后 ALTER ROLE 段会真正落地（CRIT-1 修复）；浏览器走 5 处（spec §6.1 / progress.json generator_handoff）：/zh/database 头 3 按钮 + /zh/roi 4 range / /zh/weekly-report 2 range / /zh/outreach/tracking + /zh/outreach/suppression
2. （可选）真触发 Resend hard-bounce 邮件 → 验证 /outreach/suppression 显示 + Kol.email 清空（与 BL-035 F006 prod 真测合并）
3. **aigcgateway 控制台 6 Action max_tokens 设**（Q2 ops Soft-watch — mcp schema 缺）：登录 https://aigc.guangai.ai 按 inventory `docs/specs/BL-035-F013-actions-run-inventory.md §2`
4. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** + **BL-035 F005/F008/F013 + F006 prod 真测**（与 #1 合并是 OK 的）
5. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go v1 prod 浏览器验证**（继承）
6. ~2026-05-09 BIx F004 staging YouTube sync 走查 + BL-034 unused import 顺手清
## ✅ 历史批次 — DONE
- BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 关键决议（已 lock）
- BL-024 D1-D8 + 用户 2026-05-05 22:30 方案 B（A+B+C+D-2+D-3）+ 23:05 方案 A（F006 hotfix 加入）+ 23:30 全权 Q2 ops
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（剩 BL-040+BL-041 / BL-012 crawler-sync / BL-021 / BL-022 / BL-014/15/16 post-MVP）
- 时间线：05-06 BL-024 verifying → 05-07~08 用户驱动 prod redeploy → 05-08~10 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
