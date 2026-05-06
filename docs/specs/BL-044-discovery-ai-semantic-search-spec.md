# BL-044 /discovery AI Semantic Search 实装 — Spec

> **状态：** Planner draft → 等 BL-040 done + BL-043 staging gap 闭合后启动 building
> **触发：** 用户 2026-05-06 报 prod bug — `/zh/discovery` 点 AI chip "🎮 王者荣耀上线适配的 FPS 创作者" 显示 "未找到符合的 KOL"。Planner 调查根因：AI chip 是「自然语言查询意图」但 search 实装是字面 ILIKE substring 匹配 — 长意图字符串命中 0
> **作者：** Planner johnsong @ 2026-05-06 12:30（重写为 BL-044 @ 12:50 — BL-043 被 Generator 用作 staging gap 闭合 ID 冲突避免）
> **依赖：** BL-040 done + BL-043 staging gap 闭合 → 然后 BL-044 启动；B7a-F001 KOL embedding pipeline（已实装）+ BL-035 F003 AI rate-limit（已实装防 abuse）
> **预估：** 1-2 day building + 0.5 day verifying
> **批次类型：** 普通批次（4 features 全 `executor:generator`）→ status 流转 `new → planning → building → verifying → done`
> **Pre-impl 裁决：** Planner johnsong @ 2026-05-06 16:30 短格式 `#1:B #2:B #3:A #4:B #5:A #6:C #7:C #8:C #9:A #10:B #11:A #12:B(+banner)` — 12 条全 Accept Generator 建议（详见 `docs/specs/BL-044-pre-impl-audit.md` §9）。本 spec 已按裁决修订 §F001/§F003/§F004 acceptance + §1.4 DoD + §3 文件清单 + §7 实装顺序。

---

## 1. 背景与目标

### 1.1 用户报告 + 根因

用户 2026-05-06 报：在 prod `/zh/discovery` 顶部 SearchBar 点 AI chip "🎮 王者荣耀上线适配的 FPS 创作者" → 页面显示"未找到符合的 KOL"。

Planner 调查根因（实测 prod DB 2442 KOL）：
- ILIKE substring `%王者荣耀上线适配的FPS创作者%` → **0 命中**（没人 displayName 含整句）
- ILIKE substring `%FPS%` → 94 命中（substring search 本身工作）
- categories 含 'FPS' → **1928 命中**（79% prod KOL，多语言 multilingual 多平台）

**核心问题：AI chip label 是自然语言查询意图，但实装是 `?search=<entire label>` → ILIKE substring 匹配 — 两者根本不匹配。**

### 1.2 Quality 实测（2026-05-06 12:10 prod read-only test）— **Quality gate PASS**

Planner 用 mcp `embed_text` (bge-m3 1024-dim multilingual) + prod KOL.embedding cosine search 跑了 4 个 query 实测：

| Query | Top 10 命中 | Cosine Distance | 评价 |
|---|---|---|---|
| "🎮 FPS 创作者" 中文短 | たにしのFPS / Doktah FPS / Pathak-fps / Warfrags FPS / NEGAN FPS / FPS切り抜きボット / XD FPS / Ren FPS / ThomaZ FPS / WolfheartFPS | 0.3798-0.4336 | **100% FPS 类 KOL，多语言混合命中**（日文 + 拉丁 + 韩文 KOL displayName）✓ |
| "🎮 王者荣耀上线适配的 FPS 创作者" chip 完整文案 | NEGAN FPS / Doktah FPS / たにしのFPS / Rexxy FPS / 75 FPS / Pathak-fps / FPS切り抜きボット / WolfheartFPS / XD FPS / Warfrags FPS | 0.4296-0.4620 | **100% FPS 类**，long context 仍精准 ✓ |
| "FPS gaming creators" 英文 baseline | 与中文短 query 命中相同 set | 0.4020-0.4441 | **跨语言 cosine 一致** ✓ |
| "🎯 RPG 手游测评创作者" | Hafian RPG / Cozy RPG **Reviews** / Dave Thaumavore RPG **Reviews** / RPG Unpacked / rpg crawler / 게임달고나 / Azcalibur / RPG Ranked / RPG Playground / RPGGameplay | 0.3740-0.4104 | **semantic 真理解"测评" = "Reviews"** ✓ |

