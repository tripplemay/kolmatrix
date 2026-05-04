---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-031 Composer locale + product filter + backfill RLS hotfix — DONE 2026-05-04（Reviewer first-round PASS @ c1405c7）
- 4 features 全 PASS：F001 locale OR / F002 productFilter hook / F003 per-tenant + ::uuid cast 修 + database-patterns.md §4 / F004 handoff
- L1: lint 0 / tsc 0 / 802 测试全绿 / CI 双绿；L2 staging: F001 SQL 等价验证 (AFTER_zh=6 vs BEFORE_zh=5) / 真实 Send Test sent=1（providerMessageId 38c8fbc7-...，tripplezhou@gmail.com 收件）/ FK 不撞
- Bug B 同源 staging 1 行 orphan asset 已 Reviewer SQL ops 镜像（用户 C1b 破例授权代办 Planner ops）— 与 prod 15 行处理一致
- Soft-watch 3 项（详见 signoff）：S1 F002 hook userTouched vs page.tsx key 重挂载并存 / S2 dualWrite/send 路径 id 翻译不对称（系统性，入 backlog）/ S3 staging email_log+1 副作用（演示前重置）
- Framework learnings 4 项（done 阶段处理）：跨表迁移 id 翻译沉淀 / mock-only test 不抓 schema 类型不匹配 / Reviewer 越界 ops 框架澄清 / signoff 模板加 L2+ops 副作用节
- spec docs/specs/BL-031-...-spec.md / signoff docs/test-reports/BL-031-...-signoff-2026-05-04.md
- 待用户：GitHub Actions Deploy → main + prod 浏览器三验（spec §6 step 3）
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
