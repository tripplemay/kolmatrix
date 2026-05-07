---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-021 Suspense / loading.tsx Critical Paths — REVERIFYING（fix-round 1 done @ 5/7 13:00）
- F001 commit 0e0a054 + fix-round 1 commit 9fa2a49（AiSuggestionsClient localStorage Map-backed stub，跨环境）
- L1：lint 0 / tsc 0 / vitest local 2/2 PASS / CI run 25476595687 关键 6 jobs PASS（Linux 容器 Unit job 间接验证 fix 跨环境）
- staging deploy run 25476852038 PASS / git_sha=9fa2a49 / health 200
- 等 Codex reverifying L1+L2 → signoff → done
## ✅ BL-023 KOL 评分升级 — DONE（Reviewer signoff PASS @ 2026-05-07）
- 8 features 全闭环，prod backfill 已回到 BL-023 单位契约
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🆕 BL-047 fix 已并入 BL-021 fix-round 1（commit 9fa2a49）— 可从 backlog 转 closed
## 🚧 5/13 上线对外时间线
- 5/7 现：**BL-021 reverifying**（等 Codex L1+L2）→ done 预估 13:30 前
- 5/8~10 周末：BIx F004 cron + 业务测；5/11：CSP+NULLIF 满期评估
- 5/12：**BL-017 token + BL-046 product soft delete**；5/13 ⭐ 上线（4-day buffer）
## 关键决议
- 5/7 13:00：BL-021 fix-round 1 完成（localStorage Map-backed stub）+ staging 9fa2a49 PASS
- 5/7 11:51：Codex verifying FAIL（forks pool 复现 localStorage TypeError，环境依赖确认）
- 5/7 03:00：F008 engagement_rate 单位 bug 顺手清入 BL-023（历史决议）
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 16 条（high 3：BL-017/021/046；low 6：BL-011/014/015/018/027/047；deferred 7）
