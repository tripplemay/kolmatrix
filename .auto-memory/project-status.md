<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-076-apify-numeric-overflow REVERIFYING (4/5, fix_rounds=2) — fix-round 2 spec amend 完成, Reviewer round 3 可立即 signoff
- 三件套 commit f718704 + state 3449ead 已在 prod 生效，prod fix 证据继续成立
- Reviewer round 2 staging 跑 --enrichment-limit=10 结果 `discover=2567 inserted=0 updated=1859 failed=0 errors=0 level=INFO` — 无 overflow / 无 import failure / 无 error entries, 但卡 spec `stats.inserted>0`
- Fix-round 2 根因 (用户 ack Option 2): apify-kol 服务端每日固定 ~2567 discovery pool, staging cron 长期 sync 已把整池落库, 全部走 update path = `inserted=0` 是 steady-state 健康. Prod F004 `inserted=474` 是 14 天 outage 累积一次性补回的瞬时语义, 修复后下次 prod 也回 `inserted=0`. 原 spec 混淆瞬时和稳态语义
- 修订 (commit 待 push, 0 行业务代码, 与 fix-round 1 同模式): spec §F005 L2 #1 改为 `(stats.inserted + stats.updated) > 0` + `failed=0` + errors 无 'numeric field overflow' (含 steady-state 健康说明); L2 #2 改为 `tail -1 /var/log/kolmatrix-kol-sync.log` 直接验 prod F004 落盘的瞬时证据 (inserted=474 updated=1385 errors=[])
- features.json F005 acceptance 同步, Reviewer round 2 staging 数据完全满足修订后 acceptance
- L1: lint 0 errors / 3 warnings, tsc clean, npm test 189 files / 1375 tests
- Prod 只读 SQL 复核仍通过: `engagement_rate>999.99=15` / `outlier=true=157` / `audit_log.kol.import_failed=0` / `created_at > 2026-05-26T16:37Z = 474` / `max(engagement_rate)=9137.06`
- F004 报告: docs/test-reports/BL-076-backfill-2026-05-27.md
- Reviewer round 3 按修订 spec 即可 signoff
## ✅ BL-075-kol-data-coverage DONE (7/7, fix_rounds=1) — signoff 完成
- Codex Reviewer 终签 PASS：L1 通过 `npm run lint` = 0 errors / 3 warnings、`npx tsc --noEmit` PASS、`npm test` = 188 files / 1368 tests PASS、backfill dry-run 输出格式正常、environment action 清单仍含 `kol-country-enrichment`
- prod `/api/health` 已返回 `kol_coverage` 真数字：`total_active_kols=1397`、`country_fill_rate=20.4%`、`language_fill_rate=45.5%`
- staging `/zh/match` 已显示 coverage hint（`地区 已覆盖 68%`、`语言 已覆盖 1%`），`?regions=US` 返回 1,594 结果且首屏有明确 `US` KOL 卡片
- backfill 准确率证据采用 `docs/test-reports/BL-075-backfill-2026-05-26.md`：30-row 抽样 0 obvious false-positive 国家误标
- fix-round 1 blocker 已关闭：staging `AI_DAILY_COST_USD_PER_TENANT_MAX=500 npx tsx scripts/kol-sync-daily.ts --enrichment-limit=10` 真实进入 enrichment stage；我的复跑结果为 `scanned=10 / lang+=2 / country+=2 / llm_calls=3 / failed=0`
- residual risk：`discover-import[apify-kol] numeric field overflow` 仍存在，但与 BL-075 enrichment-stage / coverage 链路解耦，记为独立 hotfix 候选，不阻断 done
- signoff: `docs/test-reports/BL-075-signoff-2026-05-27.md`
## ✅ BL-074-ia-v2 DONE (6/6, fix_rounds=0, tag bl074-done @ 6bc881d) — 5 路由 IA 加 Campaigns nav + ADR-015 完成并终签
- Codex Reviewer 终签 PASS：L1 通过 `npm run lint` = 0 errors / 3 warnings、`npx tsc --noEmit` PASS、本地 Playwright `sidebar-nav-5-routes` = 5 passed / 29 skipped
- 静态验收通过：`NAV_ITEMS` 为 5 条且顺序 `brief → campaigns → match → reach → insight`；`messages/zh.json` 含 `nav.campaigns=活动`；ADR-015 存在且 167 LOC；ADR-013 superseded marker 与 ADR README 索引同步
- staging 抽样通过：zh 5-nav 顺序正确；`/en/campaigns` 与 `/en/campaigns/[id]` 都高亮 Campaigns；campaign row Match CTA 存在且跳 `/en/match?campaignId=...`
- `/en/insight` QuickActions 已收敛为 3 个按钮，链接分别为 `/brief?tab=products`、`/match`、`/match?view=table`
- signoff: `docs/test-reports/BL-074-signoff-2026-05-26.md`
- BL-075 (data coverage) backlog 可继续，不再依赖 BL-074
## ✅ BL-073-prod-hotfix DONE (8/8, fix_rounds=2, tag bl073-done @ 433047d) — 3 prod hotfix + 防御升级 + filter UX 完成并终签
- Codex Reviewer 终签 PASS：stable `dimensionId` testid 复验确认 staging `/zh/match` 只有 `chip-group-no-data-monetization` 存在；`region/category/platform/language` 的 no-data hooks 都不存在，language 输入保持启用，符合 coverage>0 行为
- F007 保持通过：temp copy 把 `grid_view` 改成 `unknown_icon` 后，`tests/unit/material-symbols-coverage-unit.test.ts` 明确 FAIL，STRICT_MS_ICONS 拦截能力真实成立
- L1 通过：`npm run lint` = 0 errors / 3 warnings；`npx tsc --noEmit` PASS；targeted vitest 10/10 PASS
- staging 抽样通过：`/zh/match` 默认 20 cards；no-data 只落在 monetization 维度，不再存在 region 误读
- signoff: `docs/test-reports/BL-073-signoff-2026-05-26.md`
## ✅ BL-072-prod-hotfix DONE (8/8, fix_rounds=1, tag bl072-done @ bc24e09) — 4 prod hotfix + CI 防御三件套完成并终签
- Codex Reviewer 5/26 复验 PASS：唯一 blocker（/insight unused warning）已修；`npm run lint` 回到 0 errors / 3 warnings；signoff 已落 `docs/test-reports/BL-072-signoff-2026-05-26.md`
- L1 通过：lint 3 warnings soft-watch / `npx tsc --noEmit` PASS；上轮已验证 `npm test` 185 files 1322 tests PASS、stale path grep 0、subset regen 含 `table_rows`、zh insight keys 完整
- L2 复验通过：staging healthy；/zh/insight heading=Insight + 中文 subtitle/tabs、/match 两态 icon、/brief≈/insight 宽度均 1136px，无回归
- 4 个 prod-facing 问题已在 staging 验证通过；当前仅余 3 个历史 unused-style warning 记为 soft-watch，不阻断 done
## ✅ BL-071 DONE (10/10, fix_rounds=1, tag bl071-done @ 99c43fc) — framework v0.9.23 闭环
- 12 决策点 D1-D12 全 lock 实施; 11 项结构变更 + 31 条 sediment inline-merge + 0 chronological-append
- 关联: framework/CHANGELOG.md v0.9.23 + framework/archive/proposed-learnings-archive-v0.9.23.md
- 0 行业务代码改动 / signoff: docs/test-reports/BL-071-signoff-2026-05-26.md
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 完整完成 + 对外上线 ready
## ✅ BL-069 DONE（7/7）/ BL-068 DONE（7/7）/ BL-067 DONE（7/7）/ BL-066 DONE（9/9, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / 5/26 ADR-015 supersedes ADR-013 (5 路由 IA)
- 5/25 BL-071 12 决策点 D1-D12 全 lock (D7 inline-merge 强制规则首次大规模应用)
- 5/26 BL-072/073/074/075 全 done (4 P1 prod hotfix 批次连续 + 5 路由 IA + KOL data coverage)
- 5/26 prod deploy 至 c428797 完成 (含 BL-071/072/073/074/075 全部 fix)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops:** 24h 后跑 `ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'` + 邀 ≥5 marketer dogfood; 全过则 signoff §4 #9/#10 DEFERRED→PASS
4. prod 实测验证 5/27 BL-073/074/075 fix 用户体验是否符合预期 (5 路由 IA / Material Symbols / i18n / filter UX / kol_coverage)
## 角色 / Backlog (BL-075 done 后)
- ★ **v0.9.24 framework sediment batch (13 条积压: BL-072 4 + BL-073 5 + BL-075 4)** — 类似 BL-071 模式起 batch 落 framework/harness/*.md inline-merge
- BL-076 apify-kol discover-import numeric field overflow hotfix (medium, BL-075 residual risk)
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
- BL-054 (medium) flaky network test isolate / BL-048 (low) valueScore 公式区分度优化
