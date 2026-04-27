---
name: B7-mvp-launch-ready
description: MVP 上线 ready - Tier 1 全做（AI 实装 4 项 + placeholder 清理 5 项）。核心震撼点 /discovery AI Smart Match 实装；所有 disabled placeholder 实装/隐藏/友好 tooltip 三选一。用户 2026-04-28 决议 X 方案（接受邀请推迟 13 天换取首版即完整 AI 体验）。
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-28
decisions_locked_at: 2026-04-28
estimated_effort: 12-13 day
prerequisites:
  - B6-kol-daily-sync done（第 5 天接力条款验证完成）
  - aigcgateway 余额 ≥ $20（本批次预算 ~$5-10）
trigger: B6 done 后立即（B7 优先于 MVP-demo-launch，邀请推迟到 ~05-22）
---

# B7-mvp-launch-ready — MVP 上线 ready（AI 实装 + Placeholder 清理）

## 1. 背景与目标

### 1.1 触发

用户 2026-04-28 提问 "希望种子用户首次进 /discovery 就被震撼，同时当前 MVP 向用户展现的页面的基本功能均为可用状态"

Planner 调研发现 11 处 placeholder（5 处必处理 + 6 处需 tooltip polish），核心震撼点 `/discovery AI Smart Match` 当前**完全 disabled**，是种子用户期望最高的入口但点了无效。

### 1.2 战略价值

1. **核心震撼点：Smart Match 实装** — 种子用户首次见 = "AI 平台" 差异化定位
2. **整体可用性：placeholder 零容忍** — 消除"摆设但点了无效"破坏产品质感
3. **PMF 验证升级** — 邀请发出时种子用户体验"完整 AI 产品"，反馈质量更高
4. **预演 B6 + 数据增长价值** — Smart Match 直接消费 B6 持续增长的 KOL 库

### 1.3 非目标

- 不做 audience demographics 真接入（B6 + NoxInfluencer 三方）
- 不做跨平台 Smart Match（仅 YouTube KOL）
- 不做 KOL 视频内容 NLP（B5 stretch / B7+ 远期）
- 不做 marketer 自然语言搜索（Tier 2 / Post-MVP B8）
- 不做 KOL × KOL 关系图谱（B7+ 远期）
- 不实装 /roi + /weekly-report 的 B4 disabled 按钮（B4-extended 范围）

## 2. 范围（6 features）

### F001 — AI Matching Infrastructure（LLM-based + SQL pre-filter）

**重要：aigcgateway 无 embedding model**（list_models 仅 text/image），改方案：

**架构：SQL pre-filter → LLM ranking 混合**

```
Product description + filters
    ↓
SQL pre-filter（region/category/followers）→ 缩小到 ~50-100 候选 KOL
    ↓
LLM 对候选打分 + 解释（deepseek-v4-flash 1M context, $0.14 in / $0.28 out）
    ↓
返回 top 10 + match score + 1 句解释
```

**实现：**

1. 新建 `src/lib/kol-match/` 模块：
   - `types.ts` — KolMatchRequest / KolMatchResult / MatchScore types
   - `pre-filter.ts` — SQL 候选筛选（基于 product.markets/category 软匹配 KOL.region/categories）
   - `llm-ranker.ts` — 调 aigcgateway Action 排序候选

2. 新建 aigcgateway Action `kol-product-match-rank`:
   - input：product (name/description/category/markets) + candidates (50-100 KOL summary 数组)
   - output：strict JSON `{rankings: [{kolId, score: 0-100, reasoning: "1 句中/英"}], top10: [...kolIds]}`
   - model：**deepseek-v4-flash**（1M context, 最便宜，与现有 Action 集成简单）
   - cost 估算：50 候选 × 150 chars = 7.5K input + 1K output = $0.0014/调用

