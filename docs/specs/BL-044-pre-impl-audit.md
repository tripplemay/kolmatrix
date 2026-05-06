 # BL-044 /discovery AI Semantic Search · Pre-Impl 审计请求

> **发起者：** Generator Kimi (cli)
> **日期：** 2026-05-06
> **触发：** BL-044 building 启动前审计，按 `framework/harness/pre-impl-adjudication.md` §1-§10 工作范式
> **状态：** 等待 Planner 明确回复，**未收到前不开工**
> **相关文档：**
>   - spec: `docs/specs/BL-044-discovery-ai-semantic-search-spec.md`（Planner johnsong @ 2026-05-06 12:50 lock）
>   - 范式 source: `src/lib/discovery/smart-match.ts`
>   - 调用链：`src/lib/embedding/{client,sql,types}.ts`、`src/lib/ai/cost-cap.ts`、`src/lib/rate-limit-ai.ts`、`src/lib/events/log.ts`
>   - 影响 UI: `src/app/[locale]/(app)/discovery/{page,SearchBar,ActiveFilters,SummaryBar,search}.{ts,tsx}` + `src/lib/kol/filters.ts`

---

## 1. 背景 & 目标

实装 BL-044 4 个 generator features：F001 `runSemanticKolSearch` server module（fork from B7a-F002 SmartMatch）/ F002 UI integration / F003 性能 + 失败兜底 / F004 测试 + 监控。Spec lock @ 12:50；Quality gate 实测已 PASS（spec §1.2，bge-m3 multilingual 100% 命中）。Generator 开工前 Read 完整 spec + 8 个相关源文件后发现 11 个跨源差异 / 范式不匹配 / 设计 gap，需 Planner 短格式裁决。

---

## 2. 跨源比对发现

### 2.1 `kolCosineTopKSql` 实际形状 vs spec 文字
- spec line 79+88：F001「复用 `kolCosineTopKSql` — 1024 dim + ivfflat index」
- 实际 `src/lib/embedding/sql.ts:90-117`：仅返 `(id, distance)`，含 `embedding IS NOT NULL AND deleted_at IS NULL` filter，**不含 `is_suspicious=false` filter**
- 对比 SmartMatch `runSmartMatch` `smart-match.ts:199-230`：使用 inline raw SQL 返完整 row + 含 `is_suspicious=false` filter
- 影响：F001 若严格 reuse `kolCosineTopKSql`，suspicious KOL 会进 top-K；F002 hydrate 时需补 filter

### 2.2 `rateLimitAi` 实际形态 vs spec 描述
- spec line 60 + F004 acceptance：「BL-035 F003 AI rate-limit 自动覆盖 semantic search endpoint（10/min/tenantId + 100/day）」
- 实际 `src/lib/rate-limit-ai.ts`：导出 `rateLimitAi(tenantId)` 函数，**caller 必须显式调用**（参考 `roi/actions.ts:43`、`database/actions.ts:163`、`weekly-report/actions.ts:63`）— 不是 middleware
- 影响：F001 必须在 module 内显式 `await rateLimitAi(tenantId)`；spec 文字「自动覆盖」误导

### 2.3 `recordAiUsage` payload 形态 vs spec 监控需求
- spec F004 line 157：「event_log 写入 `type='ai.usage' source='semantic_search'` payload `{action:'discovery.semantic_search', queryText 前 50 chars, cost, cacheHit, kolIdsCount}`」
- 实际 `src/lib/ai/cost-cap.ts:95-105` `recordAiUsage(tenantId, action, costUsd?)`：写死 payload `{tenantId, action, costUsd, modelTokens: null}`，**无 source / queryText / cacheHit / kolIdsCount 通道**
- 影响：必须扩 `recordAiUsage` API 或绕开它直接 `logEvent({type:"ai.usage", payload:{...扩展}})`

### 2.4 cost-cap 估算粒度 vs semantic search 实际成本
- 实际 `src/lib/ai/cost-cap.ts:42-44`：MVP 估算 `$0.01/call`（500 calls/day = $5 cap）
- spec §1.2 实测：semantic search 单 query embedding 成本 `$0.000000470`（4 个数量级低于 cost-cap 单价估算）；chip cache hit 成本 `$0`
- 影响：若每次 semantic search 写 ai.usage event_log 行 → cost-cap 按 `count × $0.01` 估算 → 500 次 chip 点击就触发 cap，但实际成本仅 ~$0
- 设计 gap：cost-cap MVP 飞行检查精度不适合 chip cache hit + 极低单价场景

