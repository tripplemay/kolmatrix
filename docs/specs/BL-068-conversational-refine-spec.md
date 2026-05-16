# BL-068 Conversational Refine B3 — Spec

> **起草：** 2026-05-16 北京 / Planner johnsong
> **状态：** Drafted（8 决策点用户 2026-05-16 brainstorming lock；BL-067 done @ 45de7d9 后立即启动）
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 3 第二批 / ADR-013 §Decision 第 4 条 B3 混合 AI 交互形态）
> **预估工时：** 4 day Generator + 1 day Reviewer（大量复用 BL-067 沉淀的 SDK / cost-cap / UI 框架）
> **依赖：** BL-067 done ✅（runAigcAction SDK + checkLlmCostBudget + AiRecommendationPanel C3 升级 prod ready）
> **关联：** ADR-013 §Decision 第 4 条 / vision §3 场景 3 + §7 原则 3 "Refine over Filter" / roadmap §5 BL-068 / BL-067 spec §下一批后续

---

## §1 背景

BL-066 完成 `/campaigns/[id]` AI native 主面板 + BL-067 完成双向 explainability。当前 AI 推荐 top 30 候选默认按 valueScore desc 排序，用户可 accept / skip / show next 5，但**无法表达"为什么不喜欢这批 + 我想要什么样的"**。

按 ADR-013 §Decision 第 4 条 + vision §7 原则 3 "Refine over Filter — 自然语言 refine 是一等公民，filter 推子是 fallback"，本批次实装 **B3 混合 AI 交互形态**：

- 默认结构化面板（filter + AI 排序）保留
- 用户可用**自然语言 refine 作 escape hatch**：在 input bar 输入 "减少 micro tier，多加女性受众" → LLM 解析为 reorder 指令 → 重排 top 30 现池
- LLM 输出 toast feedback（"重排后：女性占比 +12%，micro tier -8%"）让用户验证

### vision §3 场景 3 画面感

```
当前推荐池：30 个 (按 valueScore 排)
─────────────────────────────────────
[ Refine with AI：减少 micro tier，多加女性受众        ] [Refine]  [Reset to AI default]
                                      ↑
            用户输入 → LLM 解析 → 重排现池 30 KOL
─────────────────────────────────────
🔔 已重排：女性占比 +12% / micro tier -8%
─────────────────────────────────────
新顺序的 top 30 KOL 卡片（顶部 5 个变化最明显）
```

### 与 BL-067 关键差异

| 维度 | BL-067（已 done）| BL-068（本批次）|
|---|---|---|
| 方向 | **输出端**：解释 AI 为何推荐（C3 双向 explainability）| **输入端**：用户用自然语言调整 AI 推荐方向（B3 混合 refine）|
| 触发 | mount 自动 pre-warm + 用户主动点 `?` icon | **用户主动输入 + 点 Refine 按钮**|
| LLM 输出 | 5 locale × 1 句话短解释 / 5 段详细 | **reorder 指令（KOL IDs 排序）+ toast feedback**|
| pool 影响 | 不变（仅装饰）| **重排（pool 内 KOL 顺序变化）**|
| 状态持久性 | asset 表 24h TTL（per campaign+kol+locale）| **localStorage 24h TTL（per tenant+campaign）**|
| 数据基础 | — | **audit_log raw query + parsed filters → Phase 5 个性化学习输入**|

### 复用 BL-067 沉淀的基础设施

- `src/lib/aigc/run-action.ts` `runAigcAction<T>` SDK（直接复用）
- `src/lib/ai/cost-cap.ts` `checkLlmCostBudget` boolean 包装（直接复用）
- `rateLimitBatchSend` 20/min/user（直接复用）
- 5 locale i18n 模式 + LLM 输出本地化反馈（继承 BL-067 模式）
- AiRecommendationPanel UI 框架（在其顶部插 RefineInputBar）

---

## §2 业务目标

- AiRecommendationPanel（`/campaigns/[id]`）+ Match 工作台 `?campaignId` mode（`/match?campaignId=...`）顶部加 RefineInputBar — 用户输入自然语言 → LLM 解析 → 重排 top 30 现池
- LLM 输出 toast feedback（"重排后：女性占比 +12%，micro tier -8%"）让用户验证
- "Reset to AI default" 按钮一键还原原始 valueScore desc 排序
- Refine 状态 stateful：写 localStorage 24h TTL（per tenant+campaign），跨页面刷新保留
- LLM 解析失败 → toast "无法理解，请尝试更具体" + 保留现池不动 + audit_log 记 `refine_unparsable`
- audit_log 每次 refine = 1 行（raw query + parsed_filters + result_kol_ids + user_locale）作 Phase 5 个性化学习输入
- cost cap 沿用 BL-034 F005 $5/day/tenant；cap 满 silent fallback 到 toast '今日额度已满' + 保留现池
- 验收 gate（roadmap §11 Phase 3）：自然语言 refine 成功解析率 ≥ 80%（mock 100 个常见输入）

