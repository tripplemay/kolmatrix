---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-030 KB → Asset 数据通路完整迁移 — BUILDING 2026-05-04
- 触发：用户 prod 反馈 KB 为 Clash Royale 生成显示成功但 /assets 库 0 行；DB 验 5 产品 35 条素材流落 Product.aiAssets JSON。ADR-011 §Context 13-19 同 bug，BL-025 scope miss 未迁 KB 路径。
- 5 features 全 executor:generator F001 重写 generateAiAssets 写 Asset 表 / F002 KB UI 切数据源 / F003 backfill 脚本 / F004 测试 / F005 部署 handoff；spec docs/specs/BL-030-kb-asset-bridge-migration-spec.md
- D1-D5 全 A 锁定：Asset.status=published / 语义命名（Initial outreach/Follow-up/Signing invitation/YouTube 60s/TikTok 15s）/ Product.aiAssets 缩水保留 status / 独立 backfill 脚本 dry-run+idempotent / 顺带修 audit log（asset.generated）
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
- 7/7 PASS fix_rounds=0；signoff 2026-05-03；CI 8/8 @ 65a2b60；本机 npm test 783/783；4 visual baseline 重生
- v0.9.7 三 learnings 已沉淀（commit ec41656）：material-symbols 四层守门 + planner 铁律 3「spec ls 实物」+ signoff template §6 Soft-watch + §10 Learnings
- 5 Soft-watch 全 low/medium 不阻塞 done；S5 prod 仍 a9c4ef8 等用户 redeploy
## ✅ BL-025 素材中心 / BL-026 Asset UX Redesign — DONE 2026-05-03（ADR-011/012 lock 不动）
## ✅ Framework v0.9.6 / v0.9.7 — DONE
## 用户手工待办（按优先级）
1. **BL-030 done 后合并发布（与 BL-027 icon hotfix 一起 redeploy prod，单次操作）** — 顺序：pg_dump backup → GitHub Actions Deploy main → SSH 跑 backfill dry-run → --execute → 浏览器三验（KB chip / /assets 35 新 Asset / composer 选 product 见 3 email）
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-030 D1-D5：published / 语义化命名 / aiAssets 缩水保留 / 独立 backfill / 顺带修 audit
- BL-025 ADR-011 / BL-026 ADR-012 / BL-027 四层守门 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023/024 medium / 余 deferred
- 时间线：05-04 BL-030 → 05-04~05 redeploy → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
