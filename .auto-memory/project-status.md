---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-044 /discovery AI Semantic Search — VERIFYING（push @ eeeff4a + staging deploy 25431413537 全 PASS @ 2026-05-06 19:07；4/4 generator completed）
- 4/4 done：F001 runSemanticKolSearch (~280 行 fork SmartMatch + inline cosine SQL is_suspicious filter + 模块顶部 rateLimitAi + cost-cap 仅 free text + topK=50) / F002 UI (?ai/?search 互斥 + Soft override sidebar + SummaryBar aiActive sort inert + ActiveFilters AI chip + fallback banner + SaveSearch 不含 aiQuery) / F003 chip cache (KNOWN_CHIP_TEXTS 限 + registerChipTexts + preWarmChipCache + isAiSearchEnabled + .env.example) / F004 cost-cap recordAiUsage 加 extras + integration tests 4 case + i18n allowlist
- 守门：tsc 0 / lint 0（3 pre-existing warnings）/ vitest 1012/1014 PASS（仅 AiSuggestionsClient localStorage pre-existing fail 与 BL-044 无关）/ build PASS
- CI run 25430787856（eeeff4a fix-up commit lazy import db.ts boot guard）：BL-044 相关 7/7 jobs PASS（含新加 4 integration test 4071ms 全绿）；2 pre-existing fail 同 BL-040（material-symbols woff2 stale + database-fidelity export disabled）
- Staging deploy 25431413537 PASS：HEAD=eeeff4a / health 200 / db ok 19ms / redis ok 3ms / git_sha 对齐 / run_seed=false 保留 demo data
- Pre-impl audit @ 9d60dd5（11+1 决议）→ Planner @ 42cb25d 12/12 全 Accept + spec 7+ 处修订（短格式 `#1:B #2:B #3:A #4:B #5:A #6:C #7:C #8:C #9:A #10:B #11:A #12:B(+banner)`）
- Quality gate 实测 PASS @ 12:10：bge-m3 4 query 100% 命中（中/英/日/韩跨语言；cosine 0.37-0.46）；total cost $0.00000188
## ✅ Framework v0.9.14 — DONE 2026-05-06 ~16:00（BL-040 + BL-041 audit 过期 + BL-043 staging fix 沉淀，2 条 learnings 全 Accept）
## ✅ BL-040 done @ 2026-05-06 ~16:00（first-round PASS @ 37d4a8c，fix_rounds=0；signoff: docs/test-reports/BL-040-product-target-audience-required-signoff-2026-05-06.md）
## ✅ BL-024 + v0.9.13 + prod redeploy 大合并 @ 08:00 / BL-035 / BL-034 / v0.9.12 / BL-020 / v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** + **BL-035 F005/F008/F013/F006 prod 真测**
2. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go v1 prod 浏览器验证**
3. **BL-024 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-024 SW-1 visual baseline + BL-034 unused import 顺手清
4. **BL-040 prod 浏览器创建 Product 不填 targetAudience 验证**（已 staging PASS，prod 等下次 redeploy）
5. **🆕 BL-044 done 后 prod 浏览器 chip ≥10 + 自由文本 ≥1 + ENABLE_AI_SEARCH=false fallback 验证**（spec §6.1 + 1 周 cost 监控）
## 关键决议（已 lock）
- 2026-05-06 16:30：BL-044 pre-impl 12 决议「A 全 Accept」— spec 7 处修订 + audit §9-§11 + Generator 开工授权
- 2026-05-06 16:00：dead code A backlog / v0.9.14 #1+#2 Accept / BL-044 启动
- v0.9.14 + v0.9.13 + BL-040~BL-024 + v0.9.11~v0.9.12 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（medium 3：BL-021 / BL-023 / BL-043；low 6；deferred 8：BL-003/012/016/019/022/026/042/045）
- 时间线：05-06 BL-044 verifying → Reviewer L1+L2 → done → 05-07~08 继承待办 → 05-09~10 buffer → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
