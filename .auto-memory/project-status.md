---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-kol-seed-redo** — status=reverifying（fix-round 1 完成 6/6，fix_rounds=1）
- 等待：Reviewer 复验

## fix-round 1 闭环（用户 16:00 同意 B6 接力策略，Planner 二次修订阈值）
- **F002**：直接 PASS（修订阈值 750/80/8500，现状 760/83/8077 全满足）。B6 第 5 天补累计 total≥1000 / CN+HK+TW≥150
- **F003**：commit 14b1ff7 — externalId-based dedupe + migration + 8 integration specs + staging idempotency 验证
- **F006**：staging redeploy（之前 deploy 漏 npm run build → CSS 缓存陈旧）+ CSS bundle 验证无 box-shadow

## 节省
- Generator ~30 min / 1925 quota 留给 B6 / Reverifying ~30-60 min / 邀请节点不变（~05-09）

## staging 现状
- HEAD: 14b1ff7（main HEAD c0a03e1 是 Planner state-only commit，不影响 staging 运行时）
- /api/health healthy / DB 3295 Kol（demo=760）
- 测试：unit 475 + integration 235（含本批 8 specs，新增 channel-rename 用例）全绿
- CSS bundle .glass-panel 无 box-shadow ✅

## Reviewer 复验关注
- F002 按修订阈值 PASS / F003 重跑 import 应是 updated 路径 / F006 重跑 Playwright probe 应 panelShadowNonNone=0

## 角色分配
- planner=Kimi / generator=johnsong / evaluator=Reviewer
