---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04（首轮 Reviewer L1+L2 PASS, fix_rounds=0）
- 5/5 features PASS；CI 8/8×2 SUCCESS（25287609279 fa27160 / 25287187148 9598f4d）；lint/tsc 0 errors；39/39 unit 全绿（forks pool）
- staging git_sha=bdab910 == main HEAD；signoff: docs/test-reports/BL-030-kb-asset-bridge-migration-signoff-2026-05-04.md
- F001 generateAiAssets 重写写 5 Asset+缩水 aiAssets+5 logAudit / F002 loadProductAssetCounts+KB UI 切数据源 / F003 backfill dry-run+idempotent / F004 39 unit case / F005 deploy-checklist.md (5 prod product id+rollback)
- 4 项 Soft-watch 全 low：S1 spec §F002 路由文字错配（建议 Planner done 修订）/ S2 staging 浏览器 E2E 转 prod cutover 一并验 / S3 5×35 vs 5×5=25 数差 backfill 兼容 / S4 Product.aiAssets 字段保留 1 sprint 后清理批次
- 等用户驱动 prod cutover（BL-027 icon hotfix 已发，BL-030 hotfix 排队）；deploy-checklist.md 6 步：pg_dump → Actions Deploy → dry-run → --execute → 浏览器三验 → 幂等重跑
- Framework v0.9.8 候选 2 提案待 Planner done 阶段处理：F1 spec acceptance 路由核对 / F2 数据通路迁移批次模板三段式
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
- 7/7 PASS；prod redeploy 已落 (Deploy run 25281827818 @ 14:29) — icon bug 上线修复 ✅
## ✅ BL-025 素材中心 / BL-026 Asset UX Redesign — DONE 2026-05-03（ADR-011/012 lock 不动）
## ✅ Framework v0.9.6 / v0.9.7 — DONE（v0.9.8 候选 BL-030 done 后由 Planner 处理）
## 用户手工待办（按优先级）
1. **BL-030 done — prod cutover（高，KB-Asset 通路修复 + 历史数据 backfill）** — 见 docs/specs/BL-030-deploy-checklist.md §Prod cutover：pg_dump backup → GitHub Actions Deploy → ssh prod 跑 dry-run → --execute → 浏览器三验（KB chip / /assets 行 / composer 选 product 见 3 email） → 幂等重跑
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-030 D1-D5：published / 语义化命名 / aiAssets 缩水保留 status / 独立 backfill / 顺带修 audit
- BL-025 ADR-011 / BL-026 ADR-012 / BL-027 四层守门 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- 本会话 Reviewer 由 CLI agent johnsong 临时担任（用户开头明确指派完成 Codex 工作）
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023/024 medium / 余 deferred
- 时间线：05-04 BL-030 done → prod cutover → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
