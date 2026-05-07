---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-023 KOL 评分升级 — DONE（Reviewer signoff PASS @ 2026-05-07）
- 8 features 全闭环：F001/F002 valueScore 公式（engagement 阶梯 + authenticity）/ F003 16 测试 / F004/F005 sim*100 + 8 测试 / F006 cron recompute top100 / F007 BL-045 dead code / F008 engagement_rate fraction→percent + backfill SQL
- L1：value-score / smart-match / engagement-batch unit + kol-discovery integration 全绿；L2：staging health healthy / discovery shell / Smart Match API matchScore 61 / KOL 详情页 engagementRate 11.4%
- prod：health healthy @ git_sha=e46a7e0；`fraction_rows=0`、`percent_rows=138`、`value_score_non_null=2482`，backfill 后 prod 已回到 BL-023 单位契约
- signoff 文件：docs/test-reports/BL-023-kol-scoring-upgrade-signoff-2026-05-07.md
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🆕 BL-047 入 backlog low — AiSuggestionsClient.test.tsx pre-existing localStorage stub（5/8 BL-021 或 5/12 BL-017 顺手清）
## 🚧 5/13 上线对外时间线
- 5/7 现：**BL-023 verifying** (Codex L2 + signoff)
- 5/8 周五：**BL-021 Suspense critical 5**（~2h）+ 顺手清 BL-047 候选
- 5/9~10 周末：用户业务测继承 + BIx F004 cron 累积 + buffer 多
- 5/11 周一：CSP+NULLIF 1 周观察期满评估
- 5/12 周二：**BL-017 token 过期+撤销** + **BL-046 product soft delete**（独立或合并；BL-047 候选顺手清）
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. BL-023 prod deploy 后跑 `sudo -u postgres psql -d kolmatrix -f scripts/backfill-engagement-rate-bl023-f008.sql`（idempotent）
2. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
## 关键决议（已 lock）
- 5/7 03:00：用户裁决 C — F008 engagement_rate 单位 bug 顺手清入 BL-023（pre-impl-adjudication §11 building 中段裁决实战）
- 5/7 08:00：全 A — BL-043 done + BL-047 入 backlog + BL-023 切 building
- 5/6 21:00：BL-023 spec lock + BIx F004 cron 误判修正
- 5/6 19:50/19:55：5+1 决议 X1 合并 + BL-046 治本
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 16 条（high 3：BL-017/021/046；low 6：BL-011/014/015/018/027/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
