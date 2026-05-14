---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-065-match-page-internal-rewrite DONE（7/7 implemented, fix_rounds=1, Reviewer 复验通过）
- F001-F005 done — /match unified workbench + 双视图 + Filter/Search/SaveSearch 合并 + bulk actions/admin CSV + AddKolDialog + AI sidebar（campaign-context）
- F006 done @ abdec9f — 删除 /discovery + /database 整页 + match.* i18n 完整化 + e2e 迁移（net -4658 lines）
- F007 prod deployed @ c5b5c31 — staging/prod deploy + baseline regen + prod audit PASS=7/0/1
- BL-065-R1 fix @ 4562895 — /admin/kol-csv-import 用 tImport.raw() 取参数化模板（successTemplate + rowErrorTemplate），避免 next-intl ICU 格式器在 server render 时遇未绑定占位符 throw FORMATTING_ERROR。F003 latent bug：老 /database 同样写法但 middleware 302 掩盖。+ 回归守门 page-i18n-fidelity.test.ts 2 case + CI 25787001116 全 8 jobs 绿 + staging verified @ 4562895
- Reviewer 复验 @ 2026-05-14 — L1 复验 + admin/marketer 双角色 /admin/kol-csv-import 探针通过（admin 渲染无 FORMATTING_ERROR / marketer 302→/match）+ page-i18n-fidelity test 2/2 PASS 确认 + signoff 完成，`docs/test-reports/BL-065-signoff-2026-05-14.md`
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
- 5/13 BL-065-F006 /discovery + /database 整页硬删除
- 5/13 BL-065-F007 prod redeploy 立即触发 + 24h monitor 由 Reviewer 自行评估
- 5/13 BL-065-R1 参数化 i18n 模板用 next-intl `.raw()` 而非 ICU 格式化（client-side String.replace tokens 不应进 server 格式器）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / BL-066 / BL-067 / BL-068 / BL-048 / BL-070 cleanup 暂缓到 BL-065 done
