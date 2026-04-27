---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-kol-seed-redo** — status=fixing（fix-round 1 部分完成）
- 进度：5/6 completed（F003+F006 fix-round 1 done），F002 待次日 quota 重置
- Reviewer 报告：`docs/test-reports/MVP-kol-seed-redo-verifying-2026-04-27.md`

## fix-round 1 闭环（今日）
- **F006**：staging redeploy（之前 deploy 漏 npm run build → CSS 缓存陈旧）。验证：CSS bundle 无 glass-panel box-shadow ✅
- **F003**：upsert key handle→externalId。Migration 20260427230000_kol_external_id_unique 加 @@unique([tenantId, platform, externalId])。staging import re-run 760 updated 0 inserted ✅。+1 integration spec（8 总）
- staging git_sha=14b1ff7

## fix-round 1 待办（明日 quota 重置后）
- F002 supplementary：3 region × 4 keyword（游戏直播/Steam/独立游戏/手游推荐）× 50 = ~1225u
- 修订阈值：total ≥ 800 / CN+HK+TW(country) ≥ 150 / quota ≤ 9500
- 完成后切 reverifying，fix_rounds=1

## 已通过
- L1：typecheck/lint + 235 integration specs（含新 rename 用例）+ 全 unit 套件
- staging /api/health healthy，git_sha=14b1ff7，DB 3295 Kol（demo=760 不变）

## 角色分配
- planner=Kimi / generator=johnsong / evaluator=Reviewer
