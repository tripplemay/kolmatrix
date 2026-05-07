---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-049 测试基建系统性升级 — BUILDING（spec lock 5/7 10:50 + F007 修订 13:10；7 features ~6h Generator + 0.5h Reviewer）
- F001 vitest coverage.exclude 拆 helper / F002 integration fileParallelism + maxForks=4 (CI 时间 10-15min → 3-4min) / F003 E2E visual 独立 Playwright project + 隔离 DB
- F004 Dependabot config / F005 material-symbols + e2e database-fidelity 2 pre-existing fails 修 / F006 dead code 评估清 / F007 framework v0.9.15 沉淀 2 维
- spec：docs/specs/BL-049-test-infra-systematic-upgrade-spec.md；audit：docs/audit-reports/test-infra-audit-2026-05-07.md（13 项发现）
## ✅ BL-021 — DONE 5/7 13:06（fix-round 1 PASS @ 9fa2a49 / 1.4x 加速 3h36min vs 2.5h）
- F001 Skeleton + 5 critical-path loading.tsx；fix-round 1 实装 AiSuggestionsClient localStorage env-portable Map-backed stub @ 9fa2a49
- signoff：docs/test-reports/BL-021-suspense-critical-paths-signoff-2026-05-07.md
## ✅ BL-023 DONE 5/7 09:23 (8/8 6x) / ✅ BL-043 DONE 5/6 (3/3 2x) / ✅ BL-044 DONE 5/6 (4/4 + Prod 12/12 5x)
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理完毕 5/7 13:40（bc69a65；audit_log 补记永久）— BL-046 仍 5/12 长期治本防新孤儿
## 🆕 BL-050 入 backlog high — Dashboard 顶部 4 KPI trend + sparkline HARDCODED MOCK（KpiRow.tsx），5/12 与 BL-017+BL-046 同期实装
## 🆕 BL-047 closed-resolved（by BL-021 fix-round 1 @ 9fa2a49）
## 🚧 5/13 上线对外时间线（连续 4 批次 done / 含 1 fix-round / 平均 3-5x 加速）
- 5/7 13:10~：**BL-049 building**（Kimi ~6h；按 4-6x 加速可能 1-2h done）
- 5/7 中~晚：BL-049 done + buffer
- 5/8~10 周末：BIx F004 cron + 用户业务测 + Dependabot 首次 run（周一）
- 5/11 周一：CSP+NULLIF 1 周观察期满评估
- 5/12 周二：**BL-017 token + BL-046 product soft delete + BL-050 KPI 真趋势**（3 mini-batch ~2.5 day，独立或合并）
- 5/13 周三 ⭐ 上线对外（4-5 day buffer）
## 用户手工待办
1. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
2. 5/8 周一首次 Dependabot run 后看 PR 列表（5 group），决议合并/延后（F004 push 后）
## 关键决议（已 lock）
- 5/7 13:55：BL-050 dashboard KPI 真趋势化入 backlog high（C）— 5/12 与 BL-017+BL-046 同期；KpiRow trend/sparkline mock 真化
- 5/7 13:40：孤儿 campaign 4425e07e ops 清理（bc69a65 audit_log 补记 / backup /tmp/ops-backup/）
- 5/7 13:10：BL-021 done + BL-049 立即切（A）+ v0.9.15 沉淀 2 维（跨 pool + stub environment-agnostic）
- 5/7 10:50：BL-049 spec lock — X1 合并 audit High 3 + Medium 4 = 7 features
- 5/6 19:50/19:55：5+1 决议 X1 合并 + BL-046 治本
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 3：BL-017/046/050；low 6：BL-011/014/015/018/027/048；closed 1：BL-047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