### 2.5 测试文件位置 vs 项目惯例
- spec line 173 + 263 line 2：`src/lib/discovery/__tests__/semantic-search.test.ts` co-located
- 项目实际：所有 unit tests 在 `tests/unit/`（含 SmartMatch `tests/unit/smart-match-similarity.test.ts`），所有 integration tests 在 `tests/integration/`（含 `tests/integration/smart-match-api.test.ts`）
- 例外：`src/app/[locale]/(app)/discovery/__tests__/discovery-fidelity.test.ts`（component fidelity 测试）+ `src/lib/ai/__tests__/`（早期 BL-034 写法）
- 影响：spec convention 与主线惯例冲突

### 2.6 default topK = 10 vs spec D2 = 50
- spec D2：「cosine top-K = 50（默认）」
- SmartMatch `DEFAULT_TOP_K = 10` (`smart-match.ts:40`)
- F001 spec line 76：`runSemanticKolSearch({tenantId, queryText, topK?})`，但未在 acceptance 列具体 default 值
- 影响：F001 内部 default 选 50，还是要求 caller 必传

### 2.7 `runDiscoverySearch` 输出形状 vs F001 输出形状不匹配
- `runDiscoverySearch` 返 `{items: DiscoveryKolCard[], nextCursor, hasMore, total}` (`search.ts:24-46`)
- F001 spec line 76：返 `{kolIds: string[], cost, latencyMs, cacheHit}` — 仅 ID 列表，无 hydrate
- F002 spec line 105：「discovery/search.ts 加 semantic 路径检测 filters.aiQuery → 调 runSemanticKolSearch → 返回 cosine-ordered kolIds」— 但 page.tsx 期望 `DiscoveryKolCard[]` 用于 grid 渲染
- 影响：F002 必须将 kolIds 二次 hydrate 成 `DiscoveryKolCard[]`，且需保持 cosine 顺序（不能 `IN (kolIds)` 直接查 — 因为 Prisma 不保留 order）

### 2.8 D5 sidebar filters 与 ?ai= 关系不明确
- spec D5：「首版 ?ai=X 时不应用 categories / platforms / regions 等 filter」
- 但 `discovery/page.tsx:50` 始终 `parseFilters(raw)` 后 + 渲染 `<ActiveFilters/>` + `<FilterSidebar/>`
- 影响：UX 形态不明 —
  - (a) ?ai=X 时 Hard bypass：sidebar 隐藏 + ActiveFilters 仅显示 AI chip
  - (b) Soft override：sidebar 仍可见但其值不参与 query
  - (c) 透明：sidebar 仍生效但 cosine top-K 内不应用 filter

### 2.9 SummaryBar sort disable 实装位置不在 spec 文件清单
- spec F002 acceptance 含「sort dropdown disable + tooltip "AI search uses semantic ranking"」
- spec §3 「变更文件清单」未列 `SummaryBar.tsx`
- 实际 sort UI 实装在 `SummaryBar.tsx:43-55`（3 个 `<a>` link），不是 dropdown
- 影响：F002 需改 SummaryBar；spec 用「dropdown」措辞与实物 link 形态不一致

### 2.10 Combined ?ai=X&search=Y + SaveSearch 行为
- spec 未定义 ?ai=X 与 ?search=Y 同时出现的行为
- spec 未定义 `savedSearch.filters` JSON 是否包含 `aiQuery`（用户保存 AI search 的兼容性）
- 影响：parseFilters 优先级 / SaveSearchControls 行为未定

### 2.11 失败 fallback 实装路径
- spec D4：「Embedding service 5xx → 自动降级 ILIKE substring search（SemanticSearchError code=EMBED_FAILED → fall back 到 ?search= ILIKE 路径）」
- 措辞「fall back 到 ?search= ILIKE 路径」+「自动 redirect URL」暗示客户端 302 重定向
- 但 server component 内 try/catch 后内部调 `runDiscoverySearch(filters with aiQuery removed + search = aiQuery)` 是更直接的路径，不涉及客户端重定向
- 影响：F002 实装路径明显有差异

---

## 3. 11 条决议请求