**总实测成本：$0.00000188（4 query × $0.000000470）**，4 query × 41 tokens = 164 tokens 总。

**Quality gate PASS — bge-m3 multilingual KOL.embedding 跨中英日韩文 query 全部 100% 语义相关命中，cosine distance 范围 0.37-0.46（紧致），无 quality 风险。** spec 实施可放心。

### 1.3 为何不选方案 D（chip → categories filter）

方案 D 治标（20 min hotfix，chip URL 走 ?categories=FPS 等 filter）效果立竿见影但有限制：
- 仅 3 个 chip 预设，用户无法自由文本搜索
- 中文 query 不走 multilingual，限制使用场景
- 长期 KOL 量级扩大后 categories 标签粒度不够（如 prod "FPS" 1928 个 — 太粗放）

C 方案（本 spec）治本：
- 任意自然语言 query 全可工作（chip + 用户自由输入）
- multilingual cosine 跨中/英/日/韩文实测 100% 命中
- post-MVP 业务规模扩大后仍 scalable（cosine top-K 50ms 内返）

### 1.4 Definition of Done

- 4 features 全 PASS by Reviewer L1+L2
- prod 任一 chip click 命中 ≥10 个 KOL（cosine top-50 默认）
- 用户自由文本输入（"会带货且评测客观的男主播"等任意自然语言）→ semantic 命中 ≥1 个 KOL
- 失败 fallback 工作（mock embedding service 5xx → fall back 到 ILIKE `?search=` 路径）
- chip embedding cache hit rate ≥95%（每次 chip click 不重新调 aigcgateway）
- v0.9.13 §4.7 dogfood 验证：max_tokens 由 aigcgateway 默认（embedding 模型 input 不限 max_tokens；output dim 固定 1024）— 不需 max_tokens 控制
- F001 显式调 `rateLimitAi(tenantId)` + cost-cap MVP **仅覆盖 free text path**（chip cache-hit 跳过；裁决 #8=C + #9=A）；BL-035 F003 AI rate-limit 配额仍 enforce（10/min/tenantId + 100/day）

---

## 2. 功能清单（4 features 全 generator）

### F001 · `runSemanticKolSearch` server module（fork from smart-match.ts）

**Executor:** generator
**Priority:** high
**预估工时:** 2-3h

**改动：**

新建 `src/lib/discovery/semantic-search.ts`（~150 行，fork from `smart-match.ts:115-200` 范式）：

- export `runSemanticKolSearch({tenantId, queryText, topK?})` → `Promise<{kolIds: string[], cost: number, latencyMs: number, cacheHit: boolean}>` — **default topK=50（裁决 #2=B，spec D2 lock）**
- export `class SemanticSearchError` 含 codes `INVALID_QUERY` / `EMBED_FAILED` / `DB_ERROR`
- 复用 `embedOne` (`src/lib/embedding/client.ts`) — bge-m3 multilingual
- **cosine SQL fork inline raw SQL（与 SmartMatch 同模式，含 `embedding IS NOT NULL AND deleted_at IS NULL AND is_suspicious=false` filter；裁决 #1=B）** — 1024 dim + ivfflat index
- RLS via `withTenant` 包裹（与 SmartMatch 同模式）
- Validate `queryText`：空 / >200 chars 抛 INVALID_QUERY
- **模块顶部第 1 步显式调 `rateLimitAi(tenantId)`（裁决 #3=A，与 `roi/actions.ts:43` 同 fail-fast 模式）；`assertDailyCostBudget` 仅 free text path 调用，chip cache-hit 路径跳过 cost-cap counter（裁决 #8=C，cache-hit 实际成本 0）**
- Latency budget：cached path < 100ms / non-cached path < 500ms

**Acceptance：**

