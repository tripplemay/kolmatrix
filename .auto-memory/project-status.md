---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-024 + Framework v0.9.13 + BL-024 F007 retroactive + prod redeploy 大合并 — ALL DONE 2026-05-06 ~08:00
- BL-024 done @ eacbbbb (6/6 first-round PASS, fix_rounds=0)；signoff: docs/test-reports/BL-024-ghost-controls-cleanup-signoff-2026-05-06.md
- Framework v0.9.13 沉淀完毕（commit 7471434）：deploy-patterns.md §5.1 spec deploy-script vs yml 同 commit 规律 + ai-action-contract.md §4.7 mcp 自动化可达性
- BL-024 F007 retroactive hotfix（commit 8be3115，Planner ops 用户授权）：deploy-prod.sh + deploy-staging.sh ALTER ROLE 改 sudo -u postgres peer auth 替换 PGPASSWORD/-h/-U（无 POSTGRES_SUPERUSER_PASSWORD env）
- prod redeploy 大合并 done（run 25408848271 SUCCESS @ 8be3115）：CRIT-1 真闭环 — ALTER ROLE 跑通 + KOLMATRIX_APP_PASSWORD 32-char hex 已轮换 + DATABASE_URL 同步 + 5 env vars 已生效 + git_sha 对齐 + Resend webhook svix 401 验签 ✓
- 实战教训（v0.9.12 §5.4 同模式）：bash 旧 bytecode — 第 1 次 deploy fail（PGPASSWORD path 旧版本）+ 第 2 次 fail（git checkout 但 bash 已 mmap 旧版本）+ 第 3 次 PASS（新 bash 进程重 read）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. ~~🔴 prod redeploy 大合并 + KOLMATRIX_APP_PASSWORD 落地~~ ✅ **DONE by Planner ops 2026-05-06 ~08:00**（CRIT-1 retroactive 完整闭环）
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
