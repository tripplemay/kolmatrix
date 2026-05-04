---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-032 KB AI prompt placeholder 标准化 + 历史数据 backfill — DONE 2026-05-04（首轮 PASS @ cc1658d；prod backfill 完成 @ c0b3782）
- 3/3 features 全 PASS（首轮 fix_rounds=0）；L1 0e/0w/810 测试 + CI 双绿；L2 staging 真实 aigcgateway 12.8s 调用 → 5/5 mustache 0 bracket
- **Prod backfill 已 Planner 跑（2026-05-04，走 updateAsset mutation 路径）：** Asset email bracket 15 → 0 / mustache 1 → 16；email_template mirror 2 → 17（dualWriteOnUpdate 自动跑 +15）；PUBG Mobile 等 5 产品 15 行素材正文 KOL/marketer placeholder 全部替换。**v0.9.9 铁律 5 第一次按规矩跑数据迁移验证有效**
- Framework v0.9.9 已沉淀（commit 63af328）：8 条 learnings 来源 BL-030/031/032 三批合并，含 planner.md 铁律 5/6/7 + database-patterns §5/6/7 + generator.md 测试矩阵 + ai-action-contract §3 + signoff template §L2/Ops 节
- 角色冲突仲裁（C 方案）：./generator.md 矩阵化（1bef058）+ framework/harness/generator.md 同步矩阵化（63af328）锁
- spec docs/specs/BL-032-...-spec.md / signoff docs/test-reports/BL-032-...-signoff-2026-05-04.md
- Soft-watch 3 项剩 2：S1 [DATE] token 待迷你批次 / S3 dualWriteOnUpdate silent count（已沉淀 database-patterns §6，长期 v1.0 改返 count）；S2 已并入 ai-action-contract §3 + 仍待迷你批次落 server-side validation
- 待用户：浏览器 send test 验证 KOL 实名替换（数据已落，仅 UX 确认）
## ✅ BL-031 Composer locale + product filter + backfill RLS — DONE 2026-05-04（首轮 PASS @ c1405c7）
- prod 已 redeploy d23ef70；用户 send test 验证 FK 不撞但暴露 placeholder bug → 已由 BL-032 修
- 4 framework v0.9.9 候选 + 1 BL-030 SQL ops 反思 — 合并入 v0.9.9 沉淀
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 — DONE
## 用户手工待办（按优先级）
1. **浏览器 prod send test 验证 KOL 实名替换**（数据已落 backfill 已跑，仅最后一步 UX 确认）— /zh/outreach 选 PUBG Mobile campaign → Send Test → 收件箱见 Hi <KOL名>
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-032 D1-D4：prompt 强制 mustache + 禁用 []；backfill 走 updateAsset mutation；[DATE] Soft-watch；多语种 prompt 留长期
- BL-031/BL-030/BL-025/BL-026/BL-027 / v0.9.6-v0.9.9 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条 + v0.9.9 已沉淀 8 条；剩 Soft-watch S1+S2 待迷你批次（[DATE] token 加入 + AI 输出 server-side validation）
- 时间线：05-04 BL-030+BL-031+BL-032+v0.9.9 全 done → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