- [ ] `src/lib/discovery/semantic-search.ts` 存在 + export `runSemanticKolSearch` + `SemanticSearchError`
- [ ] embed 调用复用 `embedOne` (`src/lib/embedding/client.ts`) — bge-m3 model
- [ ] **cosine SQL fork inline raw SQL（与 SmartMatch 同模式，含 `is_suspicious=false` filter）** — 1024 dim + ivfflat index（裁决 #1=B）
- [ ] **`runSemanticKolSearch` default topK=50（裁决 #2=B）**
- [ ] RLS via `withTenant` 包裹（与 SmartMatch 同模式）
- [ ] Validate `queryText`：空 / >200 chars 抛 INVALID_QUERY
- [ ] **模块顶部第 1 步显式 `await rateLimitAi(tenantId)`（裁决 #3=A）**
- [ ] **`assertDailyCostBudget` 仅 free text path 调用，chip cache-hit 路径跳过（裁决 #8=C）**
- [ ] Latency budget：cached path < 100ms / non-cached path < 500ms
- [ ] `npm run lint + tsc + test` 全绿

---

### F002 · UI integration — SearchBar AI chip + page.tsx 解析

**Executor:** generator
**Priority:** high
**预估工时:** 1-1.5h

**改动：**

1. **`src/app/[locale]/(app)/discovery/SearchBar.tsx` chip href 改：** 当前 `${basePath}?search=${encodeURIComponent(label)}` → `${basePath}?ai=${encodeURIComponent(label)}`
2. **`src/app/[locale]/(app)/discovery/search.ts`** 加 semantic 路径：检测 `filters.aiQuery` → 调 `runSemanticKolSearch` → 返回 cosine-ordered kolIds（自动 fallback 到 ILIKE 见 F003）
3. **`src/lib/kol/filters.ts`** 加 `aiQuery?: string` field + parseFilters / serializeFilters 同步处理 `ai` URL 参数
4. **`src/app/[locale]/(app)/discovery/ActiveFilters.tsx`** 加 "🤖 AI: <query>" chip 渲染 + 点 X 清空 ?ai=
5. **AI search result grid** 保持 cosine 顺序（不按 valueScore / followers / createdAt 排）— **`SummaryBar.tsx` 加 `aiActive: boolean` prop，aiActive=true 时 sort link 全部 disabled + tooltip "AI search uses semantic ranking"（裁决 #5=A）**
6. **Sidebar filters 与 ?ai= 关系（Soft override，裁决 #4=B）：** ?ai=X 时 `FilterSidebar` 仍渲染但 chip 灰显 + tooltip "Disabled while AI search is active"；cosine SQL 内不应用 sidebar filter（D5 first iteration）；保留视觉导航 + 渐进 UX
7. **?ai=X 与 ?search=Y 互斥（裁决 #11=A）：** parseFilters 检测 ?ai= 时优先 + 自动清 search；SaveSearchControls 保留传统 filter 语义（不含 aiQuery）

**Acceptance：**

- [ ] SearchBar.tsx chip href 改为 `?ai=<encoded label>`
- [ ] discovery/search.ts 检测 `filters.aiQuery` → 调 `runSemanticKolSearch` → 返回 cosine-ordered kolIds
- [ ] ActiveFilters 渲染 "🤖 AI: <query>" chip + 点 X 清空 ?ai
- [ ] DiscoveryFilters interface 加 `aiQuery?: string`
- [ ] parseFilters / serializeFilters 同步处理 `ai` URL 参数
- [ ] **parseFilters 内 ?ai= 与 ?search= 互斥（?ai= 优先 + 清 search；裁决 #11=A）**
- [ ] AI search result grid 保持 cosine 顺序（不按 valueScore / followers / createdAt 排）
- [ ] **SummaryBar.tsx 加 `aiActive` prop + aiActive=true 时 sort link disabled + tooltip "AI search uses semantic ranking"（裁决 #5=A）**
- [ ] **FilterSidebar Soft override：?ai=X 时 chip 灰显 + tooltip "Disabled while AI search is active"，filter 不参与 cosine query（裁决 #4=B）**
- [ ] **SaveSearchControls 保留传统 filter 语义（不含 aiQuery；裁决 #11=A）**
- [ ] `npm run lint + tsc + test` 全绿

