---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-065-match-page-internal-rewrite BUILDING（3/7 done, fix_rounds=0）
- F001 done @ 3c2d70c — /match unified workbench layout + 双视图 + ?campaignId AI sidebar shell（CI 双轮）
- F002 done @ aeb69c7 — Filter + Search + SaveSearchControls + ActiveFilters 合并（CI 25720379072 首发绿）
- F003 done @ 5426b84 — bulk actions（MatchBulkActionBar + ConfirmDeleteDialog + bulkSoftDeleteKolsAction）+ ImportCsvDialog git mv to /admin/kol-csv-import + admin entry link on /match。CI 25721825022 首发全 8 jobs 绿。Staging verified
- F004-F007 pending（next F004 = AddKolDialog 集成,估 4h）
- F006 待迁移 e2e 工作量已记录到 progress.json session_notes
## ✅ BL-064-top-level-ia-refactor DONE — prod git_sha=9b1b15b / Signoff: docs/test-reports/BL-064-signoff-2026-05-11.md §9
## ✅ BL-063-isSaved-decommission DONE — prod deploy run 25643437421 success
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 deadline 取消 / Phase 1-4 / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave + KOL 详情页 SavedToggleButton
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
- 5/11 BL-065-F001 双视图词汇 card/table（不复用 grid/list）
- 5/12 BL-065-F002 MatchSearchBar 去 BL-044 AI chips（free-text 语义搜索归 BL-068）
- 5/12 BL-065-F003 bulk soft-delete（保留 audit trail + 可恢复）+ Export CSV client-side Blob（与 /api/database/export-csv 按 filter 语义独立）+ /admin/kol-csv-import 单子路由（不建 /admin 索引页，留 BL-070）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL,判断 BL-062 加速路径）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条 / framework 6-layer / BL-065 F001-F003 done，next F004 等用户 ack 起工