### 不在本批次范围

- BL-069 Brief 页合并（KB + Campaigns/new）— Phase 4 第一批
- BL-070 Insight 页 unify + 二次清理（i18n deprecated keys / 旧路由）— Phase 4 第二批
- 重新调 smart-match endpoint（refine 仅重排现池，不越出 pool；vision §3 场景 3 重排上限 = 现池 30 KOL 上限）
- 完整对话式 chatbot UI（vision §8 划界 — refine 是 escape hatch 不是全局聊天）
- comparative query（"为什么 @kol45 排在第十位"）— Phase 5 候选
- 个性化学习（捕获接受/拒绝信号 → valueScore 权重调整）— Phase 5 候选
- skip/replace 状态升级写 DB — Phase 5 候选

---

## §3 范围（7 features）

### F001 — aigcgateway `kol-refine-natural-language` action 注册 + 复用 BL-067 runAigcAction SDK

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- 创建 `kol-refine-natural-language` action via MCP `create_action`：
  - **Model：** `claude-haiku-4-5`（per 决策点 #7 沿用 BL-067 模型）
  - **Variables：** `raw_query` / `current_pool_json`（top 30 KOL metadata：id/name/followerCount/engagementRate/categories/audience_breakdown）/ `user_locale`
  - **Response format：** `json_object`
  - **Prompt（system，中文骨架）：** 要求 LLM 解析自然语言 refine 指令 → 输出 JSON `{ ordered_kol_ids: string[30], parsed_filters: { tier?, audience_gender?, categories?, locale?, ... }, feedback_summary: { en: '...', zh: '...', ja: '...', ko: '...', es: '...' }, unparsable: false }`；若不可解析输出 `{ unparsable: true, reason_locale: { en: '...', zh: '...', ... } }`
  - **Action ID：** 落 `.env.staging` + `.env.production` 变量 `AIGCGATEWAY_REFINE_ACTION_ID`（SSH ops 落地，同 BL-067 F001 模式）
- MCP `run_action` dry_run 验证 prompt 渲染正确 + token 估算（实测 ceiling：≤3000 input + ≤1500 output；input 30 KOL JSON 较大需 prompt 字段裁剪）
- F001 commit 含 prompt 原文 + 输入/输出 schema 文档化落 `docs/specs/BL-068-F001-prompt-design.md`
- **直接复用 BL-067 F001 沉淀的 `src/lib/aigc/run-action.ts` `runAigcAction<T>` SDK**（不新建抽象层；F002 caller 调 `runAigcAction({ actionId: AIGCGATEWAY_REFINE_ACTION_ID, variables, tenantId, actionLabel: 'ai_recommendation.refine' })`）
- L1 PASS（无代码改动，仅 action 注册 + env 文档化；如 prompt 单测则同 commit 加）
- staging git_sha 与本 commit 一致

---

### F002 — refine-actions.ts server action（LLM 解析 + 重排逻辑 + audit_log）

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- 新文件 `src/app/[locale]/(app)/campaigns/[id]/refine-actions.ts`（"use server"）含：
  - `applyRefineAction({ campaignId, rawQuery, currentPool, locale }): Promise<{ orderedKolIds: string[]; feedback: string; unparsable: boolean; capExhausted: boolean }>` 流程：
    1. `checkLlmCostBudget(tenantId)` → `{ allowed: false }` → 返回 `{ orderedKolIds: currentPool.map(k=>k.id), feedback: '', unparsable: false, capExhausted: true }` + audit_log `ai_recommendation.refine_cap_exhausted`
    2. `rateLimitBatchSend(tenantId, userId)` → block → throw rate limit error
    3. 拼装 input: `{ raw_query, current_pool_json: JSON.stringify(top30 metadata 限定字段), user_locale }`
    4. 调 `runAigcAction({ actionId: AIGCGATEWAY_REFINE_ACTION_ID, variables, tenantId, actionLabel: 'ai_recommendation.refine' })` → 解析 JSON
    5. 若 `unparsable: true` → 返回 `{ orderedKolIds: currentPool.map(k=>k.id), feedback: parsed.reason_locale[locale], unparsable: true, capExhausted: false }` + audit_log `ai_recommendation.refine_unparsable` payload { raw_query, locale }
    6. 若 `unparsable: false` → 验 `ordered_kol_ids` 是 `currentPool.map(k=>k.id)` 的 permutation（防 LLM 幻觉新增/缺失 KOL）→ 返回 `{ orderedKolIds: parsed.ordered_kol_ids, feedback: parsed.feedback_summary[locale], unparsable: false, capExhausted: false }` + audit_log `ai_recommendation.refine_applied` payload { raw_query, parsed_filters, result_kol_ids: parsed.ordered_kol_ids, locale, token_usage, cost_usd }