---

### F003 · Performance + Failure fallback

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min - 1h

**改动：**

1. **Chip embedding cache（in-memory，启动时预生成）：** Module-level `Map<string, number[]>` cache + `preWarmChipCache()` lazy first-request 触发（避免 cold start blocking）；5 locale × 3 chip = 15 texts batch embed
2. **Embedding service failure fallback（feature flag-aware）：** 5xx → 自动降级 ILIKE substring search（`SemanticSearchError code=EMBED_FAILED` → fall back 到 `?search=` ILIKE 路径）
3. **Feature flag `ENABLE_AI_SEARCH=true`（默认 enabled，env var override）：** false 时 short-circuit 退化到 ILIKE，与 BL-020 F005 `DISABLE_LOGIN_RATELIMIT` / BL-034 F005 cost-cap escape hatch 同模式
4. **`.env.example` 加 `ENABLE_AI_SEARCH=true` + comment**

**Acceptance：**

- [ ] Module-level `CHIP_EMBEDDING_CACHE` Map 实装
- [ ] `preWarmChipCache()` 启动时跑（lazy first-request 触发，避免 cold start blocking）
- [ ] Cache hit → `cacheHit: true` 在返回值
- [ ] **Chip clicks 命中 cache 100% + free text 不缓存（裁决 #6=C，撤销原 ≥95% 字面要求 — 自由文本占比未知场景下度量无意义）**
- [ ] **embedding service 5xx → 服务端 fall-through 到 ILIKE 路径（page.tsx 内 try/catch SemanticSearchError → 调 `runDiscoverySearch` with `filters.search=aiQuery, filters.aiQuery=undefined`，**不重定向 URL**；裁决 #12=B）**
- [ ] **fallback 触发时 `ActiveFilters` 显示 "AI search unavailable, showing keyword results" banner（裁决 #12 补充 UX，避免用户不知 fallback 发生）**
- [ ] env var `ENABLE_AI_SEARCH=false` short-circuit 退化到 ILIKE
- [ ] .env.example 加 `ENABLE_AI_SEARCH=true` + comment

---

### F004 · Tests + Monitoring

**Executor:** generator
**Priority:** medium
**预估工时:** 1h

**改动：**

1. **`tests/unit/semantic-search.test.ts` ≥4 case（裁决 #10=B，跟项目主线 unit/integration 位置，与 SmartMatch `tests/unit/smart-match-similarity.test.ts` 同模式）：** empty query reject / >200 chars reject / valid query top-K returned / EMBED_FAILED 5xx mock / cache hit
2. **`tests/integration/discovery-ai-search.test.ts` ≥2 case：** ?ai=FPS 端到端 grid render with cosine hits / ?ai=GIBBERISH fallback to ILIKE empty state
3. **Monitoring 集成（BL-034 F005 cost-cap MVP）：** **扩 `recordAiUsage(tenantId, action, costUsd?, extras?)` 加可选 extras 参数（裁决 #7=C）**，semantic search 调用时 extras=`{source:'semantic_search', queryText50, cacheHit, kolIdsCount}`；保留单一入口 + cost-cap counter SSOT；event_log 写 `type='ai.usage'` payload 含扩展字段

**Acceptance：**

- [ ] **`tests/unit/semantic-search.test.ts` ≥4 case（裁决 #10=B 位置）+ `tests/integration/discovery-ai-search.test.ts` ≥2 case 全 PASS**
- [ ] event_log 写入 type='ai.usage' source='semantic_search' + 扩展 payload 字段（queryText50/cacheHit/kolIdsCount）验证
- [ ] **`recordAiUsage` 签名扩展 `extras?: Record<string, unknown>` 参数（裁决 #7=C）**
- [ ] BL-034 F005 cost-cap MVP enforce per-tenant $5/day 上限 — **仅 free text path**（chip cache-hit 跳过；裁决 #8=C）
- [ ] BL-035 F003 AI rate-limit 自动 enforce（10/min/tenantId） — F001 模块顶部显式调（裁决 #3=A）
- [ ] `npm run lint + tsc + test` 全绿 + CI 全绿

