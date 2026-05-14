---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-065-match-page-internal-rewrite DONE（7/7, fix_rounds=1, prod=c5b5c31 + BL-065-R1 staging=4562895）
- F001-F005 — /match unified workbench + 双视图 + Filter/Search/SaveSearch 合并 + bulk actions/admin CSV + AddKolDialog + AI sidebar（campaign-context）
- F006 @ abdec9f — 删 /discovery + /database 整页 + match.* i18n 完整化 + e2e 迁移（net -4658 lines）
- F007 prod @ c5b5c31 — audit PASS=7/0/1；BL-065-R1 fix @ 4562895 admin/kol-csv-import 用 tImport.raw() 绕 ICU FORMATTING_ERROR + page-i18n-fidelity 回归
- Reviewer 5/14 复验通过 + signoff `docs/test-reports/BL-065-signoff-2026-05-14.md`
## ✅ BL-064-top-level-ia-refactor DONE — prod git_sha=9b1b15b
## ✅ BL-063-isSaved-decommission DONE — prod deploy run 25643437421
## ✅ BL-061 / BL-060 / BL-059 / BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 / Phase 1-4 / BL-048 提前到 Phase 2
- 5/10 BL-063 砍 discovery Save/Unsave + KOL 详情页 SavedToggleButton
- 5/9 BL-058 P0 方向 B / BL-059 单源 apify-kol / fork §3.3 mapper 数学等价
- 5/11-13 BL-065 8 决策点：card/table 视图 / AI chips drop / soft-delete + client CSV / /admin/kol-csv-import 单子路由 / 直接 import /database / AI sidebar wrap AiSuggestionsClient / 整页硬删除 / prod 立即触发 / `.raw()` vs ICU
- 5/14 framework v0.9.21 沉淀：i18n template 路由迁移核查 / IA refactor redirect scope wire-readiness / 大型删除批次 CI 多轮自修预期 / Reviewer L1+角色门禁手动探针
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条 / 下一批次候选（per Phase 2 plan）：BL-066 (Campaign 详情页 AI 推荐主面板,P0) / BL-048 (valueScore 优化) / BL-070 (二次清理旧 i18n+API) / BL-054 (flaky test isolate) / BL-062 (coverage 治理)
