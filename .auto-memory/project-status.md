---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-040 Q5 Product targetAudience 字段改 required — BUILDING（spec lock @ 2026-05-06 09:00）
- 1/1 全 generator pending：F001 DB + 全栈类型清理（migration BACKFILL+SET NOT NULL + schema.prisma 去? + 5 处 TS type signature + 2 处 actions.ts ?? null + generateAiAssets.ts:175 ?? 'Not specified' fallback 删 + UI ?? 保留 defense-in-depth + 1 个新集成测试 ≥2 case）
- prod 5 行已自然填好 targetAudience（128-151 chars 高质量内容），migration BACKFILL 是 staging/local 防御，无 prod 数据回退风险
- spec：docs/specs/BL-040-product-target-audience-required-spec.md（D1-D5 决策 + §5 v0.9.11/v0.9.12/v0.9.13 dogfood + §6.1 2 项 user 手工待办 + §7 实装顺序 9 步）
- 来源：docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §5 D1 + docs/product/MVP-gap-audit-2026-04-30.md P0 §3.3
- 预估 1.5h building + 0.5h verifying（很短）
- v0.9.14 候选已写入 framework/proposed-learnings.md（done 阶段交用户决议）
## 关闭（audit 过期 retroactive done）
- **BL-041 Dashboard 3 元素** — 已 done by MVP-internal-demo-prep-F001 commit 4fd778b @ 2026-05-01；audit @ 2026-05-04 起草时 oversight；3 组件 + recharts + 5 locale i18n + visual baseline 全齐；2026-05-06 实地核查发现已直接从 backlog 移除
## ✅ BL-024 + Framework v0.9.13 + BL-024 F007 retroactive + prod redeploy 大合并 — DONE 2026-05-06 ~08:00（CRIT-1 retroactive 完整闭环 @ 8be3115）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. ~~prod redeploy 大合并 + KOLMATRIX_APP_PASSWORD 落地~~ ✅ DONE by Planner ops 2026-05-06 ~08:00
1.5. ~~aigcgateway UI 设 6 Action max_tokens~~ ❌ CANCELED 2026-05-06（aigcgateway Action 抽象层不绑定；治理入 BL-042 post-MVP）
2. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**（被动 — 满后下次 prod redeploy 时一并触发）
3. **BL-035 F005/F008/F013 + F006 prod 真测**：第 2 tenant 启用 + outreach composer ≥9 KOL + aigcgateway logs 抽样 + 测试邮件 hard bounce
4. **BL-034 F005 cost-cap event_log staging 实测**（继承）+ **Pokemon Go v1 prod 浏览器验证**（继承）
5. **BL-024 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-024 SW-1 visual baseline tracking-list/suppression-list.png + BL-034 unused import 顺手清
6. **BL-040 done 后 prod 浏览器创建 Product 不填 targetAudience 验证（被前后端双校验拒）+ KB AI 生成 prompt 不含 'Not specified'**
## 关键决议（已 lock）
- BL-040 D1-D5 + 用户 2026-05-06 09:00 决议（BL-041 audit 过期关闭，BL-040 单独 mini-batch）
- v0.9.14 候选「audit 起草前必须 grep 实物状态」入 proposed-learnings（v0.9.9 铁律 1 反向应用 + v0.9.13 §5.1 同根问题延伸）
- BL-035 / BL-034 / BL-020 / BL-024 / v0.9.11~v0.9.13 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（剩 BL-042 actions/run max_tokens 治理 post-MVP / BL-012 crawler-sync / BL-021 Suspense 边界 / BL-022 列表虚拟化 / BL-014/15/16 post-MVP / 其它 deferred）
- 时间线：05-06 BL-040 building（~2h） → 05-06~07 用户业务测继承待办 #2-#6 → 05-08~10 buffer / BL-021 评估 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
