---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-065-match-page-internal-rewrite VERIFYING（7/7 Generator 完成 → Reviewer 复验 pending）
- F001 done @ 3c2d70c — /match unified workbench + 双视图 + ?campaignId sidebar shell
- F002 done @ aeb69c7 — Filter + Search + SaveSearchControls + ActiveFilters 合并
- F003 done @ 5426b84 — bulk actions + ImportCsvDialog → /admin/kol-csv-import + admin entry link
- F004 done @ c6ec0f3 — AddKolDialog mount in /match header
- F005 done @ d523de6 — AI sidebar 升级为 AiSuggestionsClient 包装（campaign-context）
- F006 done @ abdec9f — 删除 /discovery + /database 整页 + match.* i18n 完整化 + e2e 迁移（net -4658 lines）
- F007 done @ c5b5c31 — audit script + signoff draft + update-visual-baselines run 25783090333 + prod deploy run 25783092395。Prod health git_sha=c5b5c31 ✓ + audit PASS=7 FAIL=0 WARN=1。Signoff draft: docs/test-reports/BL-065-signoff-2026-05-13.md
- **Reviewer 任务：** L1 复验 + bl065-f007-prod-audit.sh 二次 + 24h pm2 monitor 评估（用户授权自行决定加速）+ signoff v2 + progress.json reverifying → done
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
- 5/13 BL-065-F007 prod redeploy 立即触发（不等 1 周 dogfood）+ 24h monitor 由 Reviewer 自行评估
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 20 条 / BL-066 / BL-067 / BL-068 / BL-048 / BL-070 cleanup 后续解锁
