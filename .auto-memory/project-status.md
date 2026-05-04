---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-032 KB AI prompt placeholder 标准化 + 历史数据 backfill — VERIFYING 2026-05-04 @ cc1658d
- 3/3 features Generator done: F001 prompt + 11/11 unit test (e265d6b) / F002 backfill 脚本 + 7/7 unit test (cc1658d) / F003 staging deploy + dry-run + handoff
- staging git_sha=cc1658d 与 main HEAD 一致；dry-run 0 candidates（staging 干净 DB；prod 15 行待部署后 backfill）
- 等 Reviewer L1+L2：L1 单测复跑 + 代码审查；L2 staging 创建新 product 触发 Generate AI assets 验证 prompt 修生效（新 email content 含 mustache token）
- spec docs/specs/BL-032-ai-prompt-token-fix-and-backfill-spec.md
- 角色冲突仲裁（C 方案）：./generator.md 矩阵化（commit 1bef058）— 单元/集成 Generator 写 + Evaluator 跑；E2E/压测/审计 = Evaluator 全程
## ✅ BL-031 Composer locale + product filter + backfill RLS — DONE 2026-05-04（首轮 PASS @ c1405c7）
- prod 已 redeploy d23ef70；用户 send test 验证 FK 不撞但暴露 placeholder bug → BL-032
- 4 framework v0.9.9 候选 + 1 BL-030 SQL ops 反思 + 1 BL-032 prompt 约束 — 合并待 BL-032 done 处理
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 — DONE
## 用户手工待办（按优先级）
1. **BL-032 done — prod redeploy + SSH 跑 backfill 转换 15 行 + 浏览器 send test 验证 KOL 实名替换** — 详见 spec §5 部署顺序
2. v0.9.9 框架沉淀 6 项（合并 BL-031+BL-030+BL-032 来源；BL-032 done 后由 Planner 提案确认）
3. ~2026-05-09 BIx F004 staging YouTube sync 走查
4. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-032 D1-D4：prompt 强制 mustache + 禁用 []；backfill 走 updateAsset mutation；[DATE] Soft-watch；多语种 prompt 留长期
- BL-031/BL-030/BL-025/BL-026/BL-027 / v0.9.6-v0.9.8 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条 + v0.9.9 候选 6 项
- 时间线：05-04 BL-032 → 05-04~05 redeploy + backfill → v0.9.9 沉淀 → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