| #   | 决议点                                    | A 方案                                                                                                                                                     | B 方案                                                                                                                                                 | C 方案                                                                                 | 建议                                                                                              |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | F001 cosine SQL 形态                     | reuse `kolCosineTopKSql`（id-only），F002 hydrate 时手动补 `is_suspicious=false` filter                                                                         | fork inline raw SQL 返完整 row + 含 `is_suspicious=false`（与 SmartMatch 同模式）                                                                              | 扩 `kolCosineTopKSql` 加可选 `excludeSuspicious?: boolean` 参数（共享给 SmartMatch + Semantic） | **B**（与 SmartMatch 一致，hydrate 步骤减少，suspicious filter 在 SQL 层确保安全）                               |
| 2   | F001 default topK                      | 10（继承 SmartMatch DEFAULT_TOP_K）                                                                                                                          | 50（spec D2）                                                                                                                                          | caller 必传，无 default                                                                  | **B**（spec D2 显式 lock 50）                                                                       |
| 3   | F001 rateLimitAi 调用位置                  | 模块顶部第 1 步显式调（query 校验后立即）                                                                                                                                | 在 cosine SQL 调用前                                                                                                                                     | 不调，依赖 caller（API route）                                                              | **A**（与 `roi/actions.ts:43` 模式一致；先 rate-limit 再 cost-cap 再 embed）                               |
| 4   | F002 sidebar filters 与 ?ai= 关系         | Hard bypass：?ai= 时 page.tsx 跳过 FilterSidebar 渲染 + ActiveFilters 仅显示 AI chip + sort dropdown disable                                                      | Soft override：sidebar 仍渲染但其 chip 灰显 + tooltip "Disabled while AI search is active" + cosine SQL 内不应用 filter                                          | Transparent：sidebar 正常生效，cosine top-K 后再用 buildKolWhere 过滤                           | **B**（Hard bypass 让用户失去退出 AI search 的引导；Soft override 保留导航 + 视觉提示，符合渐进 UX）                      |
| 5   | F002 SummaryBar sort 处理                | 加 `aiActive: boolean` prop 传入 SummaryBar，aiActive=true 时 sort link 全部 disabled + 文案 "AI search uses semantic ranking"                                    | 推到 F003 fallback 时再做                                                                                                                                 | 不改 SummaryBar，仅 ActiveFilters 加 banner 提示                                            | **A**（spec F002 acceptance 明确要求 sort disable，需把 SummaryBar 加入 §3 文件清单）                          |
| 6   | F003 cache hit rate ≥95% 度量口径          | 仅 chip clicks 范围（chip 100% hit + free text 100% miss）                                                                                                    | 全部 semantic search 含自由文本（free text 始终 miss → 实际 hit rate 远低于 95%）                                                                                    | 撤销 ≥95% 字面要求，改为「chip clicks 命中 cache 100%」+「free text 不缓存」                           | **C**（spec ≥95% 在自由文本占比未知场景无意义；C 措辞更清晰）                                                         |
| 7   | F004 event_log payload 形态              | 用 recordAiUsage(action='discovery.semantic_search')，loses queryText/cacheHit/kolIdsCount monitoring                                                      | 直接 `logEvent({type:"ai.usage", payload:{tenantId, action, costUsd, queryText50, cacheHit, kolIdsCount, source:'semantic_search'}})` 跳过 recordAiUsage | 扩 `recordAiUsage(tenantId, action, costUsd?, extras?)` 加可选 extras 合并入 payload        | **C**（保留 recordAiUsage 单一入口 + cost-cap counter 一致 + 扩展 monitoring 字段；改动局限 cost-cap.ts 加可选参数）    |
| 8   | cost-cap 与 semantic search 关系          | 全跳过 `assertDailyCostBudget`（semantic search 不进 cost-cap）                                                                                                 | 与 chat 模式同等 enforce（cache-hit 也写 ai.usage 行 → cost-cap 估算误差，500 chip clicks 触发 $5 cap）                                                               | 仅 free text path 进 cost-cap（cache-hit 不写 ai.usage 行，避免估算误差）                          | **C**（cache-hit 实际成本 0，不应消耗 cost-cap 配额；free text 走 aigcgateway 真有成本）                           |
| 9   | F001 rate-limit-ai spec 文字偏差修正         | 修订 spec §F001 acceptance 增列「显式调 rateLimitAi(tenantId)」+ §1.4 DoD 第 5 条改为「F001 内部显式 rate-limit + cost-cap 自动覆盖 free text path」                            | 不修订 spec（依赖 Generator 隐式实装）                                                                                                                          | 加 ADR 记录「rate-limit-ai 是显式 API 不是 middleware」                                        | **A**（spec 偏差应修订；§1.4 DoD #5 措辞误导）                                                              |
| 10  | 测试文件位置                                 | 全跟 spec：`src/lib/discovery/__tests__/semantic-search.test.ts` + `tests/integration/discovery-ai-search.test.ts`（unit co-located + integration in tests/） | 全跟项目主线：`tests/unit/semantic-search.test.ts` + `tests/integration/discovery-ai-search.test.ts`（与 SmartMatch 同模式）                                      | spec 修订：unit 改放 tests/unit/ + integration 不变                                         | **B**（与 SmartMatch + 99% 项目 unit/integration tests 一致；spec line 173/263 co-located 是孤立写法）       |
| 11  | F002 ?ai=X 与 ?search=Y 互斥 + SaveSearch | parseFilters 中 ?ai= 优先 + 自动清 search；SaveSearch 不含 aiQuery（saved search 仅保留 sidebar filter）                                                               | 两者并存 + SaveSearch 含 aiQuery JSON                                                                                                                     | ?ai= 时 SearchBar input 禁用（视觉锁） + SaveSearch 不含 aiQuery                               | **A**（互斥简化首版 implementation；SaveSearch 不含 aiQuery 保留传统 filter 语义；参考 spec D5 first iteration 思路） |

