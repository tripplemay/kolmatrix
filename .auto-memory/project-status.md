---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-063-isSaved-decommission DONE（6/6 done, fix_rounds=1, Reviewer signoff v2）
- F001-F004 done — quick-fix detail.ts + schema migration + src/ 全清 + 测试更新（详见 git log）
- F005 done @ fix-round 1（partial-pending @ 99a3d07 → Planner 0ea747d ruling #1:A #2:A → acceptance §3+§6 修订 + backlog BL-062 跟进 engagement_rate 5/17 weekly）
- F006 done @ 92b4957 — prod deploy run 25643437421 success；用户 prod UI 5/5 PASS；§7 经用户 ack 加速，Reviewer 2026-05-11 05:02 UTC 独立只读 audit PASS：git_sha healthy / migration finished / column+index dropped / engagement_rate 107≥95 / row count sane / src comments-only / pm2 last 1000 lines no isSaved。唯一 backup-age WARN 为预期不阻断。Signoff: docs/test-reports/BL-063-signoff-2026-05-11.md §8
- BL-064 顶层 IA 改造已解锁
## ✅ BL-064-top-level-ia-refactor DONE（7/7 done, fix_rounds=3, Reviewer signoff v2）
- 7 路由 → 4 路由（Brief/Match/Reach/Insight）已完成；F002 redirect 最终为 5 content-equivalent + /campaigns/[id] parametric，其余 deep-link kept 归 BL-066/069/070
- Staging + prod deployed，prod git_sha=9b1b15b；用户 logged-in prod UI spot check PASS；Reviewer L1 PASS（lint/typecheck/unit + redirect E2E hot rerun 43/43）+ prod read-only audit PASS=18 FAIL=0 WARN=1，pm2 clean。Signoff: docs/test-reports/BL-064-signoff-2026-05-11.md §9
- BL-065 Match 页内部重写 DRAFT 已存在，可进入下一批次规划
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 上线 deadline 取消 / Phase 1-4 / BL-064 顶层 IA 依赖 BL-063 done / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave UI + KOL 详情页 SavedToggleButton（Generator 询问 A/B/C，用户选 A）
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL，判断 BL-062 加速路径）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条（BL-062 数据 coverage 治理新增）/ framework 6-layer / **下一批次 BL-065 Match 页内部重写 DRAFT ready**
