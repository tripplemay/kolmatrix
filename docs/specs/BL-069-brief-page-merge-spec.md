# BL-069 Brief 页合并 (KB + Campaigns/new + AI brief 解析) — Spec

> **起草：** 2026-05-17 北京 / Planner johnsong
> **状态：** Drafted（8 决策点用户 2026-05-17 brainstorming lock；BL-068 done @ 7f40e6d + v0.9.22 沉淀 @ 9cc1d0a 后立即启动）
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 4 第一批 / ADR-013 §Decision 第 1 条 4 路由 IA + vision §2 Brief 路由定义）
> **预估工时：** 5-6 day Generator + 1 day Reviewer（含 product list 迁移 + 自然语言解析 + 老路由 redirect ops）
> **依赖：** BL-064 done ✅（4 路由 IA + 老路由 redirect 兜底 / `/brief` 顶级路由已建）+ BL-067 done ✅（runAigcAction SDK + checkLlmCostBudget + AiRecommendationPanel prewarm 模式）+ BL-068 done ✅（dedupe-then-validate + prompt v3 + 5 locale 输入策略）
> **关联：** ADR-013 §Decision 第 1 条 / vision §2 Brief 路由 + §3 场景 1 / roadmap §6 BL-069 / v0.9.22 沉淀 (BL-067 SDK + BL-068 prompt 模式)

---

## §1 背景

BL-064 完成 4 路由 IA 重做 + 老路由 redirect 兜底（`/brief` `/match` `/reach` `/insight` 顶级路由建立 + 老路由 redirect）。但 `/brief` 当前仅占位内容（KB + Campaigns/new 仍在原老路径）。本批次实装 `/brief` 实际页面内容 + 老 KB/Campaigns/new 完全 redirect。

按 ADR-013 §Decision 第 1 条 + vision §2 + §3 场景 1 画面感，`/brief` = **产品输入 + 活动创建 + AI brief 解析 + 提交后自动跳 Match 预生成**。

### vision §3 场景 1 画面感

```
1. 进 /brief (从 nav top Brief 入口)
2. 顶部 AI brief input bar: "Q2 推 Genshin Impact 给东南亚游戏受众，预算 $10K" [Generate]
3. 点击 Generate → LLM 解析 → 自动填下方表单 (markets=SEA, budget=10000 USD, target_audience='东南亚游戏受众', categories=Game)
4. 用户校对表单 → 修改 (可选) → 提交
5. 自动跳 /match?campaignId=xxx → AiRecommendationPanel 已 mount + BL-067 F005 pre-warm 已 enqueue
6. ~30s 后 top 30 KOL 带 LLM short explanation 出现
```

### 与前批次差异

| 维度 | BL-067 explainability | BL-068 refine | BL-069 brief（本批次）|
|---|---|---|---|
| 方向 | 输出端（解释 AI 推荐）| 输入端（调整 AI 推荐方向）| **前置端**（生成活动 context + 触发 AI 推荐）|
| 触发 | mount + 用户主动 query | 用户主动输入 | **用户提交 brief → 自动跳 Match + prewarm**|
| LLM 输出 | 5 locale 短/详细解释 | reorder + filter 调整 | **结构化表单字段 + 5 locale feedback**|
| 状态持久性 | asset 表 24h TTL | localStorage 24h TTL | **写 DB**（campaign + product 实体）|

### 复用 v0.9.22 沉淀（直接使用）

- `src/lib/aigc/run-action.ts` `runAigcAction<T>` SDK（BL-067 F001 沉淀）
- `src/lib/ai/cost-cap.ts` `checkLlmCostBudget` boolean 包装（BL-067 F002）
- Prompt 自检 § + 末尾 reminder 双层强化模式（BL-068 fix-round 3 v3）
- silent fallback 哲学（BL-067 + BL-068 一致）
- 5 locale JSON 输出 prompt 模式（BL-067 F001 / BL-068 F001）
- `rateLimitBatchSend (20/min/user)`（BL-034 沉淀）

---

## §2 业务目标

