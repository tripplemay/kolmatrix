---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-024 B4 ghost-controls cleanup — DONE 2026-05-06 ~07:30（first-round PASS @ eacbbbb，fix_rounds=0，0 PARTIAL/FAIL）
- 6/6 PASS：F001 ✅ /database 头 3 按钮（Export+Import+Add KOL）/ F002 ✅ /roi 4 range / F003 ✅ /weekly-report 2 range（28-day 聚合）/ F004 ✅ /outreach/tracking / F005 ✅ /outreach/suppression / F006 ✅ deploy yml env bridge fix（BL-034 F001 retroactive）
- L1：27/27 集成测试 + 3/3 visual-baselines-shape + lint+tsc 0 errors / L2：staging 5 处浏览器走查 + git_sha=eacbbbb 与 main HEAD 一致
- signoff: docs/test-reports/BL-024-ghost-controls-cleanup-signoff-2026-05-06.md（2 项 Soft-watch S1+S2 兜底）
- v0.9.13 候选 2 项已写入 framework/proposed-learnings.md（done 阶段交用户决议）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. **🔴 prod redeploy 大合并（BL-024 + BL-035 + BL-034 + BL-020）+ KOLMATRIX_APP_PASSWORD 落地**：现 main HEAD（含 BL-024 F006 yml 桥接 fix）已就绪。SSH prod 生成 random KOLMATRIX_APP_PASSWORD（openssl rand -hex 16）+ 写 .env.production + 同步 DATABASE_URL 中 kolmatrix_app:OLD_PWD@... → :NEW_PWD@...（手术级，错一字符 prod 全断）→ GH Actions Deploy → ALTER ROLE 真生效（CRIT-1 retroactive 闭环）→ curl health 验 git_sha 对齐 + 5 处浏览器走查 + Resend 测试邮件触发 hard-bounce 验 EmailLog.status + Kol.email 清空
2. **aigcgateway 控制台 UI 设 6 Action max_tokens**（继承 BL-035 S5 + BL-024 Q2 ops Soft-watch — mcp schema 缺）：登录 https://aigc.guangai.ai 按 inventory `docs/specs/BL-035-F013-actions-run-inventory.md §2` 矩阵设（500/1000/2000/4000）
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** → 满后用户驱动 prod redeploy（与 #1 合并是 OK 的）
4. **BL-035 F005/F008/F013 + F006 prod 真测**（依赖 #1+#2）：第 2 tenant 启用 + outreach composer ≥9 KOL + aigcgateway logs 抽样 + 测试邮件 hard bounce
5. **BL-034 F005 cost-cap event_log staging 实测**（继承）+ **Pokemon Go v1 prod 浏览器验证**（继承）
6. **BL-024 done 后 prod 浏览器 5 处 walk** + ~05-09 BIx F004 staging YouTube sync + BL-024 SW-1 visual baseline tracking-list/suppression-list.png 后续顺手补 + BL-034 unused import 顺手清
## 关键决议（已 lock）
- BL-024 D1-D8 + 用户 2026-05-05 22:30 方案 B / 23:05 方案 A（F006 hotfix）/ 23:30 全权 Q2 ops / 2026-05-06 07:00 方案 A（Soft-watch + Planner 临时担任 evaluator 完成 signoff）
- BL-035 / BL-034 / BL-020 / v0.9.11 / v0.9.12 — 不动
- v0.9.13 候选 2 项待用户决议（spec 改 deploy-script 同 commit 改 yml + mcp create_action_version max_tokens 字段缺失）
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator；BL-024 verifying 由 Codex 短笔记 + Planner 临时担任 evaluator 完成 signoff（与 BL-020/BL-034/BL-035 同模式）
- Backlog 18 条（剩 BL-040+BL-041 PRD 偏差 / BL-012 crawler-sync (post-MVP) / BL-021 Suspense 边界 / BL-022 列表虚拟化 / BL-014/15/16 post-MVP）
- 时间线：05-06 BL-024 done → 05-06~07 用户驱动 prod redeploy 大合并 → 05-08~10 BL-040+BL-041 → 05-11~12 buffer → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
