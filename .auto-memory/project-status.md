---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ❌ BL-065-match-page-internal-rewrite FIXING（7/7 implemented, fix_rounds=0, Reviewer found BL-065-R1）
- F001-F005 done — /match unified workbench + 双视图 + Filter/Search/SaveSearch 合并 + bulk actions/admin CSV + AddKolDialog + AI sidebar（campaign-context）
- F006 done @ abdec9f — 删除 /discovery + /database 整页 + match.* i18n 完整化 + e2e 迁移（net -4658 lines）
- F007 reviewed @ c5b5c31 — staging/prod deploy + baseline regen + prod audit。Reviewer L1/prod read-only audit 基本 PASS（lint/typecheck/Vitest/match E2E/full failed-spec rerun；prod audit PASS=7 FAIL=0 WARN=1，row-count 补证 total=3941 live=1357 soft_deleted=2584），但 admin import 页本地渲染输出 next-intl FORMATTING_ERROR（successTemplate 缺 imported/skipped；rowErrorTemplate 缺 row/message）。结论：阻断 signoff，需修复后复验。Report: docs/test-reports/BL-065-signoff-2026-05-13.md §8.5/§9
## ✅ BL-064-top-level-ia-refactor DONE — prod git_sha=9b1b15b
## ✅ BL-063-isSaved-decommission DONE — prod deploy run 25643437421
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向：5/13 deadline 取消 / Phase 1-4 / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave + KOL 详情页 SavedToggleButton
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
- 5/11 BL-065-F001 双视图词汇 card/table
- 5/12 BL-065-F002 MatchSearchBar 去 BL-044 AI chips
- 5/12 BL-065-F003 bulk soft-delete + client-side CSV Blob + /admin/kol-csv-import 单子路由
- 5/12 BL-065-F004 AddKolDialog 直接 import /database
- 5/12 BL-065-F005 AI sidebar wrap AiSuggestionsClient + showAiSidebar 基于 resolved campaign
- 5/13 BL-065-F006 /discovery + /database 整页硬删除 + match.* + discovery.* 暂时并存
- 5/13 BL-065-F007 prod redeploy 立即触发（不等 1 周 dogfood）+ 24h monitor 由 Reviewer 自行评估；Reviewer 发现 BL-065-R1 admin import i18n runtime blocker
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / 下一步 Generator 修复 BL-065-R1 后 Reviewer 复验；BL-066 / BL-067 / BL-068 / BL-048 / BL-070 cleanup 暂缓到 signoff 后