- `/brief` 页面实装：表单 (产品 + markets + budget + dates + target_audience) + 顶部 AI brief input bar (escape hatch) + 'Manage products' 跳 `?tab=products` sub-tab
- AI brief 解析：自然语言 brief → LLM 结构化输出（markets/budget/target_audience/categories）→ 自动填表 → 用户校对 → 提交
- 提交后自动跳 `/match?campaignId=xxx` + 后台 enqueue BL-067 F005 pre-warm worker（top 30 KOL short explanation 预生成）
- 老 KB / Campaigns/new 完全 redirect 到 `/brief` (301 永久) + 保留 deep link (`/knowledge-base/[productId]` → `/brief?tab=products&productId=xxx`)
- LLM 解析失败 → toast 'unparsable' + 保留空表单让用户手动填（与 BL-068 silent fallback 一致）
- audit_log raw brief query + parsed_filters 作 Phase 5 个性化学习训练数据基础
- cost cap 沿用 BL-034 F005 $5/day/tenant；cap 满 silent fallback 到 toast '今日 AI 额度已满' + 空表单
- 验收 gate：brief 解析成功率 ≥ 80%（mock 100 个常见输入，roadmap §11 Phase 4 沿用 Phase 3 标准）

### 不在本批次范围

- BL-070 Reach + Insight 页 + 二次清理（i18n deprecated keys / 旧路由清理）— Phase 4 第二批
- Brief 模板库（user 保存常用 brief 重用）— Phase 5 候选
- AI brief 生成完整营销 PRD（仅结构化字段，不生成 brief 文档）— Phase 5 候选
- 跨 campaign 个性化学习（用户偏好持久化）— Phase 5 候选

---

## §3 范围（7 features）

### F001 — aigcgateway `kol-brief-parse` action 注册 + 复用 BL-067 runAigcAction SDK + BL-068 prompt v3 模式

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- 创建 `kol-brief-parse` action via MCP `create_action`：
  - **Model：** `claude-haiku-4-5`（per 决策点 #5 沿用 v0.9.22 模型）
  - **Variables：** `raw_brief` / `available_products_json`（产品 list metadata：id/name/categories）/ `user_locale`
  - **Response format：** `json_object`
  - **Prompt（system，中文骨架，含 BL-068 v0.9.22 #11 prompt v3 模式：§⚠️ 自检 + 末尾 reminder）：** 要求 LLM 解析自然语言 brief → 输出 JSON `{ productId?: string, markets: string[], budget: { amount: number, currency: string } | null, target_audience: string, categories: string[], start_date?: ISO8601, end_date?: ISO8601, feedback_summary: { en, zh, ja, ko, es }, unparsable: false }`；若不可解析输出 `{ unparsable: true, reason_locale: { en, zh, ja, ko, es } }`
  - **Action ID：** 落 `.env.staging` + `.env.production` 变量 `AIGCGATEWAY_BRIEF_PARSE_ACTION_ID`（SSH ops 落地，同 BL-067/BL-068 F001 模式 5 处 sync 协议）
- MCP `run_action` dry_run 验证 prompt 渲染正确 + token 估算（实测 ceiling：≤2500 input + ≤1200 output）
- F001 commit 含 prompt 原文 + 输入/输出 schema 文档化落 `docs/specs/BL-069-F001-prompt-design.md`
- **直接复用 BL-067 F001 沉淀的 `src/lib/aigc/run-action.ts` `runAigcAction<T>` SDK**（不新建抽象层）
- **直接复用 BL-068 fix-round 3 v3 prompt 模式**（自检 § + 末尾 reminder）
- L1 PASS（无代码改动，仅 action 注册 + env 文档化）
- staging git_sha 与本 commit 一致

---