### 裁决格式要求
请 Planner 就每条给出明确的 **A / B / C** 选择 + 简短理由（偏离建议时）。
用 `#1:B #2:B #3:A #4:B #5:A #6:C #7:C #8:C #9:A #10:B #11:A` 短格式回复即可。

---

## 4. 失败 fallback 实装路径补充决议（决议 #12，非主请求）

| # | 决议点 | A 方案 | B 方案 | 建议 |
|---|---|---|---|---|
| 12 | F003 fallback 路径 | 客户端 redirect URL（response 302 → `?search=<query>`，浏览器跳转） | 服务端 fall-through（page.tsx 内 try/catch SemanticSearchError → fall back 到 runDiscoverySearch with filters.search=aiQuery + filters.aiQuery=undefined）— 不重定向 | **B**（server component 内 fall-through 不需 redirect；用户 URL 不变，体验更平滑；spec D4 措辞调整为「内部 fall-through」） |

---

## 5. 原型 bug / 已知漂移追加

发现 spec §3 「变更文件清单」漏 2 项需补：
- `src/app/[locale]/(app)/discovery/SummaryBar.tsx`（决议 #5 = A 时新增）
- `src/lib/ai/cost-cap.ts`（决议 #7 = C 时扩 `recordAiUsage` 签名）

不回修 spec 文字之外，建议 Planner 在裁决回复中同步修订 §3 文件清单。

---

## 6. 开工条件

收到 Planner 对 11 条决议（+ 决议 #12 fallback 路径）的明确回复后，Generator 将：
1. 按决议实装 F001 → F002 → F003 → F004（spec §7 顺序），中段如发现良性偏差走 §11 building 中段变种规范
2. 守门：lint + tsc + test 全绿 + CI 全绿（每 push 后 `gh run list --limit 3 --branch main` 检查）
3. staging deploy + git_sha 对齐 + health 200 + DB ok（generator.md 切 verifying 硬要求）
4. Push commit + 切 verifying 等 Reviewer L1+L2

**未收到明确回复前不开工。**

---

## 7. 估算开工时长（含审计裁决）

| 环节 | 预估 |
|---|---|
| 审计 → 裁决（异步）| 0.5-1h |
| F001 runSemanticKolSearch + 单测 ≥4 case | 2-3h |
| F002 UI integration（SearchBar + ActiveFilters + page.tsx + filters.ts + SummaryBar + search.ts）| 1.5-2h |
| F003 chip cache + ENABLE_AI_SEARCH + fallback | 1h |
| F004 集成测试 ≥2 case + event_log monitoring + cost-cap C 路径 | 1-1.5h |
| Lint + tsc + test 守门 + CI fix-up | 0.5-1h |
| Staging deploy + git_sha 验证 | 0.5h |
| **总计** | **~7-10h ≈ 1-1.5 day**（与 spec 预估 1-2 day 吻合）|

