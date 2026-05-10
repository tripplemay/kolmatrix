---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-063-isSaved-decommission building（Phase 1 第一批，ADR-013 物质基础）
- ✅ F001 done @ 83354fc — quick-fix detail.ts 拆 isSaved filter + CampaignKolPanel tooltip + 5 语言 i18n
- ✅ F001 staging deploy（[deployed @ 83354fc @ 5/10 23:25]，run 25632368758，git_sha 一致）
- ⏸ F002-F006 pending — F002 schema migration / F003 src/ 9+ 处全清 / F004 测试更新 / F005 staging dry-run / F006 prod ops
- 📋 Spec: docs/specs/BL-063-isSaved-decommission-spec.md / ADR-013 / vision / roadmap
## 🚨 F002/F003 起工前需 Planner 裁决（pre-impl audit）
- src/ 实际 isSaved 引用**远超 spec §1 9+ 处**：discovery Save/Unsave UI（actions.ts/KolResultCard.tsx/search.ts/2 测试）+ KOL 详情页（kols/[id]/page.tsx + KolActionsCard.tsx）+ database/search.ts:66（核心 filter）+ database/actions.ts:178（第二处写入）+ database/{import,export}-csv 路由
- 问题：本批次同步删？还是等 BL-064 IA 改造一起做？Generator 建议同步删（schema 一旦无字段，所有引用 tsc 必报错；BL-064 是上层路由/导航不应混入）
- 等用户 ack F001 staging dogfood + 决策 F003 范围 → 起 F002
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 上线 deadline 取消 / 6-10 周重构 / Phase 1-4 / BL-064 顶层 IA 依赖 BL-063 done / BL-048 提前到 Phase 2
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
- BL-058 P0 closed-bl-061-verified
## 用户手工待办
1. F001 staging dogfood 实地验证（/campaigns/[id] '添加 KOL' 按钮 enabled + dialog 全量池）
2. 决策 F003 范围（含/不含 discovery Save/Unsave UI 与 KOL 详情页 SavedToggleButton）
3. F006 prod 时间窗 ack（业务低峰期）
4. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL，判断 BL-062 加速路径）
5. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-061 closed） / framework 6-layer
