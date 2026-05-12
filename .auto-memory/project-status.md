---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-065-match-page-internal-rewrite BUILDING（2/7 done, fix_rounds=0）
- F001 done @ 3c2d70c — /match unified workbench layout + 双视图 + ?campaignId AI sidebar shell。CI 双轮（首红：i18n + e2e selector drift；二绿 25669777846）
- F002 done @ aeb69c7 — Filter + Search + SaveSearchControls + ActiveFilters 合并（MatchFilterSidebar / MatchSearchBar / MatchActiveFilters / MatchTableSearch + page.tsx 重写）。CI 25720379072 首发全 8 jobs 绿。Staging deploy aeb69c7 verified
- F003-F007 pending（next F003 = BulkActionBar 集成 + ImportCsvDialog 移 /admin，估 6h）
- F006 待迁移 e2e 工作量已记录到 progress.json session_notes
## ✅ BL-064-top-level-ia-refactor DONE（7/7, fix_rounds=3）— prod git_sha=9b1b15b / Signoff: docs/test-reports/BL-064-signoff-2026-05-11.md §9
## ✅ BL-063-isSaved-decommission DONE（6/6, fix_rounds=1）— prod deploy run 25643437421 success
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 上线 deadline 取消 / Phase 1-4 / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave UI + KOL 详情页 SavedToggleButton
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
- 5/11 BL-065-F001 双视图词汇 card/table（不复用 grid/list）；旧 ?view=grid/list/campaigns deep-link fallback 到 card
- 5/12 BL-065-F002 MatchSearchBar 主动去 BL-044 AI chips（free-text 语义搜索归 BL-068 B3 natural-language refine，不在 BL-065 范围）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL，判断 BL-062 加速路径）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条 / framework 6-layer / BL-065 F001-F002 done，next F003 等用户 ack 起工
