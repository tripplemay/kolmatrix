---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-044 /discovery AI Semantic Search — BUILDING（spec lock @ 12:50 + Pre-impl 裁决 lock @ 16:30；0/4 generator pending；预估 1-2 day building + 0.5 day verifying）
- 4 features：F001 runSemanticKolSearch（fork SmartMatch + inline cosine SQL + is_suspicious filter + 模块顶部 rateLimitAi + cost-cap 仅 free text）/ F002 UI（SearchBar ?ai= + parseFilters 互斥 + ActiveFilters chip + fallback banner + Soft override sidebar + SummaryBar aiActive + SaveSearch 传统语义）/ F003 chip cache 100% + ENABLE_AI_SEARCH flag + server fall-through 不重定向 / F004 tests/unit/ ≥4 + 集成 ≥2 + recordAiUsage 扩 extras
- spec：docs/specs/BL-044-discovery-ai-semantic-search-spec.md（7+ 处修订 lock @ 16:30）+ audit：docs/specs/BL-044-pre-impl-audit.md（11+1 决议 + Planner §9-§11 全 Accept）；短格式 `#1:B #2:B #3:A #4:B #5:A #6:C #7:C #8:C #9:A #10:B #11:A #12:B(+banner)`
- Quality gate 实测 PASS @ 12:10：bge-m3 4 query 100% 命中（中/英/日/韩跨语言；cosine 0.37-0.46）；total cost $0.00000188；无 quality 风险
- 实装基础 99% 就绪：B7a embedding pipeline + SmartMatch fork 范式 + prod KOL.embedding 99.5% (2430/2442) + BL-035 F003 rate-limit + BL-034 F005 cost-cap MVP
## ✅ DONE 历史：v0.9.14 sediment（Generator Kimi pre-impl grep dogfood 发现 11 跨源差异完美）/ BL-040 @ 16:00 / BL-024 + v0.9.13 + prod redeploy 大合并 @ 08:00 / BL-035 / BL-034 / v0.9.12 / BL-020 / v0.9.11 / BL-033~BL-026
## 用户手工待办（按优先级）
1. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** + **BL-035 F005/F008/F013/F006 prod 真测**
2. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go v1 prod 浏览器验证**
3. **BL-024 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-024 SW-1 visual baseline + BL-034 unused import 顺手清
4. **BL-040 prod 浏览器创建 Product 不填 targetAudience 验证**（已 staging PASS，prod 等下次 redeploy）
5. **BL-044 done 后 prod 浏览器 chip click + 自由文本 + fallback banner + ENABLE_AI_SEARCH=false 验证**（spec §6.1）
## 关键决议（已 lock）
- 2026-05-06 16:30：BL-044 pre-impl 12 决议「A 全 Accept」— spec 7 处修订 + audit §9-§11 + Generator 开工授权
- 2026-05-06 16:00：dead code A backlog / v0.9.14 #1+#2 Accept / BL-044 启动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（无 high；medium 3：BL-021 Suspense / BL-023 valueScore / BL-043 staging gap；low 6：BL-011/014/015/017/018/027；deferred 8：BL-003/012/016/019/022/026/042/045）— 2026-05-06 16:45 移除 BL-020+BL-025 stale 条目（已 done 漏 splice 追溯清）
- 时间线：05-06 BL-044 building（1-2 day）→ 05-07~08 用户业务测继承待办 #1-#4 → 05-09~10 buffer → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
