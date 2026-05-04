---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-031 Composer locale + product filter + backfill RLS hotfix — VERIFYING 2026-05-04
- 触发：BL-030 部署 + backfill done 后用户报 prod /zh/outreach 选 PUBG Mobile campaign 模板列表只见系统模板
- 4 features 全 done @ c1405c7：F001 locale OR 切分 / F002 productFilter 自动同步 (useProductFilter hook) / F003 scanProducts per-tenant + ::uuid cast 修 + database-patterns.md §4 / F004 handoff
- staging git_sha c1405c7 ✓ + scanProducts dry-run 3 product / 9+6 assets / 0 fails ✓
- Bug B 已 Planner 在 BL-031 启动前 SQL ops 修补 — 15 条镜像入 email_template，FK 安全
- F003 staging 二跑发现延伸 bug：existingBackfilledAsset ::uuid cast vs Product.id (cuid TEXT)，c1405c7 修。BL-030 prod 没暴露因 scanProducts 当时返 0
- spec docs/specs/BL-031-composer-locale-product-filter-hotfix-spec.md / Reviewer L1+L2 待跑
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04（5/5 + prod backfill 25 行；脚本 RLS 残留转入 BL-031-F003）
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 — DONE
## 用户手工待办（按优先级）
1. **BL-031 done — prod redeploy（高，PUBG Mobile 等 5 产品模板 prod 看不到 + send 时 FK orphan 风险已 SQL 修补）** — GitHub Actions Deploy → main → 浏览器三验：/zh/outreach 选 PUBG Mobile campaign 自动收 3 模板 / 切 product filter 全部见 15+5 / Send Test 不撞 FK
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-031 D1-D4：locale 过滤分 source / productFilter auto = selectedCampaign / scanProducts per-tenant 扫 / 新 database-patterns.md RLS 旁路矩阵
- BL-030 D1-D5 / BL-025 ADR-011 / BL-026 ADR-012 / BL-027 四层守门 / v0.9.8 铁律 4 + migration-batch-checklist — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条 + 1 候选（v0.9.9 框架沉淀：Planner ops 绕 mutation 函数副作用 checklist — 来源 BL-030 backfill 后 BL-031 暴露 FK orphan）
- 时间线：05-04 BL-031 → 05-04~05 redeploy → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