3. cost 控制：
   - 每个 marketer 每个 product 调 1 次（缓存 7 天到 Product.metadata.smartMatchCache）
   - 失效条件：KOL 库新增 > 100 / 用户手动 "Refresh"
   - 100 用户 × 5 product × 1 次/周 = 500 次/月 = ~$0.7/month

**Acceptance：**
- aigcgateway Action `kol-product-match-rank` 创建（action_id 入 commit message）
- src/lib/kol-match/types.ts + pre-filter.ts + llm-ranker.ts 实现
- pre-filter SQL 测试（region/category 软匹配 + valueScore 排序）
- LLM ranker 测试（mock + 真实 fixture，gated by env）
- cost 监控：每次调用记录 token 消耗到 event_log 'smart_match.invoked'
- tests/unit/kol-match-prefilter.test.ts + tests/unit/kol-match-llm-ranker.test.ts

### F002 — /discovery AI Smart Match 实装（核心震撼点）⭐⭐⭐

**当前现状：** `<button disabled title="will ship in B2">AI Smart Match</button>` — 种子用户首次见的最大失望点

**实装：**

1. 重写 `src/app/[locale]/(app)/discovery/page.tsx` Header 段：
   - 移除 disabled state
   - 加 onClick handler 打开 SmartMatchDialog

2. 新建 `src/app/[locale]/(app)/discovery/SmartMatchDialog.tsx`：
   - Step 1: 选 Product（下拉，从 tenant Product 表加载；如无 product 提示去 /knowledge-base 创建）
   - Step 2: 显示 loading state（"AI 正在为你匹配 1500+ KOL ..."）
   - Step 3: 显示 top 10 KOL with match score + AI reasoning
   - 每个 KOL 卡片：avatar / name / followers / categories / **match score (圆形 ring)** / **AI reasoning (1 句)** / "保存" 按钮
   - "Save All to Campaign" 一键加入新 campaign（跳 /campaigns/new 预填）

3. API：
   - `POST /api/kols/smart-match { productId }` → 返回 top 10 KolMatchResult
   - 内部调 src/lib/kol-match/llm-ranker.ts
   - 缓存命中返回 cache（7 天）+ "Refresh" 按钮强刷

4. UI 细节：
   - match score 用 RingProgress 组件（已有，dashboard 已用）
   - Loading state 显示进度（"已分析 X/Y KOL"）
   - empty state（KOL < 10）友好提示

5. 埋点（PRD §2.2 AI 定制采纳率指标延伸）：
   - event_log `smart_match.invoked`
   - event_log `smart_match.kol_saved`（点单个 KOL 保存）
   - event_log `smart_match.batch_saved`（一键加入 campaign）

**Acceptance：**
- /discovery AI Smart Match 按钮**不再 disabled**
- 点击弹层 → 选 product → 调 API → 显示 top 10 KOL + match score + reasoning
- 缓存 7 天（同 product 重复点立即返回）
- "Save All to Campaign" 跳 /campaigns/new 预填 product + 10 KOL
- visual baseline 重捕 /en/discovery（含 SmartMatchDialog 截图）
- tests/integration/smart-match-api.test.ts + tests/e2e/discovery-smart-match.spec.ts
- 用户 spot check：staging 跑一次 demo（用 demo product → 显示真实匹配）

### F003 — /database AI Intelligence + Coverage Gap 实装

**当前现状：**
- AI Intelligence Card 顶部 disabled CTA "Generate Insights"
- Coverage Gap Card 硬编 "Coming in B6 product analytics"

**实装：**

1. 新建 aigcgateway Action `kol-database-intelligence`：
   - input：tenant KOL stats（count by region/category/followers tier/relationshipStatus）+ product context（如有）
   - output：strict JSON `{insights: [{type: 'opportunity|gap|trend', title, description, action_link?}]}`
   - model：gemini-2.5-flash-lite（便宜 + JSON mode 强）
   - 每 24h 缓存到 localStorage（同 ROI Insights 模式）

