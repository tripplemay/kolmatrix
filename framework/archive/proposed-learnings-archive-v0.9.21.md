# v0.9.21 archive — 2026-05-14 沉淀（BL-064 + BL-065 全 4 条 learnings）

来源批次：
- BL-064 fix-round 3（IA refactor 7→4 路由 / embed-old-components redirect scope wire-readiness）
- BL-065-R1（/admin/kol-csv-import next-intl FORMATTING_ERROR latent bug）
- BL-065-F006（大型 atomic delete commit + CI 多轮自修预期 + Checkbox E2E selector + UUID guard）
- BL-065-F007 fix-rounds=1（latent vs 新引入区分 + Reviewer role-gate probe 价值）

---

## [2026-05-11] — BL-064 IA refactor redirect scope wire-readiness

**类型：** 新规律 / 模板修订

**事实链：** 见 framework/harness/generator.md §9 + planner.md role-context.

**沉淀位置：**
- `framework/harness/generator.md` §9 "IA refactor / route migration redirect scope wire-readiness 评估"（新增段，~25 行）
- `.auto-memory/role-context/generator.md` §"IA refactor redirect scope 评估"（短摘要）
- `.auto-memory/role-context/planner.md` §"IA refactor 类批次 redirect 清单"（spec 起草前置 checklist）

**状态：** 已沉淀

---

## [2026-05-13] — BL-065-R1 next-intl `.raw()` vs ICU template route migration audit

**类型：** 新规律 / 新坑

**事实链：** ImportCsvDialog 用 client-side `String.replace("{imported}", …)` 替换占位符（字面 token 非 ICU），但 server 端 `tImport("successTemplate")` 走 next-intl ICU 格式器，看到未绑定 `{imported}` 即抛 FORMATTING_ERROR。老 /database 被 302 redirect 掩盖 6 个月，F003 挪到 /admin/kol-csv-import（真实渲染）暴露。Fix: `tImport.raw(key)` + `page-i18n-fidelity.test.ts` 回归守门。

**沉淀位置：**
- `framework/harness/planner.md` 铁律 1 矩阵 +1 行（v0.9.21）— i18n template 在 server 组件 + 路由迁移核查
- `.auto-memory/role-context/generator.md` §"i18n template 使用约定"（短摘要）

**状态：** 已沉淀

---

## [2026-05-13] — BL-065-F006 大型 atomic delete commit + CI 多轮自修预期

**类型：** 新规律 / 模板修订（删除批次 / page consolidation / IA refactor 不可逆删除阶段）

**事实链：** 单 commit ad76eb1 净 -4658 lines（64 files / +1466 / -6124）含 7 文件 git mv + 29 文件物理删 + i18n 完整化 + e2e 迁移。本地 L1 全绿即推送，CI 3 轮自修才全绿（woff2 / edge-states / visual-baselines / UUID guard / Checkbox locator）。

**沉淀位置：**
- `framework/harness/generator.md` §10 "大型删除批次执行模板"（新增段，~40 行：本地 L1 ≠ CI / 预扫清单 / Checkbox 选择器 / UUID guard / atomic vs sub-commit）
- `.auto-memory/role-context/generator.md` §"删除文件类批次的 CI 多轮自修预期"（短摘要）

**状态：** 已沉淀

---

## [2026-05-13] — BL-065 fix-rounds=1 latent vs 新引入区分 + Reviewer role-gate probe 价值

**类型：** 新规律

**事实链：** BL-065 7 features Generator 自测 + CI 全程 0 fix-round；fix-round=1 来自 Reviewer L1 admin role 手动 probe 发现 BL-065-R1（FORMATTING_ERROR），是 F003 路由迁移暴露 BL-024 时代 latent bug。CI 全绿 + audit script PASS 都没抓到（server console error 不影响 HTTP 状态码）。

**沉淀位置：**
- `framework/harness/evaluator.md` §20 "L1 + 角色门禁手动探针"（新增段，~30 行：手动 probe 步骤 + 典型抓住问题 + 反模式 + BL-065-R1 案例）
- `framework/harness/planner.md` §"fix-rounds 数解读"（新段：latent vs 新引入区分 + 二维统计）
- `.auto-memory/role-context/evaluator.md` §"L1 + 角色门禁手动探针"（短摘要）
- `.auto-memory/role-context/planner.md` §"fix-rounds 数解读"（短摘要）

**状态：** 已沉淀
