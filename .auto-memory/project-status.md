---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-021 Suspense Critical Paths — BUILDING（F001 done / F002 partial-pending 裁决中 5/7 10:30）
- F001 ✅ commit 0e0a054 Skeleton + 5 loading.tsx；L1 lint+tsc+1043 tests 全绿
- F002 ⏸ spec premise 错误（测试已 PASS 无 bug）；详细 evidence + 3 选项见 progress.json.generator_handoff（推荐 A 取消 F002）
- 状态机：building stays，等 Planner 短格式裁决 → 方案 A 可直接切 verifying（先 staging deploy）
## ✅ BL-023 KOL 评分升级 — DONE 5/7 09:23（first-round PASS 8/8 / 6x 加速 1h14min vs 7h）
- prod 验证：fraction_rows=0 / percent_rows=138 / value_score_non_null=2482 / git_sha=e46a7e0
- signoff 文件：docs/test-reports/BL-023-kol-scoring-upgrade-signoff-2026-05-07.md
## ✅ BL-043 DONE 5/6 (3/3 2x) / ✅ BL-044 DONE 5/6 (4/4 + Prod 12/12 5x)
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🚧 5/13 上线对外时间线（连续 3 批次 first-round PASS / 平均 4-5x 加速）
- 5/7 现：**BL-021 F001 done / F002 待裁决** → staging deploy + Codex verifying
- 5/8~10 周末：BIx F004 cron + 用户业务测；5/11：CSP+NULLIF 满期评估
- 5/12：**BL-017 token + BL-046 product soft delete**；5/13 ⭐ 上线（4-day buffer）
## 用户手工待办
1. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
## 关键决议（已 lock）
- 5/7 10:30：Generator F002 partial-pending 裁决请求（pre-impl-adjudication §11 第 2 次实战）
- 5/7 09:30：BL-023 done + BL-021 立即启动（A）+ X1 BL-047 顺手清
- 5/7 03:00：用户裁决 C — F008 building 中段加（§11 第 1 次实战）
- 5/6 19:50/19:55：5+1 决议 X1 合并 + BL-046 治本
## 角色 / Backlog（默认映射 CLI=planner+generator / Codex=evaluator；Backlog 14 条 high 2）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