2. 新建 src/lib/kol-database/intelligence.ts:
   - 调 Action + 缓存 + 错误处理

3. 修改 `src/app/[locale]/(app)/database/InsightsPanel.tsx`:
   - AI Intelligence Card：disabled CTA → 真 "Generate Insights" 按钮 → 调 Action → 显示 1-2 条洞察
   - Coverage Gap Card：硬编 → 计算 tenant categories vs gaming baseline (FPS/MOBA/RPG/手游/Casual/Esports/Action/Strategy)，显示缺口
   - Engagement Trend Card：保持现状（基于 sparkline 数据，已有 AI 计算潜力但本批次不深化）

4. 数据基线（硬编，docs/i18n/...）:
   - gaming categories baseline: FPS 20% / MOBA 15% / RPG 15% / 手游 15% / Casual 20% / Esports 10% / 其他 5%

**Acceptance：**
- AI Intelligence Card 真功能（点 Generate → 调 Action → 显示）
- Coverage Gap 真计算（tenant 分布 vs baseline）
- localStorage 缓存 24h + Refresh 按钮
- tests/integration/database-intelligence.test.ts
- 用户 spot check：staging Insights 3 卡显示真实数据

### F004 — /campaigns/:id AI Suggestions 实装

**当前现状：** `AiSuggestionsCard.tsx` 是 hardcoded 静态文本 + "Run AI match" disabled

**实装：**

1. 新建 aigcgateway Action `campaign-next-action-suggest`：
   - input：campaign meta + KolCampaign list 状态分布 + recent audit_log + product context
   - output：strict JSON `{suggestions: [{priority: 'high|medium|low', title, description, action_link, action_label}]}`
   - model：claude-haiku-4.5（与 outreach customize 同模型，复用 prompt 风格）
   - 缓存 24h

2. 修改 `src/app/[locale]/(app)/campaigns/[id]/AiSuggestionsCard.tsx`:
   - 静态文本 → 真 "Generate Suggestions" 按钮
   - 显示 3 个 next action（如 "5 个 KOL 未联系，建议发邮件 → /outreach?campaignId=:id"）
   - 每个 action 含 priority 标签 + 跳转链接
   - 用户点跳转后 event_log `campaign_suggestion.clicked`

3. 移除 "Run AI match" 按钮（已被 /discovery Smart Match 替代，避免重复）

**Acceptance：**
- AiSuggestionsCard 改为真 AI 调用
- "Run AI match" 按钮隐藏
- localStorage 缓存 24h
- tests/integration/campaign-suggest.test.ts

### F005 — /database Tier+Game filter + /discovery Save Search 实装

**当前现状：**
- /database Tier filter dropdown disabled "comingSoonTooltip"
- /database Game filter dropdown disabled "comingSoonTooltip"
- /discovery Save Search button disabled placeholder

**Tier filter 实装：**
- 基于 Kol.valueScore 分桶：high (≥80) / medium (60-79) / low (<60) / unrated (null)
- UI：Select dropdown 改 enabled，4 个选项
- SQL：`WHERE valueScore BETWEEN x AND y`
- i18n 4 语言 keys 补

**Game filter 实装：**
- 选项 A（推荐，简单）：从 Kol.categories 数组中提取 game-like 词（FPS/MOBA/RPG/Casual/手游/Esports）做 multi-select
- 选项 B：新加 Kol.game 字段（schema migration），由 categories mapping 计算
- **Planner 推荐 A**：避免 schema 改动，用 categories array filter
- SQL：`WHERE categories && ARRAY['FPS', 'MOBA', ...]`

**Save Search 实装：**
- 新建 prisma SavedSearch model：(id, tenantId, userId, name, filters JSON, createdAt)
- migration 含 ROLLBACK SQL
- API：POST /api/saved-searches + GET /api/saved-searches
- UI：
  - "Save Search" 按钮 enabled → 点击弹层输入 name → 保存当前 URL filters
  - 顶部加 "我的搜索 (3)" 下拉显示已保存 → 点跳预填 filters