### F002 — brief-actions.ts server action — LLM 解析 + 自动填表 + audit_log

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- 新文件 `src/app/[locale]/(app)/brief/brief-actions.ts`（"use server"）含：
  - `parseBriefAction({ rawBrief, locale }): Promise<{ parsed: BriefFields | null; feedback: string; unparsable: boolean; capExhausted: boolean }>` 流程：
    1. session auth + tenant scope
    2. `checkLlmCostBudget(tenantId)` → 满 → 返回 `{ parsed: null, feedback: '', unparsable: false, capExhausted: true }` + audit_log `ai_brief.parse_cap_exhausted`
    3. `rateLimitBatchSend(userId)` → block → throw rate limit error
    4. fetch available products via withTenant RLS (per tenant 全产品 metadata)
    5. 拼装 input: `{ raw_brief, available_products_json, user_locale }`
    6. 调 `runAigcAction({ actionId: AIGCGATEWAY_BRIEF_PARSE_ACTION_ID, variables, tenantId, actionLabel: 'ai_brief.parse' })`
    7. 若 `unparsable: true` → 返回 unparsable + audit_log `ai_brief.parse_unparsable` payload { raw_brief, locale }
    8. 若 `unparsable: false` → 验 `productId` 是用户 tenant 内 product (防 LLM 幻觉跨 tenant id) → 返回 parsed fields + audit_log `ai_brief.parse_applied` payload { raw_brief, parsed_fields, locale, token_usage, cost_usd }
- audit_log shape: `logAudit({ actorId, action: 'ai_brief.parse_*', targetType: 'brief', targetId: 'draft', tenantId, after: { raw_brief?, parsed_fields?, unparsable?, locale } })`
- 3 audit action types: `ai_brief.parse_cap_exhausted` / `ai_brief.parse_unparsable` / `ai_brief.parse_applied`
- 单测 ≥6 case：success / cap 满 / unparsable / productId 跨 tenant 验证失败 / rate limit / 5 locale 输入 feedback 输出对应 locale
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F003 — `/brief` 页面 layout — 表单 + 顶部 AI brief input bar + product 选择器嵌入

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.0

**Acceptance：**
- 新文件 `src/app/[locale]/(app)/brief/page.tsx`（server component）：
  - 顶部 BriefAiInputBar 组件（client，类似 BL-068 RefineInputBar 模式）：input + 'Generate' 按钮 + Loading state 5s timeout
  - 中部 CampaignForm 组件（client）：product 选择器 (radio list, 含 'Manage products' 链 ?tab=products) + markets multi-select + budget input + dates picker + target_audience textarea
  - 提交按钮 → 调 `createCampaignFromBriefAction` (BL-066 现有 server action 复用 / 必要时扩展) → 成功 → router.push(`/match?campaignId=${newId}`)
- BriefAiInputBar 行为：
  - 点击 'Generate' → 调 F002 `parseBriefAction({ rawBrief, locale })` → loading state
  - 成功 (unparsable=false) → CampaignForm state 自动填字段（不破坏用户已填的字段：仅填空字段，已填字段保留 + 显 'AI 建议' diff hint）
  - unparsable → toast (BL-068 同模式 silent fallback) + 表单保留空 / 已填字段不变
  - capExhausted → toast '今日 AI brief 额度已满，请手动填表'
  - 5s timeout fallback → toast 'Network error'
- 单测 ≥5 case：mount 空表单 / Generate 成功 → 字段自动填 / Generate unparsable → 表单不变 + toast / Generate cap 满 → toast + 表单不变 / 已填字段不被 LLM 覆盖
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F004 — `/brief?tab=products` product list CRUD — 从 KB 迁移

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- `/brief` 页 + `?tab=products` query param 渲不同 view：
  - 默认 (无 tab / tab=campaign): F003 CampaignForm + BriefAiInputBar
  - tab=products: ProductListPanel (从 `src/app/[locale]/(app)/knowledge-base/` 迁移代码 + UI 不动)
- ProductListPanel 含: product table (name / categories / created_at / actions edit/delete) + 'New product' button → ProductFormDialog
- ProductFormDialog 复用 KB 现有 dialog（不重写，仅 import 路径切换）
- 路由切换：`/brief` ↔ `/brief?tab=products` 不重新 mount 整页（仅切换 tab content 区域 + URL state）
- 单测 ≥4 case：默认 tab 渲 CampaignForm / ?tab=products 渲 ProductListPanel / tab 切换 URL 状态保持 / ProductFormDialog 编辑 product 后 refresh list
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F005 — 提交 brief 后自动跳 `/match?campaignId` + 触发 BL-067 F005 pre-warm worker

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- F003 CampaignForm 提交流程（接 F003 提交按钮路径）：
  1. 调 `createCampaignAction({ productId, markets, budget, dates, target_audience })` (复用 BL-066 现有，若需扩字段则同 commit 加 migration)
  2. 成功 → `router.push(/match?campaignId=${newCampaign.id})`
  3. /match?campaignId mount 时（BL-065 已建）→ AiRecommendationPanel mount → smart-match → enqueue BL-067 F005 pre-warm worker（已 wire）
