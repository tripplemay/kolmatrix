---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-021 Suspense Critical Paths — BUILDING（spec lock 5/7 09:30；2 features ~2.5h Generator + 0.5h Reviewer）
- F001 5 critical routes loading.tsx（dashboard/discovery/campaigns/roi/weekly-report）+ 通用 src/components/ui/Skeleton.tsx 组件（提取现有 5 处 inline animate-pulse）— 2h
- F002 X1 BL-047 顺手清 AiSuggestionsClient.test.tsx pre-existing localStorage stub fail — 30 min
- spec：docs/specs/BL-021-suspense-critical-paths-spec.md；前端审计 H-P4 收益 -300~800ms 首屏感知
## ✅ BL-023 KOL 评分升级 — DONE 5/7 09:23（first-round PASS 8/8 / 6x 加速 1h14min vs 7h）
- prod 验证：fraction_rows=0 / percent_rows=138 / value_score_non_null=2482 / git_sha=e46a7e0
- signoff 文件：docs/test-reports/BL-023-kol-scoring-upgrade-signoff-2026-05-07.md
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3（2x 加速）
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS（5x 加速）
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🚧 5/13 上线对外时间线（连续 3 批次 first-round PASS 0 fix-round + 平均 4-5x 加速）
- 5/7 现：**BL-021 building**（Kimi ~2.5h）→ done
- 5/7 中午~晚：buffer + 用户业务测继承
- 5/8~10 周末：BIx F004 cron 累积 + 用户业务测
- 5/11 周一：CSP+NULLIF 1 周观察期满评估
- 5/12 周二：**BL-017 token 过期+撤销** + **BL-046 product soft delete**（独立或合并）
- 5/13 周三 ⭐ 上线对外（4-5 day buffer）
## 用户手工待办
1. ~~BL-023 prod deploy + backfill SQL~~ ✅ DONE 5/7（Codex 已验证 prod TC-05 PASS）
2. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
## 关键决议（已 lock）
- 5/7 09:30：BL-023 done + BL-021 立即启动（A）+ X1 BL-047 顺手清
- 5/7 09:14：Codex BL-023 signoff PASS（patch-bridge from 另一台电脑，author audit 保留）
- 5/7 03:00：用户裁决 C — F008 building 中段加（pre-impl-adjudication §11 实战）
- 5/6 19:50/19:55：5+1 决议 X1 合并 + BL-046 治本
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 14 条（high 2：BL-017/046；low 5：BL-011/014/015/018/027；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