- tests/integration/saved-search.test.ts

**Acceptance：**
- /database Tier filter + Game filter 不再 disabled，工作正常
- /discovery Save Search 真功能（保存 + 加载 + 删除）
- visual baseline 重捕 /en/database + /en/discovery
- tests 覆盖

### F006 — Polish + tests + spec 链验证

**实现：**

1. **Placeholder polish（次要 disabled 按钮处理）：**
   - /campaigns/:id "Run AI match" → 已在 F004 隐藏 ✓
   - /database Email + Delete bulk → 完善 tooltip 文案（"Use /outreach for bulk email" / "Bulk delete coming in B7+"）
   - /roi B4 buttons → tooltip 完善 "Available in B4 Email System Extended (planned for May)"
   - /weekly-report B4 buttons → 同上
   - /discovery AI suggestion chips（轮转）→ 保持静态（不改）

2. **i18n 4 语言新 keys 补：**
   - F002 SmartMatchDialog 新增 keys
   - F003 InsightsPanel 新增 keys
   - F004 AiSuggestionsCard 新增 keys
   - F005 Tier/Game/Save Search 新增 keys
   - 跑 `npm run i18n:translate` 自动补 zh/ja/ko/es

3. **守门 tests：**
   - tests/unit/no-disabled-without-tooltip.test.ts：grep src/ 所有 `disabled` 元素必有 `title` 或 `aria-label`（防新增"无解释 disabled"）
   - tests/unit/no-hardcoded-coming-soon-without-issue.test.ts：grep "Coming soon" / "B6" / "TODO" 必关联 backlog 或 spec ID

4. **spec 链一致性 grep：**
   - PRD §7 AI 能力边界更新（B7 已实装的不再标 ❌ MVP 外）
   - docs/specs/B5-kol-data-enrichment-spec.md 与 B7 关系（B5 是数据深化，B7 是 AI 调用，不冲突）
   - docs/specs/B6-kol-daily-sync-spec.md 与 B7 关系（B7 消费 B6 持续增长的 KOL）

5. **完整 tests：**
   - 全套 unit + integration + E2E 全绿
   - typecheck / lint 不退化

**Acceptance：**
- 所有 6 项 placeholder polish 完成
- i18n 4 语言新 keys 全补
- 守门 tests 通过
- PRD §7 更新
- 全套 tests 通过

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| **Smart Match 实现** | LLM-based ranking + SQL pre-filter（**非传统 embedding**）| aigcgateway 无 embedding model；LLM 长 context 直接 rank 更简单；cost 可控 |
| **Smart Match 模型** | deepseek-v4-flash（1M context, $0.14/$0.28） | 最便宜的长 context；与现有 actions 集成无新依赖 |
| **Database Intelligence 模型** | gemini-2.5-flash-lite（$0.12/$0.48） | 与 i18n F005 同模型，已 proven JSON mode 强 |
| **Campaign Suggestions 模型** | claude-haiku-4.5（$1/$5） | 与 outreach customize 同模型，复用 prompt 风格 |
| **缓存策略** | localStorage 7 天（Smart Match）/ 24h（Insights / Suggestions） | 减少重复调用，节省成本 |
| **Save Search** | 新建 SavedSearch table（schema migration） | 干净分层；filter JSON 字段灵活 |
| **Tier filter 数据来源** | Kol.valueScore 分桶（high/med/low/unrated） | 数据已有，无 schema 改动 |
| **Game filter 数据来源** | Kol.categories array filter（避免 schema 改动） | 简单可行；未来 BL-014 拆 game 字段 |
| **disabled 按钮处理原则** | 实装能做的 / 隐藏混淆的 / 友好 tooltip 解释 B 系列规划的 | 用户 "基本可用" 诉求 |
| **i18n 新 keys** | 自动 i18n:translate 补 4 语言 | 与 i18n done 流程一致 |
| **visual baseline 重捕** | F002+F003+F005 均涉及 UI 改动，必重捕 | 同 hotfix 模式 |