- 用户从 brief 提交到 /match 看到 top 30 KOL with short LLM explanation 的 end-to-end 链路连贯（流畅度 < 30s 含 prewarm）
- 不动 BL-067 F005 worker 实装（仅复用 trigger 点）
- 不动 BL-066 AiRecommendationPanel（仅复用 mount + prewarm）
- e2e 验证：提交 brief → 自动跳 /match → top 30 KOL 显（cache hit 后 reload 验 short）
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F006 — 老路由 redirect + 5 语言 i18n + e2e brief-flow.spec.ts 6 case

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- **老路由 redirect**（per 决策点 #2 完全 redirect 301）：
  - `/knowledge-base` → `/brief?tab=products` (301)
  - `/knowledge-base/[productId]` → `/brief?tab=products&productId=xxx` (301, 保留 deep link)
  - `/campaigns/new` → `/brief?action=new` (301)
  - middleware-helpers.ts 加 3 条 REDIRECT_RULES + tests/__tests__/middleware-helpers.test.ts 同步加 case
  - tests/e2e/ia-refactor-redirects.spec.ts 加 3 条 REDIRECT_CASES 验 301
- `messages/{en,zh,ja,ko,es}.json` 加 `brief.*` 完整 keys：
  - `pageTitle` / `tabCampaign` / `tabProducts` / `aiInputPlaceholder` / `generateButton` / `aiUnparsableToast` / `aiCapExhaustedToast` / `aiNetworkError` / `submitButton` / `productSelectorLabel` / `manageProductsLink` / 等
- 5 语言全 cover 不留 `_deprecated_by_*` marker（新 keys）
- 老 KB / Campaigns/new i18n keys 加 `_deprecated_by_BL-069` 子 key marker（留 BL-070 二次清理删）
- 新 `tests/e2e/brief-flow.spec.ts` 6 case：
  1. /brief 默认 tab 渲 CampaignForm + BriefAiInputBar
  2. /brief?tab=products 渲 ProductListPanel
  3. AI brief Generate 成功 → 表单自动填 + toast feedback
  4. AI brief unparsable → toast + 表单保留空
  5. 提交表单 → 自动跳 /match?campaignId 验 URL
  6. 老路由 redirect: /knowledge-base → /brief?tab=products (301 verify) + /campaigns/new → /brief?action=new (301)
- L1 PASS（lint + tsc + vitest + e2e）
- staging git_sha 与本 commit 一致

---

### F007 — staging deploy + 视觉 baseline + 24h cost 监控 + signoff prep

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- staging deploy via `deploy-staging.yml`（含 `AIGCGATEWAY_BRIEF_PARSE_ACTION_ID` 新 env var via SSH 落 `.env.staging`，与 prod 配齐 sync 协议）
- 视觉 baseline regen via `update-visual-baselines` workflow：
  - `en-brief.png` 新生成（含 BriefAiInputBar + CampaignForm）
  - `en-brief-products.png` 新生成（?tab=products view）
- Planner 在 building 后期出 staging dogfood 清单：≥10 个 brief query 实测（覆盖 markets / budget / target_audience / locale 4 维度）+ ≥3 个 unparsable case + cap 满模拟（mock $5 cost）+ 端到端: brief → submit → /match prewarm hit 链路，commit 落 `docs/test-reports/BL-069-staging-spot-check.md`
- 24h aigcgateway dashboard cost 监控：daily total cost ≤ 团队 dogfood 实际 cost × 1.5
- `scripts/bl069-cost-audit.ts` 拉 audit_log type='ai_brief.parse_*' 24h 累计 cost / token / call 数报告 + parse success rate（≥80% gate per roadmap §11 Phase 4 沿用 Phase 3 标准）
- `docs/test-reports/BL-069-signoff-2026-05-XX.md` Reviewer 写最终结论：parse success rate ≥80% + cost 在 cap 内 + 5 locale 全绿 + 6 e2e PASS + 老路由 redirect 验证
- Reviewer 复验全部 acceptance + signoff，progress.json `status: reverifying → done`