---

## 8. 相关文档

- spec: `docs/specs/BL-044-discovery-ai-semantic-search-spec.md`
- 范式 source: `src/lib/discovery/smart-match.ts`（266 行）
- 调用链：
  - `src/lib/embedding/client.ts` (`embedOne` / `embedBatch`)
  - `src/lib/embedding/sql.ts` (`kolCosineTopKSql` / `vectorLiteral`)
  - `src/lib/embedding/types.ts` (`EmbeddingBatchUsage` / `EMBEDDING_DIMS=1024`)
  - `src/lib/ai/cost-cap.ts` (`assertDailyCostBudget` / `recordAiUsage`)
  - `src/lib/rate-limit-ai.ts` (`rateLimitAi`)
  - `src/lib/events/log.ts` (`logEvent`)
- UI 调用方：
  - `src/app/[locale]/(app)/discovery/page.tsx`
  - `src/app/[locale]/(app)/discovery/SearchBar.tsx`
  - `src/app/[locale]/(app)/discovery/ActiveFilters.tsx`
  - `src/app/[locale]/(app)/discovery/SummaryBar.tsx`
  - `src/app/[locale]/(app)/discovery/search.ts`
  - `src/lib/kol/filters.ts`
- 测试参考：
  - `tests/unit/smart-match-similarity.test.ts`
  - `tests/integration/smart-match-api.test.ts`
- harness 规则：
  - `framework/harness/pre-impl-adjudication.md` §1-§10（主 pattern）+ §11（building 中段变种）
  - `framework/harness/planner.md`（Planner 铁律 1 矩阵 v0.9.14 完整 pattern grep）

---

## 9. Planner 裁决（johnsong · 2026-05-06 16:30）

**短格式：** `#1:B #2:B #3:A #4:B #5:A #6:C #7:C #8:C #9:A #10:B #11:A #12:B(+banner)`

**12/12 全 Accept Generator 建议**（用户 2026-05-06 16:30 决议「A 全 Accept」），仅 #12 加一个 banner UX 补充（不改路径）。

**逐条裁决理由：**

| #  | 裁决 | 与 Generator 建议 | 理由 |
| -- | --- | --------------- | ---- |
| 1  | **B** | ✓ 一致 | fork inline raw SQL 与 SmartMatch 同模式，hydrate 步骤减少 + `is_suspicious=false` 在 SQL 层确保安全；C（扩 `kolCosineTopKSql` 加可选参数）跨 SmartMatch 改动 = scope creep 不入本批次；A（id-only + 后过滤）运行时浪费（top-K=50 取出后过滤可能剩 30 个） |
| 2  | **B** | ✓ 一致 | spec D2 已 lock topK=50，无悬念 |
| 3  | **A** | ✓ 一致 | fail-fast 原则：rate-limit (低成本快拒) → cost-cap (DB 计数器) → embed (gateway 调用)；与 `roi/actions.ts:43`、`database/actions.ts:163`、`weekly-report/actions.ts:63` 一致 |
| 4  | **B** | ✓ 一致 | A（Hard bypass）失去退出 AI search 的视觉导航，用户必须刷新页面或点 X 才能切回 sidebar 操作；B（Soft override）保留 sidebar 视觉 + tooltip 提示，符合渐进 UX；C（Transparent）实现复杂（top-K 取较多再 filter）首版不必要 |
| 5  | **A** | ✓ 一致 | spec F002 acceptance 明确要求 sort disable；§3 文件清单需补 `SummaryBar.tsx`（已加） |
| 6  | **C** | ✓ 一致 | spec ≥95% 在自由文本占比未知场景无意义；C 措辞「chip clicks 命中 cache 100% + free text 不缓存」更 explicit |
| 7  | **C** | ✓ 一致 | B（直接 `logEvent` 跳过 `recordAiUsage`）破坏 cost-cap counter SSOT；C（扩签名加 extras）保留单一入口 + 扩展 monitoring 字段；改动局限 cost-cap.ts 加可选参数（向后兼容） |
| 8  | **C** | ✓ 一致 | A（全跳过 cost-cap）不安全（恶意刷 free text 不算 cost）；B（全 enforce 含 cache-hit）误差大（cache-hit 实际 0 cost 却消耗 $5/day 配额，500 chip clicks 即触发 cap）；C（仅 free text 进 cost-cap）平衡 |
| 9  | **A** | ✓ 一致 | spec §F001 acceptance + §1.4 DoD #5「自动覆盖」措辞误导（实际是「显式调用」），不修订未来 reviewer 会质疑；已修订 |
| 10 | **B** | ✓ 一致 | 与 SmartMatch + 99% 项目 unit/integration tests 一致（`tests/unit/` 不在源文件 `__tests__/`）；spec line 173/263 co-located 是孤立写法（系 spec 起草偏差） |
| 11 | **A** | ✓ 一致 | 互斥简化首版 implementation；SaveSearch 不含 aiQuery 保留传统 filter 语义；spec D5 first iteration 思路一致；B（两者并存）易引入 SaveSearch JSON schema 偏移；C（视觉锁 input）违反 SearchBar 现有逻辑 |
| 12 | **B + banner** | ⚠️ 加 banner UX 补充 | server fall-through 不需 redirect 路径正确；**但建议加** `ActiveFilters` "AI search unavailable, showing keyword results" banner（D8 新增），否则用户 URL 仍 `?ai=foo` 但服务端展示 ILIKE 结果时不知 fallback 已发生，会困惑「AI 怎么没工作」+ 刷新还会再次失败 |

