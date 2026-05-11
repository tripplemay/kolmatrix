---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-063-isSaved-decommission reverifying（6/6 done, fix_rounds=1，§7 用户 ack 加速完成，Reviewer 立即可终审）
- ✅ F001-F004 done — quick-fix detail.ts + schema migration + src/ 全清 + 测试更新（详见 git log）
- ✅ F005 done @ fix-round 1（partial-pending @ 99a3d07 → Planner 0ea747d ruling #1:A #2:A → acceptance §3+§6 修订 + backlog BL-062 跟进 engagement_rate 5/17 weekly）
- ✅ F006 done @ 92b4957 — prod deploy run 25643437421 success @ 2026-05-11T00:02:26Z UTC / 9 项 audit 全 PASS / 用户 prod UI 5/5 PASS / **§7 24h 监控用户直接 ack 加速到 ~2h**，multi-defense evidence 饱和：daily sync cron 实测（00:30 UTC, 1561 discovery + 1231 update + 0 errors）+ second-pass audit (02:18 UTC) + tsc 编译期保证 + CI e2e PASS + pm2 logs 无 isSaved 痕迹。signoff v1.1 docs/test-reports/BL-063-signoff-2026-05-11.md §6 含完整 evidence + 用户授权痕迹。Reviewer 接手即可终审（无需等 22h，可选 2026-05-12 00:30 UTC 后跑第 3 轮 audit 作为保守原则确认）
- 📋 Spec: docs/specs/BL-063-isSaved-decommission-spec.md / ADR-013 / vision / roadmap
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 上线 deadline 取消 / Phase 1-4 / BL-064 顶层 IA 依赖 BL-063 done / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave UI + KOL 详情页 SavedToggleButton（Generator 询问 A/B/C，用户选 A）
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
## 用户手工待办
1. F005 staging dry-run 实地：触发 deploy-staging.yml + SQL audit (column not exists / engagement_rate 不退化 6.7%) + 全量 e2e + /campaigns/[id] UI 实测 + /discovery 实地确认 Save 按钮已消失
2. F006 prod 时间窗 ack（业务低峰期）+ 用户手动触发 deploy-prod + 24h 监控
3. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL，判断 BL-062 加速路径）
4. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条 / framework 6-layer