---

## 3. 变更文件清单

```
src/lib/discovery/semantic-search.ts                         F001 NEW (~150 行)
tests/unit/semantic-search.test.ts                            F001+F004 NEW (≥4 case，裁决 #10=B)

src/app/[locale]/(app)/discovery/search.ts                   F002 EDIT (+semantic path with fallback)
src/app/[locale]/(app)/discovery/SearchBar.tsx               F002 EDIT (chip href 改 ?ai=)
src/app/[locale]/(app)/discovery/ActiveFilters.tsx           F002 EDIT (+AI chip render + fallback banner 裁决 #12)
src/app/[locale]/(app)/discovery/SummaryBar.tsx              F002 EDIT (+aiActive prop + sort disabled，裁决 #5=A)
src/app/[locale]/(app)/discovery/page.tsx                    F002 EDIT (?ai= 解析 + Soft override sidebar 裁决 #4=B + fallback try/catch 裁决 #12)
src/app/[locale]/(app)/discovery/FilterSidebar.tsx           F002 EDIT (Soft override 灰显 + tooltip，裁决 #4=B)
src/app/[locale]/(app)/discovery/SaveSearchControls.tsx      F002 EDIT (saved search 不含 aiQuery，裁决 #11=A)
src/lib/kol/filters.ts                                       F002 EDIT (+aiQuery field + parse/serialize + ?ai/?search 互斥 裁决 #11=A)

src/lib/discovery/semantic-search.ts (F003 cache logic)      同 F001 文件 EDIT

src/lib/ai/cost-cap.ts                                        F004 EDIT (recordAiUsage 加可选 extras 参数，裁决 #7=C)

.env.example                                                  F003 EDIT (+ENABLE_AI_SEARCH=true)

tests/integration/discovery-ai-search.test.ts                F004 NEW (≥2 case)

i18n locales (en/zh/ja/ko/es).json                           F002 EDIT (~6 keys：AI chip 显示文案 / fallback banner / sort disabled tooltip / sidebar disabled tooltip)
```

---

## 4. 关键设计决策

### D1 · F001 fork from smart-match.ts，不改 smart-match
SmartMatch 是 Product → KOL（B7a），semantic-search 是 free-text → KOL（C 方案）。两个 use case 独立，避免耦合 + 各自演进。

### D2 · cosine top-K = 50（默认）
50 KOL 给用户足够选择空间 + 不超过 grid 1 页（pageSize 50）。比 SmartMatch 的 10 大 5 倍 — semantic 不像 SmartMatch 是"top 10 推荐"模式，是"找出 50 个相关你随便选"。

### D3 · F003 chip embedding cache 在 module level（process-local）
- 5 locale × 3 chip = 15 texts，embed batch 一次性 ~$0.000001
- Map<string, number[1024]> 内存约 60KB（15 × 1024 × 4 bytes）
- PM2 cluster 多实例 → 每实例独立 pre-warm（OK，cache 是 read-mostly）
- 不用 Redis 是因为 chip 文案是 i18n 静态值，不会变；冷启动 1 次预热足够

### D4 · F003 fallback policy
- Embedding service 5xx → 自动降级 ILIKE substring search（不影响用户体验，仅 quality 退化）
- Feature flag `ENABLE_AI_SEARCH=false` → 全局 short-circuit（prod 故障应急）
- 与 BL-020 F005 / BL-034 F005 escape hatch 同模式（`DISABLE_*` 系列 env var）

### D5 · F002 AI search bypasses other filters（first iteration，裁决 #4=B Soft override 修订）
首版 ?ai=X 时不应用 categories / platforms / regions 等 filter（cosine top 50 已足够 specific）。
- **裁决 #4=B 修订：sidebar 仍渲染但 chip 灰显 + tooltip "Disabled while AI search is active"（保留视觉导航 + 渐进 UX）**
- cosine SQL 内不应用 sidebar filter（D5 first iteration 不变）
- 用户可以先 AI search → 然后在 sidebar 补 filter（second iteration 演进）
- 简化首版 implementation，避免 hybrid query 复杂度