## 4. 依赖关系

```
F001 AI Matching Infrastructure ─┬─→ F002 Smart Match
                                 └─→ F003 Database Intelligence (其实 F003 不依赖 F001 LLM ranker，但共用 aigcgateway 调用模式)

F004 Campaign Suggestions（独立，仅复用 aigcgateway 模式）

F005 Tier/Game/Save Search（独立，schema + filter）

F006 Polish + tests + spec 链（最后做）
```

**强依赖：** F001 → F002（Smart Match 必依赖 LLM ranker）

**推荐顺序：** F001 → F002（核心震撼）→ F003 → F004 → F005 → F006

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| LLM ranking 质量不稳定（不同 product 推不同质量）| 高 | F001 prompt 严格设计 + few-shot 示例 + JSON schema 验证 + cost 监控；用户 spot check 5 个 product 评分质量 |
| Smart Match cost 失控（用户高频调用）| 中 | F001 缓存 7 天 + Refresh 限频（每 product 每天最多 5 次刷新）|
| KOL 库太小（仅 760 prod）→ 推荐质量低 | 高 | B6 cron 已运行 ~2 周（B6 done ~05-03 + B7 13 day = 邀请 ~05-22 时已积累 ~600 增量），KOL 库 ~1400+ |
| LLM JSON 输出破坏（同 BM2 教训）| 中 | strip code fence + JSON schema 验证 + 重试（同 BM2 F006 模式）|
| Tier filter 数据少（不少 KOL valueScore=null）| 中 | F005 加"unrated" 桶；可选项不显示 0 个的桶 |
| Save Search schema migration 影响生产 | 低 | nullable + ROLLBACK SQL（database-patterns.md 硬要求）|
| 缓存失效逻辑复杂 | 中 | 简化为 LRU + TTL；不做实时同步（next refresh 时计算）|
| visual baseline 重捕规模大 | 中 | update-visual-baselines workflow 自动触发，~10 min CI |
| 邀请推迟 13 天用户接受度 | 中 | 用户已选 X 方案接受推迟，换取首版即完整 AI 体验 |

## 6. 验收方式

### L1 自动化
- F001-F006 全套 unit + integration tests 通过
- typecheck / lint / 现有套件不退化
- 守门 tests（无 disabled 无 tooltip / 无 hardcoded TODO）通过
- visual baseline 全部更新

### L2 staging
- /en/discovery 点 AI Smart Match → 选 product → top 10 KOL with score + reasoning（**核心震撼点验证**）
- /en/database Insights 3 卡真数据
- /en/campaigns/:id AI Suggestions 真 next action
- /en/database Tier+Game filter 工作
- /en/discovery Save Search 真功能（保存 + 加载）
- 4 语言 spot check 关键页（zh/ja/ko/es）

### L3 用户验证（特殊）
- 用户用 demo product → 跑 Smart Match → 评估 top 10 KOL 质量是否"被震撼"（≥7/10 评分接受）
- 如评分 <7，触发 fixing：F001 调整 prompt + 重测

## 7. 引用文档

- `docs/product/KOLMatrix-MVP-PRD.md` §7 AI 能力边界（B7 done 后更新）
- `docs/specs/B5-kol-data-enrichment-spec.md`（B5 数据增强 + KOL 详情页改造）
- `docs/specs/B6-kol-daily-sync-spec.md`（B7 消费 B6 持续增长的 KOL）
- `framework/harness/database-patterns.md`（migration 规则）
- `framework/harness/ui-fidelity-guardrail.md`（visual baseline 规则）

## 8. 启动检查清单（Generator 开工前）

