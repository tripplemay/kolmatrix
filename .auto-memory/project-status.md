---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-023 KOL 评分升级 — BUILDING（spec lock 5/6 21:00；切 building 5/7 08:00；7 features ~4.7h Generator + 0.5h Reviewer）
- F001 真 engagement_rate 替 placeholder=15（阶梯 5 段位） / F002 authenticity modifier / F003 测试 ≥6 / F004 similarityToScore 重映射（sim*100，0=0 非 50）/ F005 测试 ≥4 + 旧 fixture 更新 / F006 kol-sync-daily 后 trigger 重算 top 100 / F007 BL-045 dead code 顺手清（X1）
- spec：docs/specs/BL-023-kol-scoring-upgrade-spec.md；BIx F004 cron 已 6 天累积 137 KOL with 真 engagement_rate（data ready）
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3（v0.9.15 跳过 proposed-learnings 空；2x 加速 1.5h vs 3h）
- signoff: docs/test-reports/BL-043-deploy-bridge-verifying-2026-05-06.md（Codex 接受作 signoff，含 3 TC + Final PASS）
- F001 deploy-{staging,prod}.sh fail-fast / F002 environment.md 密码 sync 协议 / F003 staging smoke 双路径 staging 实测 PASS
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS @ Codex
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🆕 BL-047 入 backlog low — AiSuggestionsClient.test.tsx pre-existing localStorage stub（5/8 BL-021 或 5/12 BL-017 顺手清）
## 🚧 5/13 上线对外时间线（再前移）
- 5/7 现：**BL-023 building** (Kimi ~4.7h)
- 5/8 周五：**BL-021 Suspense critical 5**（~2h）+ buffer + 顺手清 BL-047 候选
- 5/9~10 周末：用户业务测继承 + BIx F004 cron 累积 + buffer 多
- 5/11 周一：CSP+NULLIF 1 周观察期满评估
- 5/12 周二：**BL-017 token 过期+撤销** + **BL-046 product soft delete**（独立或合并；BL-047 候选顺手清）
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. ~~prod redeploy + 12 处浏览器 walk~~ ✅ DONE 5/6 12 PASS by Codex
2. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
## 关键决议（已 lock）
- 5/7 08:00：全 A — BL-043 done + BL-047 入 backlog + BL-023 切 building
- 5/6 21:00：BL-023 spec lock + BIx F004 cron 误判修正
- 5/6 19:50/19:55：5+1 决议 X1 合并 + BL-046 治本
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 16 条（high 3：BL-017/021/046；low 6：BL-011/014/015/018/027/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
