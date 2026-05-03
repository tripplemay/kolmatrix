---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔄 BL-030 KB → Asset 数据通路完整迁移 — VERIFYING（首轮 Reviewer 待签）2026-05-04
- 5/5 features 完成；3 commits / 2 CI green：9598f4d (F001+F002 +871/-211) / fa27160 (F003+F004 +778) / bdab910 (F005 docs +201)
- 主分支 HEAD: bdab910；staging git_sha=bdab910 == main HEAD ✅；CI 25287609279 (fa27160) 8/8 / 25287187148 (9598f4d) 8/8
- F001 generateAiAssets 重写 写 5 Asset 行 + 缩水 aiAssets + 5 logAudit；F002 loadProductAssetCounts + KB UI 切数据源；F003 backfill dry-run+idempotent；F004 39 unit case；F005 deploy-checklist.md（prod 5 product id + rollback）
- 等用户驱动 prod cutover（合并 BL-027 icon hotfix 已发布）；deploy-checklist.md 6 步：pg_dump → Actions Deploy → dry-run → --execute → 浏览器三验 → 幂等重跑
- 3 实装 vs spec 文字差异已记录非 deviation：(1) EmailContentSchema 强制 locale+variables 补齐 (2) /assets/{id} 路由不存在改链 productId 过滤 (3) F001+F002 必须合提交 tsc 强耦合
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
- 7/7 PASS；prod redeploy 已落 (Deploy run 25281827818 @ 14:29) — icon bug 上线修复 ✅
## ✅ BL-025 素材中心 / BL-026 Asset UX Redesign — DONE 2026-05-03（ADR-011/012 lock 不动）
## ✅ Framework v0.9.6 / v0.9.7 — DONE（v0.9.8 候选 BL-030 done 后由 Planner 处理）
## 用户手工待办（按优先级）
1. **BL-030 done 后 prod cutover（高，KB-Asset 通路修复 + 历史数据 backfill）** — 见 docs/specs/BL-030-deploy-checklist.md §Prod cutover：pg_dump backup → GitHub Actions Deploy → ssh prod 跑 dry-run → --execute → 浏览器三验（KB chip / /assets 行 / composer 选 product 见 3 email） → 幂等重跑
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-030 D1-D5：published / 语义化命名 / aiAssets 缩水保留 status / 独立 backfill / 顺带修 audit
- BL-025 ADR-011 / BL-026 ADR-012 / BL-027 四层守门 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023/024 medium / 余 deferred
- 时间线：05-04 BL-030 verifying → done → prod cutover → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