- [ ] B6-kol-daily-sync done + signoff（含第 5 天接力条款验证）
- [ ] aigcgateway 余额 ≥ $20（本批次预算 $5-10）
- [ ] prod KOL ≥ 1000（B6 5 天后达成）
- [ ] tenant Product 表有 ≥ 3 个真 product（用于 Smart Match 测试）

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 AI Matching Infrastructure（pre-filter + LLM ranker + Action） | ~2 day |
| F002 /discovery AI Smart Match 实装（核心 ⭐⭐⭐） | ~3 day |
| F003 /database AI Intelligence + Coverage Gap 实装 | ~2-3 day |
| F004 /campaigns/:id AI Suggestions 实装 | ~2 day |
| F005 Tier+Game filter + Save Search 实装（含 migration） | ~2 day |
| F006 Polish + tests + spec 链 + i18n + 守门 tests | ~2 day |
| 缓冲（LLM 调试 / visual baseline / 反复修） | ~1-2 day |
| **总计** | **~12-13 day** |

## 10. 时间线（用户 2026-04-28 选 X 方案 lock）

```
当前        B6-kol-daily-sync building（Generator 接力中，~5 day）
~05-03      B6 done + 第一次 cron prod 自动跑
~05-03      ⭐ B7-mvp-launch-ready building（6 features，13 day）
~05-16      B7 done
~05-16      MVP-demo-launch 合并 sprint building（9 features，5-6 day）
~05-22      done + 邀请发出 ⭐ MVP 上线
            （vs 原 B6+demo-launch 时序 05-09，推迟 13 天）
~05-22 ~ 06-25  B6 持续同步 = +1000-1500 KOL，Smart Match 推荐池持续扩大
```

**用户战略选择（X 方案）：**
- 接受邀请推迟 13 天换取**邀请发出时**：
  - Smart Match 实装 ⭐⭐⭐（用户首次见就被震撼）
  - 全 placeholder 消除（基本功能均可用）
  - KOL 库 1400+（B6 自动同步 18 天后）
  - 完整 AI 体验（不是"半成品"）

## 11. 与其他批次关系

- **依赖：** B6-kol-daily-sync（数据持续增长，Smart Match 推荐池基础）
- **依赖：** kol-seed-redo（基础 KOL seed 数据）
- **不依赖：** MVP-demo-launch（B7 与 demo prep 独立，但 demo 启动等 B7 done）
- **预演：** Smart Match LLM ranking 模式可推广到 B8 邮件回复分类 / B9 关系 AI 推荐
- **不冲突：** BIx-staging-automation / B4-extended

## 12. 与 PRD §7 决策更新

**B7 done 后 PRD §7 更新：**

| AI 能力 | PRD 原标 | B7 后更新 |
|---|---|---|
| KOL × Product 匹配分 | ❌ MVP 外（B2）| ✅ B7 实装（LLM ranking） |
| AI Insights 自动分析 | ❌ MVP 外 | ✅ B7 实装（roi-insights + database-intelligence + campaign-suggest）|
| AI 邮件回复分类 | 未在 PRD | ⏳ B4-extended trigger 后做 |
| KOL 智能推荐 | ❌ MVP 外 | ✅ B7 Smart Match 已部分覆盖 |

## 13. 用户决策（2026-04-28 ✅ lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | AI 增强方向选择 | ✅ 4 AI 能力深化（讨论话题选 4） |
| 2 | 优先级方向 | ✅ "首次进 /discovery 就被震撼" + "基本功能均可用" |
| 3 | 实施方案 | ✅ X 方案 Tier 1 全做（接受邀请推迟 13 天）|

---

**Spec 状态：** decisions-locked（2026-04-28 Planner 起草 + 用户裁决 3/3 全 lock）

**预估 MVP 上线：~2026-05-22**（vs 原 lock 05-09，推迟 13 天）

**核心交付：** 邀请发出时种子用户首次进 /discovery 就被 AI Smart Match 震撼 + 全 placeholder 消除"基本可用"。