- audit_log shape: `logAudit({ actorId, action, targetType: 'campaign', targetId: campaignId, tenantId, after: { raw_query?, parsed_filters?, result_kol_ids?, unparsable?, locale } })`
- Rate limit 沿用 `rateLimitBatchSend (20/min/user)`（per 决策点 #7）
- 单测 ≥6 case：success / cap 满返回 capExhausted=true / unparsable=true / LLM permutation 验证失败 (LLM 幻觉新增 KOL) / rate limit / 5 locale 输入 feedback 输出对应 locale
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F003 — RefineInputBar 组件 + AiRecommendationPanel 集成 + localStorage 24h TTL

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- 新组件 `src/app/[locale]/(app)/campaigns/[id]/RefineInputBar.tsx`（"use client"）：
  - Props：`{ campaignId, tenantId, currentPool, locale, onRefineApplied: (newOrder: string[]) => void, onReset: () => void }`
  - UI：inline 横向 input bar（placeholder 取自 i18n `campaigns.detail.refine.inputPlaceholder`）+ "Refine" button（i18n `campaigns.detail.refine.applyButton`）+ "Reset to AI default" button（i18n `campaigns.detail.refine.resetButton`，refine state 存在时才显）+ inline toast feedback area（refine 后显反馈 + dismiss button）
  - 点击 "Refine" → 调 server action `applyRefineAction` → loading state 5s timeout fallback → 成功则 call `onRefineApplied(newOrder)` + 显 feedback toast + 写 localStorage cache
  - 点击 "Reset to AI default" → call `onReset()` + 清 localStorage cache + 隐藏 Reset button
- AiRecommendationPanel 升级（BL-066 F003 + BL-067 F003 的延续）：
  - mount 时读 localStorage `refine-{tenantId}-{campaignId}` cache（TTL 24h via createdAt timestamp 字段）
  - cache hit → 按 cache 中 orderedKolIds 重排 top30 现池 + 显 "Reset to AI default" 按钮 + 显 last feedback toast
  - cache miss → 按 valueScore desc 默认排序（保持 BL-066 现状）
  - `onRefineApplied` 实现：更新 panel state orderedKolIds + 写 localStorage + 显 feedback toast
  - `onReset` 实现：清 panel state orderedKolIds + 清 localStorage + 重新按 valueScore desc 排
- localStorage cache shape: `{ orderedKolIds: string[], feedback: string, rawQuery: string, createdAt: ISO8601 }`，key=`refine-{tenantId}-{campaignId}`
- 不破坏 BL-066 F003 + BL-067 F003 现有 e2e（accept / skip / show-next / `?` icon dialog）
- 单测 ≥5 case：mount cache hit 重排 / cache miss 默认排序 / Refine 按钮调 server action + 写 cache / Reset 按钮清 cache + 默认排序 / cache TTL boundary (>24h)
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F004 — Match 工作台 `?campaignId` mode 复用 RefineInputBar（per 决策点 #2 两处生效）

**Executor：** generator
**Priority：** high
**Estimated hours：** 3.0

**Acceptance：**
- 升级 `/match?campaignId=xxx` mode（BL-065 实装）：
  - smart-match sidebar 上方加 RefineInputBar（复用 F003 组件，不新建）
  - props 同 F003：`{ campaignId, tenantId, currentPool, locale, onRefineApplied, onReset }`
  - localStorage cache key 复用 `refine-{tenantId}-{campaignId}` — 跨 `/match` ↔ `/campaigns/[id]` 一致 state