---

## §4 关键决策点（brainstorming 2026-05-17 lock）

| # | 决策点 | 用户 ack | 影响 |
|---|---|---|---|
| #1 | spec 成熟度 | **A: ready-to-build** | spec 立即可进 building，不等 BL-067/BL-068 prod dogfood |
| #2 | 路径策略 | **A: 完全 redirect 301** | F006 加 3 条 REDIRECT_RULES (/knowledge-base /knowledge-base/[id] /campaigns/new) |
| #3 | AI brief 范围 | **A: 表单字段解析 + KOL prewarm** | F002 LLM 解析 + F005 提交后自动跳 /match + 复用 BL-067 F005 prewarm worker |
| #4 | UI 形态 | **A: 表单优先 + 顶部 AI brief input bar (escape hatch)** | F003 layout 形态锁 (vision §3 场景 1 画面感) |
| #5 | 基础设施复用 | **全 ack**：haiku-4.5 + runAigcAction + checkLlmCostBudget + prompt 自检 + silent fallback + 5 locale + rateLimitBatchSend + 3 audit action types | F001 + F002 复用 BL-067/BL-068 v0.9.22 沉淀 |
| #6 | product list 位置 | **A: 表单内嵌 product 选择器 + 'Manage products' 跳 ?tab=products** | F003 form + F004 tab 子页 |
| #7 | 错误边界 | **A: Toast unparsable + 保留空表单**（自动 lock 同 BL-068 模式） | F002 + F003 silent fallback + audit_log refine_unparsable |
| #8 | audit log Phase 5 数据 | **A: 记 raw brief 作 Phase 5 学习数据基础**（自动 lock 同 BL-068 #6） | F002 audit_log payload 含 raw_brief + parsed_fields |

---

## §5 不变量（Generator 落地必查）

1. **cost cap 复用 BL-034 F005 via BL-067 包装**：F002 调 `src/lib/ai/cost-cap.ts` `checkLlmCostBudget`；不新增 cap 计算代码；与 outreach + BL-067 explainability + BL-068 refine 共享同一 $5/day/tenant 配额
2. **runAigcAction SDK 复用**：F001 action 注册后 F002 caller 走 `runAigcAction<T>`，不 inline POST aigcgateway
3. **Prompt 自检 § + 末尾 reminder 双层强化**：F001 prompt 必含 §⚠️ '输出前自检' + 末尾 reminder（BL-068 v0.9.22 #11 模式）
4. **silent fallback 不破 UI**：cap 满 / unparsable / network error 全保留表单不变（仅 toast 提示），与 BL-067/BL-068 一致
5. **productId 跨 tenant 验证**：F002 必验 LLM 输出 `productId` 是用户 tenant 内 product（withTenant RLS）；防 LLM 幻觉跨 tenant 引用；不通过则降级 unparsable
6. **不覆盖用户已填字段**：F003 BriefAiInputBar Generate 成功后仅填空字段，已填字段保留（用户先手填部分 + AI 补完模式）+ 显 'AI 建议' diff hint
7. **audit_log raw brief 全文**：F002 audit_log payload 必含 raw_brief 全文（不脱敏 — Phase 5 个性化学习训练数据需要）
8. **老路由 deep link 保留**：`/knowledge-base/[productId]` redirect 到 `/brief?tab=products&productId=xxx` 保 deep link（不仅是 path redirect）
9. **rate limit 复用 rateLimitBatchSend 20/min/user**：F002 调 BL-034 现有 rate limit
10. **5 locale LLM 输出本地化**：F001 prompt 要求 LLM 输出 `feedback_summary` + `reason_locale` 5 locale 同时返回（1 次 call 5 locale 同 BL-067/BL-068 模式）
11. **提交后自动跳 /match 链路连贯**：F005 router.push 自动跳 + BL-067 F005 prewarm worker mount trigger 已 wire（不动 BL-066/BL-067 实装）

