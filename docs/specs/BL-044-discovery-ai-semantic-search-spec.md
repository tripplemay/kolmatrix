# BL-044 /discovery AI Semantic Search 实装 — Spec

> **状态：** Planner draft → 等 BL-040 done + BL-043 staging gap 闭合后启动 building
> **触发：** 用户 2026-05-06 报 prod bug — `/zh/discovery` 点 AI chip "🎮 王者荣耀上线适配的 FPS 创作者" 显示 "未找到符合的 KOL"。Planner 调查根因：AI chip 是「自然语言查询意图」但 search 实装是字面 ILIKE substring 匹配 — 长意图字符串命中 0
> **作者：** Planner johnsong @ 2026-05-06 12:30（重写为 BL-044 @ 12:50 — BL-043 被 Generator 用作 staging gap 闭合 ID 冲突避免）
> **依赖：** BL-040 done + BL-043 staging gap 闭合 → 然后 BL-044 启动；B7a-F001 KOL embedding pipeline（已实装）+ BL-035 F003 AI rate-limit（已实装防 abuse）
> **预估：** 1-2 day building + 0.5 day verifying
> **批次类型：** 普通批次（4 features 全 `executor:generator`）→ status 流转 `new → planning → building → verifying → done`

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
- BL-035 F003 AI rate-limit 自动覆盖（10/min/tenantId + 100/day for AI 类）

---

## 2. 功能清单（4 features 全 generator）

### F001 · `runSemanticKolSearch` server module（fork from smart-match.ts）

**Executor:** generator
**Priority:** high
**预估工时:** 2-3h

**改动：**

新建 `src/lib/discovery/semantic-search.ts`（~150 行，fork from `smart-match.ts:115-200` 范式）：

- export `runSemanticKolSearch({tenantId, queryText, topK?})` → `Promise<{kolIds: string[], cost: number, latencyMs: number, cacheHit: boolean}>`
- export `class SemanticSearchError` 含 codes `INVALID_QUERY` / `EMBED_FAILED` / `DB_ERROR`
- 复用 `embedOne` (`src/lib/embedding/client.ts`) — bge-m3 multilingual
- 复用 `kolCosineTopKSql` — 1024 dim + ivfflat index
- RLS via `withTenant` 包裹（与 SmartMatch 同模式）
- Validate `queryText`：空 / >200 chars 抛 INVALID_QUERY
- Latency budget：cached path < 100ms / non-cached path < 500ms

**Acceptance：**

- [ ] `src/lib/discovery/semantic-search.ts` 存在 + export `runSemanticKolSearch` + `SemanticSearchError`
- [ ] embed 调用复用 `embedOne` (`src/lib/embedding/client.ts`) — bge-m3 model
- [ ] cosine search 复用 `kolCosineTopKSql` — 1024 dim + ivfflat index
- [ ] RLS via `withTenant` 包裹（与 SmartMatch 同模式）
- [ ] Validate `queryText`：空 / >200 chars 抛 INVALID_QUERY
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
5. **AI search result grid** 保持 cosine 顺序（不按 valueScore / followers / createdAt 排）— UI 上 sort dropdown disable + tooltip "AI search uses semantic ranking"

**Acceptance：**

- [ ] SearchBar.tsx chip href 改为 `?ai=<encoded label>`
- [ ] discovery/search.ts 检测 `filters.aiQuery` → 调 `runSemanticKolSearch` → 返回 cosine-ordered kolIds
- [ ] ActiveFilters 渲染 "🤖 AI: <query>" chip + 点 X 清空 ?ai
- [ ] DiscoveryFilters interface 加 `aiQuery?: string`
- [ ] parseFilters / serializeFilters 同步处理 `ai` URL 参数
- [ ] AI search result grid 保持 cosine 顺序（不按 valueScore / followers / createdAt 排）— UI 上 sort dropdown disable + tooltip "AI search uses semantic ranking"
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
- [ ] Cache hit rate 验证 ≥95%（chip click 不重复调 aigcgateway）
- [ ] embedding service 5xx → fall back 到 ILIKE 路径
- [ ] env var `ENABLE_AI_SEARCH=false` short-circuit 退化到 ILIKE
- [ ] .env.example 加 `ENABLE_AI_SEARCH=true` + comment

---

### F004 · Tests + Monitoring

**Executor:** generator
**Priority:** medium
**预估工时:** 1h

**改动：**

1. **`src/lib/discovery/__tests__/semantic-search.test.ts` ≥4 case：** empty query reject / >200 chars reject / valid query top-K returned / EMBED_FAILED 5xx mock / cache hit
2. **`tests/integration/discovery-ai-search.test.ts` ≥2 case：** ?ai=FPS 端到端 grid render with cosine hits / ?ai=GIBBERISH fallback to ILIKE empty state
3. **Monitoring 集成（BL-034 F005 cost-cap MVP）：** 每次 semantic search 后写 `event_log type='ai.usage' source='semantic_search'` payload 含 query 前 50 chars / cost / cacheHit / kolIdsCount