### D6 · grid sort 在 AI search 时 disable（裁决 #5=A 通过 SummaryBar aiActive prop 实装）
URL `?ai=X` 时，sort dropdown disabled + tooltip "AI search uses semantic ranking"（cosine distance ASC 隐式排序）。用户切到 ?search= 或清空 ?ai 才恢复 sort 选项。
- **实装：`SummaryBar.tsx` 加 `aiActive: boolean` prop（裁决 #5=A），由 page.tsx 传入 `Boolean(filters.aiQuery)`**

### D8 · F003 fallback 路径（裁决 #12=B 服务端 fall-through）
- Embedding service 5xx → page.tsx 内 try/catch SemanticSearchError → 调 `runDiscoverySearch` with `filters.search=aiQuery, filters.aiQuery=undefined` → 不重定向 URL
- 用户 URL 仍显示 `?ai=foo` 但服务端展示 ILIKE substring 结果
- **`ActiveFilters` 显示 "AI search unavailable, showing keyword results" banner，避免用户不知 fallback 发生**
- 与客户端 302 redirect 路径相比：URL 不变 + 体验更平滑 + 不损失 ?ai= URL 状态用于后续重试

### D9 · F002 ?ai= 与 ?search= 互斥（裁决 #11=A first iteration）
- parseFilters 检测 ?ai= 时优先 + 自动清 search（互斥）
- SaveSearchControls 保留传统 filter 语义（不含 aiQuery 序列化）
- 简化首版 implementation；second iteration 评估 SaveSearch + AI 组合需求

### D10 · F004 recordAiUsage 扩签名（裁决 #7=C）
- `recordAiUsage(tenantId, action, costUsd?, extras?)` 加可选 `extras: Record<string, unknown>` 参数
- semantic search 调用时 extras=`{source:'semantic_search', queryText50, cacheHit, kolIdsCount}`
- 保留 cost-cap counter SSOT + 扩展 monitoring 字段；不破坏 chat 路径调用方

### D7 · Multilingual quality 实测已验证（spec §1.2）
不需要 prerequisite step — Planner 已用 mcp embed_text + prod KOL.embedding cosine search 实测 4 query 全 100% 命中。Generator 直接进入 building，跳过 quality dry-run。

---

## 5. v0.9.11 + v0.9.12 + v0.9.13 + v0.9.14 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.11 §rate-limit | F001 复用 BL-035 F003 `rateLimitAi(tenantId)`（10/min/tenantId + 100/day）— **裁决 #3=A 改为模块顶部显式调而非 middleware** |
| v0.9.11 §database-patterns §8 RLS | 不新增表（仅 read kol.embedding），不适用 |
| v0.9.11 §ai-action-contract §4 max_tokens | embedding 模型 input 不限 max_tokens；output dim 1024 固定。**v0.9.13 §4.7 验证**：embedding 路径 max_tokens 无意义（与 chat completions 不同），跳过 |
| v0.9.11 §4 XML tag wrap | embedding 路径不存在 prompt-injection 攻击面（input 直接转 vector，无 prompt template），跳过 |
| v0.9.12 §pre-impl-adjudication §1-§10 pre-impl 模式 | **已触发 — Generator Kimi @ 9d60dd5 提交 `BL-044-pre-impl-audit.md` 11+1 决议；Planner johnsong @ 2026-05-06 16:30 短格式裁决全 Accept** |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | 可能触发：如果 embedding service mcp client.ts 的 type signature 不符（实测后调整），主动停 + 短格式裁决 |
| v0.9.13 §5.1 spec deploy-script vs yml | 不涉及 deploy-script 改 |
| v0.9.13 §4.7 mcp 自动化可达性（实测） | 已确认 embedding 路径无 max_tokens 字段；spec scope 不依赖此 |
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | **Generator Kimi 已 dogfood — 开工前 grep 实物比对 spec 8 个相关源文件 → 发现 11 个跨源差异（如 `kolCosineTopKSql` 仅返 id-only / `rateLimitAi` 是显式 API 不是 middleware / `recordAiUsage` payload 形态 / co-located vs tests/ 测试位置）— Planner 接受 12/12 + spec 7 处修订** |
| v0.9.14 §deploy-patterns §1.7 PM2 .env reload 不可靠 | 不涉及 .env 改动；BL-044 staging deploy 走标准 git pull 路径 |

