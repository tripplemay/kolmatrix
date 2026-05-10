---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-063-isSaved-decommission building（4/6 done，本批次主体收口）
- ✅ F001 done @ 83354fc — quick-fix detail.ts + tooltip + 5 语言 i18n + staging deployed @ 23:25
- ✅ F002 done — prisma schema 删 isSaved 字段 + 索引 + migration sql（含 backup + ROLLBACK 注释）
- ✅ F003 done — src/ 全清 isSaved（discovery/actions.ts + SavedToggleButton.tsx 整文件删 + 9 文件 trim）— 用户选 A 同步删 UI
- ✅ F004 done — 10 测试 fixture 清理 + 2 文件 describe/it.skip（BL-064 整删） + 新 ≥3 全量池 case
- ⏸ F005 staging dry-run — 等本会话 commit 推完 → deploy-staging.yml 触发 + SQL audit + e2e 实地
- ⏸ F006 prod ops — 用户手动触发 deploy-prod + 24h 监控 + signoff
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
