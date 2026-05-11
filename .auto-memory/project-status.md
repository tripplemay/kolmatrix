---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-063-isSaved-decommission reverifying（6/6 done, fix_rounds=1，等 Reviewer 24h second-pass audit）
- ✅ F001-F004 done — quick-fix detail.ts + schema migration + src/ 全清 + 测试更新（详见 git log）
- ✅ F005 done @ fix-round 1（partial-pending @ 99a3d07 → Planner 0ea747d ruling #1:A #2:A → acceptance §3+§6 修订 + backlog BL-062 跟进 engagement_rate 5/17 weekly）
- ✅ F006 immediate done @ 92b4957 — prod deploy run 25643437421 success @ 2026-05-11T00:02:26Z UTC / 9 项 audit 全 PASS（git_sha=92b4957 / migration finished / column+index dropped / engagement_rate 107≥95 / row count sane / src/ comments-only / pre-deploy backup db-20260511-000236.sql.gz 22M / pm2 logs immediate clean）+ 用户 prod UI 5/5 PASS / signoff v1 docs/test-reports/BL-063-signoff-2026-05-11.md。§7 24h pm2 监控由 Reviewer 在 reverifying 阶段（部署后 24h 起即 2026-05-12 ~00:00 UTC）跑 second-pass audit 验证 + 写 signoff v2 + 切 reverifying → done
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