---

## 6. Definition of Done

### 6.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | prod redeploy 后浏览器走查 `/zh/discovery`：(a) 点 chip "🎮 王者荣耀上线适配的 FPS 创作者" → 应见 ≥10 个 FPS 类 KOL；(b) 点 chip "🎯 RPG 手游测评创作者" → 应见 RPG-related KOL；(c) 自由输入 "会带货且评测客观的男主播" → semantic 命中 ≥1 个 | BL-044 done 后 prod redeploy |
| 2 | 监控 prod aigcgateway 余额：BL-044 上线后 1 周观察 cost trend（每次 chip click 走 cache 应 $0；偶发自由 query ~$0.0001） | 持续观察 |

### 6.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新增 ≥6 测试 case）+ CI 全绿
- **L2：** staging git_sha 对齐 + (a) 浏览器点 chip 命中 ≥10 + (b) 自由文本测试 ≥1 命中 + (c) feature flag `ENABLE_AI_SEARCH=false` 验证 fallback 工作 + (d) embedding service mock 5xx 验证降级到 ILIKE

### 6.3 Soft-watch（不阻塞 done）

- bge-m3 multilingual quality 已实测 PASS（§1.2），但小语种 / 罕见 query 表现需 prod 1 周观察
- chip embedding cache cold-start latency（首次请求 ~500ms 含 pre-warm + 后续 cache hit ~50ms）— 接受 trade-off
- BL-042 actions/run max_tokens 治理 post-MVP — 不影响 BL-044（embedding 路径无 max_tokens）

---

## 7. 实装顺序（Generator 接手参考）

```
1. F001 src/lib/discovery/semantic-search.ts（fork from smart-match.ts，~150 行；含 inline cosine SQL + is_suspicious filter + 模块顶部 rateLimitAi + cost-cap 仅 free text）
2. F001 tests/unit/semantic-search.test.ts ≥4 case（裁决 #10=B 位置）
3. F002 src/lib/kol/filters.ts 加 aiQuery field + parseFilters（?ai 与 ?search 互斥，裁决 #11=A）/ serializeFilters
4. F002 SearchBar.tsx chip href 改 ?ai=
5. F002 ActiveFilters.tsx 加 AI chip 渲染 + fallback banner（裁决 #12）
6. F002 page.tsx 解析 ?ai + 调 runSemanticKolSearch + try/catch fall-through 到 runDiscoverySearch（裁决 #12=B）+ Soft override sidebar 渲染逻辑（裁决 #4=B）
7. F002 SummaryBar.tsx 加 aiActive prop + sort link disabled（裁决 #5=A）
8. F002 FilterSidebar.tsx Soft override 灰显 + tooltip（裁决 #4=B）
9. F002 SaveSearchControls.tsx 保留传统 filter（裁决 #11=A）
10. F003 chip embedding cache 实装 + preWarmChipCache + ENABLE_AI_SEARCH env flag
11. F004 src/lib/ai/cost-cap.ts 扩 recordAiUsage 加 extras 参数（裁决 #7=C）
12. F004 集成测试 tests/integration/discovery-ai-search.test.ts ≥2 case
13. F004 event_log monitoring 集成（recordAiUsage extras 路径）
14. i18n locales 5 文件加 ~6 keys（AI chip / fallback banner / sort tooltip / sidebar tooltip）
15. lint + tsc + test 守门
16. push commit
```

> **Spec lock：** Planner johnsong @ 2026-05-06 12:50（BL-043 → BL-044 ID 重命名 — BL-043 已被 Generator 用于 deploy-staging.yml staging gap 闭合）。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段发现良性偏差按 §11 building 中段变种处理。
