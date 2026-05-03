---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04（含 prod backfill 执行 + framework v0.9.8 沉淀）
- 5/5 features Reviewer 首轮 PASS（fix_rounds=0）；CI 8/8×2 SUCCESS；39/39 unit；signoff 2026-05-04
- Prod 已 redeploy（sha e94a661，含 BL-030 新写路径 + BL-027 icon 修复）；Planner 跑 backfill 25 行入库（15 emails + 10 videos × 5 product 完成；Product.aiAssets 缩水保留 status；Pokemon Go 4 emails 因含 1 条预存 ai_generated）
- Framework v0.9.8 沉淀（commit 待推）：planner.md 铁律 4「spec 引用应用路由前必须 grep 实物」+ 新建 framework/templates/migration-batch-checklist.md（数据通路迁移批次模板五段式）
- BL-030 spec §F002 路由文字（/assets/{id} → /assets?productId=X）已修订；signoff 4 项 Soft-watch 中 S1 闭环、S2-S4 不阻塞
- **遗留：** F003 backfill 脚本 `withPlatformAdmin` bug（product 表 RLS 不认 platform admin，需改 per-tenant 扫）— Planner 已用 SQL 绕过完成 prod；提案入 `framework/proposed-learnings.md` 待下一 done 阶段或独立 hotfix 批次修
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
- 7/7 PASS；prod redeploy 已落 (Deploy run 25281827818) — icon bug 修复 ✅
## ✅ BL-025 素材中心 / BL-026 Asset UX Redesign — DONE 2026-05-03（ADR-011/012 lock 不动）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 — DONE
## 用户手工待办（按优先级）
1. **浏览器三验 prod**（KB chip 见 3+2 / /assets 见 25 新行 / composer 选 Clash Royale 见 3 email）— prod 数据已落，仅需用户人眼确认 UX
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-030 D1-D5：published / 语义化命名 / aiAssets 缩水保留 status / 独立 backfill / 顺带修 audit
- BL-025 ADR-011 / BL-026 ADR-012 / BL-027 四层守门 / v0.9.8 铁律 4 + migration-batch-checklist — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条 + 1 新候选（BL-031 backfill 脚本 RLS 修 + database-patterns.md 新建）
- 时间线：05-04 BL-030 done → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
