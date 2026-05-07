---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-021 Suspense / loading.tsx Critical Paths — verifying FAIL
- F001 已落地：`src/components/ui/Skeleton.tsx` + 5 个 route `loading.tsx`
- staging 路由 smoke 通过：`/zh/dashboard` / `/zh/discovery` / `/zh/campaigns` / `/zh/campaigns/[id]` / `/zh/roi` / `/zh/weekly-report`
- 阻断：`npx vitest run --pool=forks` 复现 `src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx` 2 fail
- 失败点：`window.localStorage.setItem is not a function` / `window.localStorage.clear is not a function`
- signoff：不可写；建议状态流转 `verifying -> fixing`
## ✅ BL-023 KOL 评分升级 — DONE（Reviewer signoff PASS @ 2026-05-07）
- 8 features 全闭环，prod backfill 已回到 BL-023 单位契约
## ✅ BL-043 — DONE 5/6 22:31 first-round PASS 3/3
## ✅ BL-044 — DONE 5/6 19:10 PASS 4/4 + Prod walk 12/12 PASS
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🆕 BL-047 入 backlog low — AiSuggestionsClient.test.tsx pre-existing localStorage stub
## 🚧 5/13 上线对外时间线
- 5/7 现：**BL-021 fixing**（等待 generator 修复 localStorage 相关测试）
- 5/8 周五：**BL-021 Suspense critical 5** 若修复完成可继续验收
- 5/12 周二：**BL-017 token 过期+撤销** + **BL-046 product soft delete**
- 5/13 周三 ⭐ 上线对外
## 关键决议
- 5/7：BL-021 本轮 verifier 发现 AiSuggestionsClient 测试失败，未达签收
- 5/7 03:00：F008 engagement_rate 单位 bug 顺手清入 BL-023（历史决议）
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 16 条（high 3：BL-017/021/046；low 6：BL-011/014/015/018/027/047；deferred 7）
