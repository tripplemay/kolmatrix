---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-044 /discovery AI Semantic Search — BUILDING（spec lock @ 2026-05-06 12:50；切 building @ 16:10）
- 4/4 全 generator pending：F001 runSemanticKolSearch server module（fork from B7a SmartMatch 范式 ~150 行）/ F002 UI integration SearchBar chip URL 改 ?ai= + page.tsx 解析 + ActiveFilters 加 AI chip / F003 性能优化（5 locale × 3 chip embedding cache）+ 失败兜底（5xx fallback ILIKE + ENABLE_AI_SEARCH env flag）/ F004 测试 + 监控（≥4 单测 + ≥2 集成 + event_log type='ai.usage' source='semantic_search'）
- spec：docs/specs/BL-044-discovery-ai-semantic-search-spec.md（D1-D7 + §1.2 Quality 实测 PASS + §5 v0.9.11/v0.9.12/v0.9.13/v0.9.14 dogfood + §6.1 2 项 user 手工待办 + §7 11 步实装顺序）
- Quality gate 实测 PASS @ 2026-05-06 12:10：bge-m3 multilingual 4 query 100% 命中（中/英/日/韩文 KOL 跨语言；cosine 0.37-0.46）；total cost $0.00000188；无 quality 风险
- 实装基础 99% 就绪：B7a embedding pipeline + SmartMatch fork 范式 + prod KOL.embedding 99.5% (2430/2442) + BL-035 F003 rate-limit + BL-034 F005 cost-cap MVP 自动覆盖
- 预估 1-2 day building + 0.5 day verifying
## ✅ Framework v0.9.14 — DONE 2026-05-06 ~16:00（BL-040 + BL-041 audit 过期 + BL-043 staging fix 沉淀，2 条 learnings 全 Accept）
- planner.md 铁律 1 矩阵 +2 行（v0.9.9 反向延伸到 audit/spec/review；完整 pattern 模式 grep）+ deploy-patterns.md §1.7（v0.9.7 §1.6 范围扩展，不限 env_file）；归档 framework/archive/proposed-learnings-archive-v0.9.14.md
## ✅ BL-040 done @ 2026-05-06 ~16:00（first-round PASS @ 37d4a8c，fix_rounds=0，0 PARTIAL/FAIL；Codex 完整 L2 staging walk PASS）
- signoff: docs/test-reports/BL-040-product-target-audience-required-signoff-2026-05-06.md（staging .env.staging 修复 by Planner ops 后 Codex 重做 L2）
## ✅ BL-024 + Framework v0.9.13 + BL-024 F007 retroactive + prod redeploy 大合并 — DONE 2026-05-06 ~08:00（CRIT-1 retroactive 完整闭环 @ 8be3115）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. ~~prod redeploy 大合并 + KOLMATRIX_APP_PASSWORD 落地~~ ✅ DONE by Planner ops 2026-05-06 ~08:00
1.5. ~~aigcgateway UI 设 6 Action max_tokens~~ ❌ CANCELED 2026-05-06（Action 抽象层不绑定；治理入 BL-042 post-MVP）
2. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** + **BL-035 F005/F008/F013/F006 prod 真测**（依赖 prod redeploy 完成）
3. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go v1 prod 浏览器验证**（继承）
4. **BL-024 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-024 SW-1 visual baseline + BL-034 unused import 顺手清
5. **BL-040 prod 浏览器创建 Product 不填 targetAudience 验证**（已 staging PASS，prod 等下次 redeploy）
6. **BL-044 done 后 prod 浏览器 chip click + 自由文本测试**（spec §6.1）
## 关键决议（已 lock）
- 用户 2026-05-06 16:00 4 决议：dead code A 入 backlog / v0.9.14 #1+#2 全 Accept / 下批次 B 直接 BL-044
- v0.9.14 + v0.9.13 + BL-040~BL-024 + v0.9.11~v0.9.12 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 19 条（剩 BL-043 staging gap 长期闭合 medium / BL-045 dead code 清理 deferred / BL-042 max_tokens / BL-021 / BL-022 / BL-012 / BL-014~17/19/23/25-27 等 deferred）
- 时间线：05-06 BL-044 building（1-2 day）→ 05-07~08 用户业务测继承待办 #2-#5 → 05-09~10 buffer / BL-021 评估 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