- 用户在 `/match?campaignId=A` refine 后切到 `/campaigns/A` → AiRecommendationPanel mount 读到同 cache → 显同样 refine pool（验证 cache 一致性）
- 非 `?campaignId` mode（普通 Match 工作台搜索）**不**显示 RefineInputBar（因无 pool context）
- 单测 ≥3 case：?campaignId mode 显 RefineInputBar / 非 ?campaignId mode 不显 / cache 跨页一致性
- 不破坏 BL-065 现有 e2e
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F005 — 错误边界 + LLM permutation 验证 + audit_log refine_unparsable

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- F002 server action 已含 unparsable + capExhausted 路径处理，本 feature 主聚焦 client-side 错误边界 + 验证强化：
  - F002 permutation 验证逻辑：`ordered_kol_ids` 必须是 `currentPool.map(k=>k.id)` 的 strict permutation（同集合 + 无重复 + 长度相等），LLM 幻觉新增/缺失 KOL 时 fallback 到 unparsable + audit_log `refine_permutation_invalid` payload { raw_query, expected_ids_count, returned_ids_count, missing_ids, extra_ids }
  - F003 RefineInputBar 错误状态 UI：unparsable toast 显 LLM 解释（per locale）+ raw query 保留 input 让用户修改重试；capExhausted toast 显 `campaigns.detail.refine.capExhaustedToast`；网络 5xx timeout toast 显 `campaigns.detail.refine.networkError`
  - 5s timeout：Refine 按钮 loading 5s 后 fallback timeout toast（per BL-067 F004 同模式）
- 5 locale 错误文案全 cover（en/zh/ja/ko/es）
- 单测 ≥5 case（在 F002 + F003 单测基础上加）：permutation 不匹配 fallback / unparsable 保留 input / 5s timeout fallback / network error / 5 locale 错误文案显对应 locale
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F006 — 5 语言 i18n + e2e campaign-refine-flow.spec.ts 6 case

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- `messages/{en,zh,ja,ko,es}.json` 加 `campaigns.detail.refine.*` 完整 keys：
  - `inputPlaceholder` — input bar 占位文案（例 "Try: 减少 micro tier, 多加女性受众"）
  - `applyButton` — "Refine" 按钮文案
  - `resetButton` — "Reset to AI default" 按钮文案
  - `loading` — Refine 进行中 loading 文案
  - `feedbackPrefix` — feedback toast 前缀（如 "已重排：" / "Reranked: "）
  - `unparsableToast` — LLM 解析失败 toast 文案（含 reason 占位）
  - `capExhaustedToast` — cost cap 满 toast 文案
  - `networkError` — 5s timeout / 网络 5xx 文案
  - `permutationInvalid` — LLM permutation 验证失败 toast（罕见但需 cover）
- 5 语言全 cover 不留 `_deprecated_by_*` marker（新 keys）
- 新 `tests/e2e/campaign-refine-flow.spec.ts` 6 case：
  1. RefineInputBar mount on /campaigns/[id] + /match?campaignId 两处 / panel mount 默认无 cache → input bar 显但 Reset 隐藏
  2. Refine 成功路径 → pool 重排 + feedback toast + Reset button 显
  3. Refine unparsable → toast 显 LLM 解释 + pool 不变 + raw query 保留
  4. Refine cap 满 → capExhaustedToast 显 + pool 不变
  5. Reset to AI default → pool 回 valueScore desc + Reset 隐藏 + localStorage 清
  6. localStorage 24h TTL boundary → cache >24h reload 后默认排序
- L1 PASS（lint + tsc + vitest + e2e）
- staging git_sha 与本 commit 一致

---

### F007 — staging deploy + 视觉 baseline + 24h cost 监控 + signoff prep

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- staging deploy via `deploy-staging.yml`（含 `AIGCGATEWAY_REFINE_ACTION_ID` 新 env var via SSH 落 `.env.staging`，与 prod 配齐 sync 协议）
- 视觉 baseline regen via `update-visual-baselines` workflow：
  - `en-campaign-detail.png` 必新生成（含 RefineInputBar）
  - `en-match-with-campaign.png` 新增（Match 工作台 ?campaignId mode 含 RefineInputBar）