---

## 10. Spec 同步修订（已 commit by Planner @ 2026-05-06 16:30）

按裁决修订 `docs/specs/BL-044-discovery-ai-semantic-search-spec.md`：

1. **§Header** 加 Pre-impl 裁决记录行（短格式 + 指向本 audit §9）
2. **§F001 改动列表** 加 default topK=50 + cosine SQL fork inline + rateLimitAi 模块顶部 + cost-cap 仅 free text path
3. **§F001 Acceptance** +5 行：cosine SQL fork、topK=50、rateLimitAi 显式调、cost-cap 仅 free text
4. **§F002 改动列表** 加 SummaryBar aiActive prop + Soft override sidebar + ?ai/?search 互斥 + SaveSearch 不含 aiQuery
5. **§F002 Acceptance** +5 行：?ai/?search 互斥、SummaryBar aiActive、Soft override sidebar、SaveSearchControls 保留传统语义
6. **§F003 Acceptance** 改 cache hit rate 措辞 + fall-through 路径 + fallback banner UX
7. **§F004 改动列表** 改 测试位置到 `tests/unit/` + recordAiUsage 扩签名 extras
8. **§F004 Acceptance** +1 行：recordAiUsage 扩签名 + cost-cap 仅 free text
9. **§1.4 DoD** 改 BL-035 F003 描述措辞为「F001 显式调 + cost-cap 仅 free text」
10. **§3 文件清单** +5 项：SummaryBar.tsx / page.tsx / FilterSidebar.tsx / SaveSearchControls.tsx / cost-cap.ts；测试位置 `__tests__/` → `tests/unit/`
11. **§4 关键设计决策** 加 D8（fallback 路径）+ D9（?ai/?search 互斥）+ D10（recordAiUsage 扩签名）；D5/D6 补裁决参考
12. **§5 dogfood 矩阵** 加 v0.9.14 §planner.md 铁律 1（Generator pre-impl grep dogfood）+ v0.9.14 §deploy-patterns §1.7（不涉及）+ v0.9.12 §pre-impl-adjudication 实战触发记录
13. **§7 实装顺序** 11 步 → 16 步（含 Soft override sidebar + SaveSearchControls + cost-cap.ts + i18n locales 单独列）

---

## 11. Generator 开工授权

**✅ 授权开工 @ 2026-05-06 16:30。** 按 spec §7 修订后 16 步顺序实装 F001 → F002 → F003 → F004。守门：

- 每 push 后 `gh run list --limit 3 --branch main` 检查 CI 全绿
- staging deploy + git_sha 对齐 + health 200 + DB ok（generator.md 切 verifying 硬要求）
- 切 verifying 前更新 progress.json `completed_features` + Kimi `session_notes`

如建造中段发现良性偏差按 `framework/harness/pre-impl-adjudication.md` §11 building 中段变种处理（写 `generator_handoff` + 短格式裁决请求 + 暂停推送）。