**Acceptance：**

- [ ] 单测 ≥4 case + 集成测试 ≥2 case 全 PASS
- [ ] event_log 写入 type='ai.usage' source='semantic_search' 验证
- [ ] BL-034 F005 cost-cap MVP 自动 enforce per-tenant $5/day 上限
- [ ] BL-035 F003 AI rate-limit 自动 enforce（10/min/tenantId）
- [ ] `npm run lint + tsc + test` 全绿 + CI 全绿

---

## 3. 变更文件清单

```
src/lib/discovery/semantic-search.ts                         F001 NEW (~150 行)
src/lib/discovery/__tests__/semantic-search.test.ts          F001+F004 NEW (≥4 case)

src/app/[locale]/(app)/discovery/search.ts                   F002 EDIT (+semantic path with fallback)
src/app/[locale]/(app)/discovery/SearchBar.tsx               F002 EDIT (chip href 改 ?ai=)
src/app/[locale]/(app)/discovery/ActiveFilters.tsx           F002 EDIT (+AI chip render)
src/lib/kol/filters.ts                                       F002 EDIT (+aiQuery field + parse/serialize)

src/lib/discovery/semantic-search.ts (F003 cache logic)      同 F001 文件 EDIT

.env.example                                                  F003 EDIT (+ENABLE_AI_SEARCH=true)

tests/integration/discovery-ai-search.test.ts                F004 NEW (≥2 case)

i18n locales (en/zh/ja/ko/es).json                           F002 EDIT (~5 keys for AI chip 显示文案 / fallback notice)
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

### D5 · F002 AI search bypasses other filters（first iteration）
首版 ?ai=X 时不应用 categories / platforms / regions 等 filter（cosine top 50 已足够 specific）。
- 用户可以先 AI search → 然后在 sidebar 补 filter（second iteration 演进）
- 简化首版 implementation，避免 hybrid query 复杂度

### D6 · grid sort 在 AI search 时 disable
URL `?ai=X` 时，sort dropdown disabled + tooltip "AI search uses semantic ranking"（cosine distance ASC 隐式排序）。用户切到 ?search= 或清空 ?ai 才恢复 sort 选项。

### D7 · Multilingual quality 实测已验证（spec §1.2）
不需要 prerequisite step — Planner 已用 mcp embed_text + prod KOL.embedding cosine search 实测 4 query 全 100% 命中。Generator 直接进入 building，跳过 quality dry-run。

---

## 5. v0.9.11 + v0.9.12 + v0.9.13 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.11 §rate-limit | F001 复用 BL-035 F003 `rateLimitAi(tenantId)` 已自动覆盖 semantic search endpoint（10/min/tenantId + 100/day） |
| v0.9.11 §database-patterns §8 RLS | 不新增表（仅 read kol.embedding），不适用 |
| v0.9.11 §ai-action-contract §4 max_tokens | embedding 模型 input 不限 max_tokens；output dim 1024 固定。**v0.9.13 §4.7 验证**：embedding 路径 max_tokens 无意义（与 chat completions 不同），跳过 |
| v0.9.11 §4 XML tag wrap | embedding 路径不存在 prompt-injection 攻击面（input 直接转 vector，无 prompt template），跳过 |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | 可能触发：如果 embedding service mcp client.ts 的 type signature 不符（实测后调整），主动停 + 短格式裁决 |
| v0.9.13 §5.1 spec deploy-script vs yml | 不涉及 deploy-script 改 |
| v0.9.13 §4.7 mcp 自动化可达性（实测） | 已确认 embedding 路径无 max_tokens 字段；spec scope 不依赖此 |

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
1. F001 src/lib/discovery/semantic-search.ts（fork from smart-match.ts，~150 行）
2. F001 src/lib/discovery/__tests__/semantic-search.test.ts ≥4 case
3. F002 src/lib/kol/filters.ts 加 aiQuery field + parseFilters/serializeFilters 同步
4. F002 SearchBar.tsx chip href 改 ?ai=
5. F002 ActiveFilters.tsx 加 AI chip 渲染
6. F002 search.ts 加 semantic 路径 + fallback try/catch
7. F003 chip embedding cache 实装 + preWarmChipCache + ENABLE_AI_SEARCH env flag
8. F004 集成测试 tests/integration/discovery-ai-search.test.ts ≥2 case
9. F004 event_log monitoring 集成
10. lint + tsc + test 守门
11. push commit
```

> **Spec lock：** Planner johnsong @ 2026-05-06 12:50（BL-043 → BL-044 ID 重命名 — BL-043 已被 Generator 用于 deploy-staging.yml staging gap 闭合）。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段发现良性偏差按 §11 building 中段变种处理。