- Planner 在 building 后期出 staging dogfood 清单：≥10 个 refine query 实测（覆盖 tier / audience / category / locale 4 维度）+ ≥3 个 unparsable case 测错误边界 + cap 满模拟（mock $5 cost）测 silent fallback，commit 落 `docs/test-reports/BL-068-staging-spot-check.md`
- 24h aigcgateway dashboard cost 监控：daily total cost ≤ 团队 dogfood 实际 cost × 1.5
- `scripts/bl068-cost-audit.ts` 拉 audit_log type='ai_recommendation.refine_*' 24h 累计 cost / token / call 数报告 + parse success rate（≥80% gate per roadmap §11）
- `docs/test-reports/BL-068-signoff-2026-05-XX.md` Reviewer 写最终结论：parse success rate ≥80% + cost 在 cap 内 + 5 locale 全绿 + 6 e2e PASS
- Reviewer 复验全部 acceptance + signoff，progress.json `status: reverifying → done`

---

## §4 关键决策点（brainstorming 2026-05-16 lock）

| # | 决策点 | 用户 ack（2026-05-16）| 影响 |
|---|---|---|---|
| #1 | spec 成熟度 | **A: ready-to-build**（lock 全部 8 决策点）| spec 立即可进 building，不等 BL-067 prod dogfood |
| #2 | 生效路径范围 | **A: `/campaigns/[id]` + `/match` 两处** | F003 + F004 双重集成 |
| #3 | Refine 输出形态 | **A: 重排现 top 30** | F002 重排逻辑 / 不重调 smart-match / cost 低响应快 / 受现池上限约束（30 KOL pool）|
| #4 | 错误边界 fallback | **A: Toast 'unparsable' + 保留现池** | F002 + F003 + F005 unparsable 路径 + audit_log refine_unparsable |
| #5 | 状态持久性 | **A: Stateful + localStorage 24h TTL** | F003 localStorage cache + Reset to AI default 一键还原 |
| #6 | audit log Phase 5 数据 | **A: 记 raw query 作 Phase 5 学习数据基础** | F002 audit_log payload 含 raw_query + parsed_filters + result_kol_ids |
| #7 | 基础设施复用 | **全 ack**：haiku-4.5 + checkLlmCostBudget + runAigcAction SDK + rateLimitBatchSend + 5 locale | F001 + F002 + F005 复用 BL-067 沉淀 |
| #8 | Refine UI 形态 | **A: 面板顶部 inline input bar** | F003 RefineInputBar 组件形态锁 |

---

## §5 不变量（Generator 落地必查）

1. **cost cap 复用 BL-034 F005 + BL-067 包装**：F002 调 `src/lib/ai/cost-cap.ts` `checkLlmCostBudget`（BL-067 F002 已加）；不新增 cap 计算代码；与 outreach + BL-067 explainability 共享同一 $5/day/tenant 配额
2. **runAigcAction SDK 复用**：F001 action 注册后 F002 caller 走 `runAigcAction<T>`（BL-067 F001 src/lib/aigc/run-action.ts），不 inline POST aigcgateway
3. **TTL 严格 24h**：F003 localStorage cache 从 createdAt 起算；不延长 / 不滑动窗口；与 BL-066 F003 client-state TTL 24h 模式一致
4. **LLM permutation 验证**：F002 必验 `ordered_kol_ids` 是 currentPool ID 集合的 strict permutation（同集合 + 无重复 + 长度相等）；防 LLM 幻觉新增/缺失 KOL；不通过则降级 unparsable
5. **silent fallback 不破 UI**：cap 满 / unparsable / network error 全路径保留现池不变，仅 toast 提示；与 BL-067 silent fallback 哲学一致
6. **audit_log raw query 含**：F002 audit_log payload 必含 `raw_query` 全文（不脱敏 — Phase 5 个性化学习训练数据需要）；含 `parsed_filters` 完整结构 + `result_kol_ids` 重排后顺序 + `locale`
7. **`/campaigns/[id]` + `/match` cache 一致性**：F003 + F004 共用 localStorage key `refine-{tenantId}-{campaignId}`；用户跨两页 refine 状态 portable
8. **RefineInputBar 仅在 pool context 显示**：F004 Match 工作台 `?campaignId` mode 才显 RefineInputBar；普通 Match 搜索 mode（无 campaign context）不显
9. **rate limit 复用 rateLimitBatchSend 20/min/user**：F002 调 BL-034 现有 rate limit，不新增 refine-specific limit
10. **5 locale LLM 输出本地化**：F001 prompt 要求 LLM 输出 `feedback_summary` + `reason_locale` 5 locale 同时返回（同 BL-067 F001 5 locale JSON 模式），1 次 call 5 locale 避免切 locale 重调
11. **Reset to AI default 行为锁**：F003 Reset 按钮 → 清 localStorage cache + 默认 valueScore desc 排序 + 隐藏 Reset 按钮自身 + 隐藏 feedback toast；不弹确认 dialog（避免摩擦）