---

## §6 cost 估算与风险

### Cost 估算（per v0.9.22 #2:A flat $0.01/call meter view）

| 场景 | 调用次数 | meter（flat $0.01/call）| 真实 token spend（haiku-4.5 ~$0.0015/call）|
|---|---|---|---|
| F002 brief parse 单次 | 1 call | $0.01/parse | $0.0015/parse |
| 每用户 day（5 brief/day）| 5 calls | $0.05/day | $0.008/day |
| **5 用户团队 day** | 25 calls | **$0.25/day** | $0.04/day |
| BL-067 prewarm 提交后自动触发 | 30 calls/campaign × 5 campaign | $1.50/day | $0.27/day |
| **每 day 全 BL-069 链路合计** | 175 calls | **$1.75/day** | $0.31/day |
| vs $5/day/tenant cap | — | **35% 利用率** | — |

**关键判断**：BL-069 + BL-067 prewarm 链路 cost 仍远低于 cap，与 outreach + BL-068 共享 cap 后总计 < $3/day/tenant。

### 风险表

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 解析成功率 < 80%（roadmap §11 Phase 4 沿用 Phase 3 gate）| 中 | 高 | F006 e2e 100 mock query 测试；< 80% 则 prompt 调优 fix-round / F003 错误边界友好引导 |
| LLM 幻觉跨 tenant productId | 低 | 中 | F002 §5 不变量 #5 严格验 + audit_log refine_unparsable + dedupe-then-validate (v0.9.22 #10 模式) |
| 老 KB 用户书签失效 | 中 | 中 | F006 deep link 保留 (/knowledge-base/[id] → /brief?tab=products&productId=xxx)；redirect 301 + 1 个月监控 redirect rate |
| /brief 与 /brief?tab=products 状态丢失 | 低 | 低 | F004 tab 切换仅切 content 区域 (不重新 mount 整页) + URL state 持久 |
| AI 建议覆盖用户已填字段 | 中 | 中 | F003 §5 不变量 #6 仅填空字段 + 显 diff hint |
| 提交后跳 /match 但 prewarm 未 ready | 中 | 低 | BL-067 F005 prewarm 已 fire-and-forget + mount self-heal mitigate (v0.9.22 #5 模式)；用户进 /match 30s 内 short 应 ready |

---

## §7 下一批后续

- **BL-070** Reach + Insight 页适配新 IA + 二次清理（i18n deprecated keys / 旧路由清理 / nav 旧 key / customize.ts/topic-cloud.ts 迁移到 runAigcAction / KB / Campaigns/new 完全删除）— Phase 4 第二批
- **Phase 5 候选**（不在 6-10 周硬上线范围）：
  - Brief 模板库（user 保存常用 brief）
  - AI brief 生成完整营销 PRD（不仅结构化字段，生成 brief 文档）
  - 跨 campaign 个性化学习（用户偏好 → AI brief 默认值预填）
  - skip/replace + refine 状态升级写 DB（作为 Phase 5 学习数据基础）
  - comparative query（"为什么这个 product 推荐这个 market？"）

---

## References

- ADR-013-ai-native-product-pivot §Decision 第 1 条（4 路由 IA）
- docs/product/ai-native-vision.md §2 Brief 路由 / §3 场景 1 / §8 划界
- docs/product/ai-native-roadmap.md §6 BL-069 / §11 Phase 4 verifying gate
- docs/specs/BL-064-... + BL-066/BL-067/BL-068 spec（IA + AiRecommendationPanel + prewarm + refine 沉淀依赖）
- framework/archive/proposed-learnings-archive-v0.9.22.md（runAigcAction SDK + prompt v3 + dedupe + silent fallback 模式直接复用）
- src/lib/aigc/run-action.ts（BL-067 F001 沉淀 SDK）
- src/lib/ai/cost-cap.ts:133 `checkLlmCostBudget`（BL-067 F002 沉淀）
- src/app/[locale]/(app)/campaigns/[id]/refine-actions.ts（BL-068 F002 dedupe-then-validate 模式参考）
