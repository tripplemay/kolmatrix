---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-021 Suspense / loading.tsx Critical Paths — DONE（Reviewer signoff PASS @ 2026-05-07）
- F001 `Skeleton` + 5 个 route `loading.tsx`
- F002 `AiSuggestionsClient.test.tsx` localStorage Map-backed stub，修复跨环境差异
- L1：lint / tsc / vitest 146/146 全绿
- L2：staging `/zh/dashboard` `/zh/discovery` `/zh/campaigns` `/zh/roi` `/zh/weekly-report` smoke 全过
- staging deploy run 25476852038 PASS，部署头 `9fa2a49`
- signoff 文件：docs/test-reports/BL-021-suspense-critical-paths-signoff-2026-05-07.md
## ✅ BL-023 KOL 评分升级 — DONE（Reviewer signoff PASS @ 2026-05-07）
- 8 features 全闭环，prod backfill 已回到 BL-023 单位契约
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🆕 BL-047 已并入 BL-021 fix-round 1
## 🚧 5/13 上线对外时间线
- 5/7：BL-021 done
- 5/8~10 周末：BIx F004 cron + 业务测；5/11：CSP+NULLIF 满期评估
- 5/12：BL-017 + BL-046；5/13 ⭐ 上线
## 关键决议
- 5/7：BL-021 reverifying PASS（fix-round 1）
- 5/7：BL-021 verifying FAIL 后修复 localStorage stub
- 5/7 03:00：F008 engagement_rate 单位 bug 顺手清入 BL-023（历史决议）
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 16 条（high 3：BL-017/021/046；low 6：BL-011/014/015/018/027/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