---

## §6 cost 估算与风险

### Cost 估算（per BL-067 audit §2:A flat $0.01/call meter view）

| 场景 | 调用次数 | meter（flat $0.01/call）| 真实 token spend 预估（haiku-4.5 ~$0.0015/call）|
|---|---|---|---|
| F002 refine 单次 | 1 call/refine | $0.01/refine | $0.0015/refine |
| **每用户 day（5 refine/campaign × 5 campaign）** | 25 calls | **$0.25/day** | $0.04/day |
| **5 用户团队 day** | 125 calls | **$1.25/day** | $0.20/day |
| **vs $5/day/tenant cap** | — | **远低于 cap（25% 利用率）** | — |

**关键判断**：BL-068 cost 远低于 cap，与 BL-067 + outreach 共享 cap 后总计仍 < $3/day/tenant。不会误触 cap。

### 风险表

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 解析成功率 < 80%（roadmap §11 Phase 3 gate）| 中 | 高 | F006 e2e 100 个 mock query 测试；< 80% 则 prompt 调优 fix-round / F005 错误边界友好引导 |
| LLM permutation 验证失败频次高（幻觉新增/缺失 KOL）| 低 | 中 | F002 严格 permutation 校验 + audit_log refine_permutation_invalid 监控；超 5% 则 prompt 加强约束 |
| 用户大量 refine 触发 rate limit（20/min/user 不足）| 低 | 低 | 5 用户 × 5 campaign × 5 refine = 5 refine/user/min 平均；峰值用户独立 rate limit 隔离 |
| localStorage 跨设备不同步 | 低 | 低 | per 决策点 #5 stateful client-side；设备切换是 known limitation，留 Phase 5 评估服务端 sync |
| Refine 池上限约束（现池仅 30 KOL → 用户期望"更多 X" 但 X 在池中有限）| 中 | 中 | F005 unparsable + 友好提示用户"尝试更具体" / 长期 BL-068 done 后评估是否升级到"重调 smart-match + filter"（fix-round 或下批次）|
| audit_log raw query 隐私敏感 | 低 | 低 | tenant 隔离 RLS 保护；raw query 不涉个人 PII；用户输入框前期 marketer team 内部使用 |
| Phase 5 个性化学习启动时数据基础不足 | 中 | 中 | F002 audit_log 完整记录 + Phase 5 启动前 BL-068 dogfood 累积 ≥1000 row 学习样本 |

---

## §7 下一批后续

- **BL-069** Brief 页合并（KB + Campaigns/new）— Phase 4 第一批
- **BL-070** Reach + Insight 页适配新 IA + 二次清理（i18n deprecated keys / 旧路由清理 / nav 旧 key / customize.ts/topic-cloud.ts 迁移到 runAigcAction）— Phase 4 第二批
- **Phase 5 候选**（不在 6-10 周硬上线范围）：
  - 个性化学习（捕获用户接受/拒绝信号 + refine raw query → valueScore 权重 + 偏好 model）
  - skip/replace 升级写 DB（作为 Phase 5 学习数据基础）
  - comparative query（"为什么 @kol45 排在第十位"）
  - Refine 越出现池（重调 smart-match + filter，适用于"加入 EN 市场但现池全亚洲"等 query）
  - Refine 状态服务端 sync（跨设备一致性）

---

## References

- ADR-013-ai-native-product-pivot §Decision 第 4 条（B3 混合 AI 交互形态）
- docs/product/ai-native-vision.md §3 场景 3 / §7 原则 3 "Refine over Filter" / §8 划界
- docs/product/ai-native-roadmap.md §5 BL-068 / §11 Phase 3 verifying gate
- docs/specs/BL-067-explainability-c3-spec.md §下一批后续 BL-068 + §F001 prompt design + §F002 runAigcAction SDK
- docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md §F003 AiRecommendationPanel（本批次 RefineInputBar 集成目标）
- src/lib/aigc/run-action.ts（BL-067 F001 沉淀 SDK，本批次 F001+F002 直接复用）
- src/lib/ai/cost-cap.ts:133 `checkLlmCostBudget`（BL-067 F002 沉淀 boolean 包装，本批次 F002 直接复用）
- src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx（BL-066+BL-067 升级目标）
- src/app/[locale]/(app)/match/（BL-065 实装 + 本批次 F004 升级目标）
