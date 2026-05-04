---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-032 KB AI prompt placeholder 标准化 + 历史数据 backfill — DONE 2026-05-04（首轮 PASS @ cc1658d）
- 3/3 features 全 PASS：F001 prompt 加 D1 段落 + 11/11 unit test（e265d6b）/ F002 backfill 脚本 + 7/7 unit test（cc1658d）/ F003 staging deploy + handoff
- L1: lint 0 / tsc 0 / 全套 810/810 全绿 / CI 双绿；L2 staging 创建 test product → 真实 aigcgateway 12.8s 调用 → 5/5 新 assets 全 mustache，0 bracket 残留（emails 各 8/8/6 mustache）✓ dualWrite 3 mirror + 5 audit ✓ Cleanup 完整回归 baseline
- spec docs/specs/BL-032-...-spec.md / signoff docs/test-reports/BL-032-...-signoff-2026-05-04.md
- Soft-watch 3 项：S1 [DATE] token 留字面待迷你批次 / S2 AI prompt 不确定性需 server-side validation 兜底（v0.9.9） / S3 dualWriteOnUpdate updateMany silent count=0
- 角色冲突仲裁（C 方案）：./generator.md 矩阵化（1bef058）锁
- 待用户：prod redeploy + SSH 跑 backfill 转 15 行 + 浏览器 send test 验证 KOL 实名替换（spec §5）
## ✅ BL-031 Composer locale + product filter + backfill RLS — DONE 2026-05-04（首轮 PASS @ c1405c7）
- prod 已 redeploy d23ef70；用户 send test 验证 FK 不撞但暴露 placeholder bug → 已由 BL-032 修
- 4 framework v0.9.9 候选 + 1 BL-030 SQL ops 反思 — 合并入 v0.9.9 沉淀
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 — DONE
## 用户手工待办（按优先级）
1. **BL-032 prod redeploy（高，cc1658d）+ SSH 跑 backfill 转 15 行 + 浏览器 send test 验证 KOL 实名替换** — 详见 spec §5 部署顺序
2. v0.9.9 框架沉淀 8+ 项（合并 BL-031+BL-030+BL-032 来源 + BL-032 新增 silent-failure mode + L2 实录模板节；BL-032 done 后由 Planner 提案确认）
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
