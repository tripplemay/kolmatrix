# BL-067 Recommendation Explainability C3 双向 — Spec

> **起草：** 2026-05-15 北京 / Planner johnsong
> **状态：** Drafted（8 决策点用户 2026-05-15 brainstorming lock；待 user ack spec → backlog 等 BL-066 F009 done 后启动）
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 3 第一批 / ADR-013 §Decision 第 5 条 + vision §3 场景 4 + §7 原则 4 "Explainability 是 contract"）
> **预估工时：** 6 day Generator + 1 day Reviewer（F001 6h + F002 8.5h + F003 4h + F004 8h + F005 12h + F006 8h + F007 4h = 50.5h ≈ 6.3 day；F001 +2h SDK 抽象层 + F002 +0.5h cost-cap 包装 = 2.5h 在 6 day 偏差范围内；不含 24h cost 监控等待期）
> **依赖：** BL-066 F009 done ✅（AiRecommendationPanel C2 占位段 ready 在 staging）+ aigcgateway $5/day/tenant 中央 cost cap（BL-034 F005 复用）
> **关联：** ADR-013 §Decision 第 5 条 / vision §3 场景 2 §3 场景 4 §7 原则 4 / roadmap §5 BL-067 / BL-066 spec §下一批后续

---

## §1 背景

BL-066 完成 `/campaigns/[id]` 详情页 AI native 主面板 + AiRecommendationPanel top 30 候选交互。每个 KOL 卡当前显「为什么」占位（C2 浅版 — `cosine match {matchScore} | valueScore {valueScore}` 数字字符串）。

按 ADR-013 §Decision 第 5 条 + vision §7 原则 4 "Explainability 是 contract — AI 决策必须可解释，黑盒推荐 = 用户不信任"，本批次升级 C2 → C3 双向：

- **C3 短版**：每个 top 30 KOL 卡显 1 句话 LLM 生成的解释（命中哪些 4 维度信号）
- **C3 详细版**：用户主动点 `?` icon → Dialog 弹出 5 段结构化详细解释（match score / category fit / recent activity / audience fit / brand history）

vision §3 场景 2 + §3 场景 4 画面感已明确。本批次实装 LLM 调用层 + 缓存层 + UI 升级三段。

### vision §3 场景 2 画面感（C3 短版）

```
@ninja  ⭐ 4.85
🎯 15.5% engagement (top 5%)，3 个游戏品类匹配你的 Genshin
受众 1100 万，主流是 18-24 岁男性，符合你的目标受众
最近 90 天活跃发帖 23 条，互动稳定
[ 接受 ] [ 跳过 ] [ 详情 ]
```

### vision §3 场景 4 画面感（C3 详细版）

```
Top 推荐：@ninja
─────────────────────────────────────
Q: 为什么 @ninja 排在第一位？
A:
   1. valueScore 4.85 / 5.0（前 5%）
   2. 主营品类 Gaming + Esports 与你的 Genshin 重合
   3. 最近 30 天活跃发帖 23 条，互动稳定
   4. 受众 18-24 岁男性占 65%，与你的目标受众重合度 78%
   5. 历史合作过 5 个游戏品牌（Sony, Razer, ...），价格区间 $X-$Y
```

### 与 BL-066 F003 现状对接

BL-066 F003 acceptance: `「为什么」占位（C2 浅版：matched on cosine similarity {matchScore}; valueScore {valueScore}）`

BL-067 升级：占位段升级为 LLM short 渲染（懒查 asset 缓存 hit → LLM 内容 / miss → C2 fallback 保持现状）。同时新增 `?` icon 入口触发 detailed dialog。

---

## §2 业务目标

- AiRecommendationPanel 每卡片显 1 句话 LLM 生成的解释（C3 短版），cache miss 时 silent fallback 到 C2 浅版（不破坏 UI）
- 用户主动点 `?` icon 打开 DetailedExplanationDialog，看 5 段结构化详细解释
- LLM 调用走 aigcgateway 2 个新 action（short / detailed），每 action 1 次 call 输出 5 locale JSON（cost 优化）
- 缓存层走现有 asset 表 + 24h TTL，命中率优化 cost
- BullMQ pre-warm 队列在 AiRecommendationPanel mount + smart-match 返回后异步生成 top 30 short
- cost cap 沿用 BL-034 F005 $5/day/tenant 中央策略；cap 满 silent fallback 到 C2
- 验收 gate（roadmap §11 Phase 3）：explainability 解释覆盖率 100%（pre-warm 后 + cap 未满）/ LLM 调用 P99 延迟 < 5s

### 不在本批次范围

- BL-068 B3 自然语言 refine（"减少 micro tier，多加女性受众" 对话式重排）
- skip/replace 状态升级写 DB（BL-066 spec §决策点 #E 5/14 lock 为 client-state-only；BL-067 brainstorming 5/15 lock 保持现状）
- comparative query（"为什么 @kol45 排在第十位而不是更前？"对比类 query）— vision §8 划界，Phase 5 候选
- chat-like 自由问答 UI — vision §8 划界
- 个性化学习（捕获用户接受/拒绝信号反馈到 valueScore 权重）— Phase 5 候选
- BL-070 二次清理（i18n deprecated keys / 旧路由清理）

---

## §3 范围（7 features）

### F001 — aigcgateway 2 action 注册 + run-action.ts SDK 统一抽象层（per F001 audit §6:A）

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0（原 4h + audit #6 SDK 抽象层 +2h）

**Acceptance：**
- 创建 `kol-recommendation-explain-short` action via MCP `create_action`：
  - **Model：** `claude-haiku-4-5`
  - **Variables：** `kol_json` / `campaign_json` / `value_score_breakdown_json` / `locales_json`（JSON.stringify 后注入 prompt）
  - **Response format：** `json_object`
  - **Prompt（system）：** 中文骨架，要求 LLM 为每个 locale 生成 ≤80 字一句话解释，命中 4 维度信号（follower / engagement / category / 内容质量），输出 JSON `{ "en": "...", "zh": "...", "ja": "...", "ko": "...", "es": "..." }`
  - **Action ID：** 落 `.env.staging` + `.env.production` 变量 `AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID`
- 创建 `kol-recommendation-explain-detailed` action：
  - **Model / Variables / Response format：** 同 short
  - **Prompt：** 要求输出 5 段结构化 JSON，每段 ≤200 字，per locale：`{ matchScore: "...", categoryFit: "...", recentActivity: "...", audienceFit: "...", brandHistory: "..." }`
  - **顶层 JSON：** `{ "en": { matchScore, categoryFit, recentActivity, audienceFit, brandHistory }, "zh": {...}, "ja": {...}, "ko": {...}, "es": {...} }`
  - **Action ID：** 落 `.env.*` 变量 `AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID`
- 两 action 走 MCP `run_action` dry_run 验证 prompt 渲染正确 + token 估算（实测 ceiling：short ≤2000 input + ≤800 output token；detailed ≤2000 input + ≤3500 output token；如 dry_run 超 ceiling 则裁 input 字段或降至 ≤80 字限定更严）
- F001 commit 含 prompt 原文（中文系统提示 + 输入 schema 文档化）落 `docs/specs/BL-067-F001-prompt-design.md`
- **新建 `src/lib/aigc/run-action.ts` 统一 SDK 抽象层**（per F001 audit §6:A 裁决）：
  - 签名：`runAigcAction<T>(opts: { actionId, variables, tenantId, actionLabel, timeoutMs? }): Promise<{ output: T; usage: { totalTokens, costUsd }; traceId }>`
  - 内部流程：`assertDailyCostBudget(tenantId)` → POST `/actions/run` → `parseFencedJson` → `recordAiUsage(tenantId, actionLabel, costUsd)` → typed return
  - 复用现有 `fetchWithRetry` / `xml-escape` / `parseFencedJson` 三个 BL-034/BL-035 基础设施
  - 单测 ≥4 case：success / cost-cap throw / aigcgateway 5xx error / JSON 解析失败
  - **约束**：不动 customize.ts / topic-cloud.ts 现有 caller（向后兼容），仅 BL-067 新 caller 用新抽象；customize.ts / topic-cloud.ts 迁移留 BL-068 done 阶段评估
- L1 PASS（lint + tsc + vitest）
- staging git_sha 与本 commit 一致

---

### F002 — asset 缓存层 + checkLlmCostBudget boolean 包装 + cleanup cron（per F001 audit §1:A §5:A）

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.5（原 8h + audit #1 boolean 包装 +0.5h）

**Acceptance：**
- Migration: `prisma/migrations/20260516XXXXXX_bl067_f002_explanation_asset_types/migration.sql`
  - 加 enum 值 `ai_recommendation_explanation_short` / `ai_recommendation_explanation_detailed` 到 `AssetType` enum（**起工前 grep schema.prisma 确认现有 enum 值仅 `email` + `video_script`**）
  - DOWN rollback 注释（per `scripts/validate-rollback-sql.sh` 铁律）
  - schema.prisma 同步加 enum
- 新文件 `src/lib/explainability/cache.ts` 封装：
  - `readShortExplanation(tenantId, campaignId, kolId, locale): Promise<string | null>` — 查 asset 表 type=short + createdAt > now-24h
  - `writeShortExplanation(tenantId, campaignId, kolId, locale, content): Promise<void>` — 写 asset 行（一行一 locale；payload 含 short 文本 + metadata{ kolId, campaignId, generatedAt, tokenUsage, costUsd }）
  - `readDetailedExplanation(tenantId, campaignId, kolId, locale): Promise<{ matchScore, categoryFit, recentActivity, audienceFit, brandHistory } | null>`
  - `writeDetailedExplanation(tenantId, campaignId, kolId, locale, segments): Promise<void>`
- **cost cap 复用（per F001 audit §1:A 裁决修订）**：在现有 `src/lib/ai/cost-cap.ts`（BL-034 F005，**非** spec 原写的 `src/lib/cost-cap/check.ts`）加 ≤15 LOC 包装函数 `checkLlmCostBudget(tenantId): Promise<{ allowed: boolean }>` — 复用同一 count 查询逻辑，`assertDailyCostBudget` 不动保 customize.ts / topic-cloud.ts 向后兼容；BL-067 4-5 处新 caller 用 boolean API 减 try/catch 噪音
- **Cleanup cron（per F001 audit §5:A 裁决修订）**：F002 同 commit 新建 `scripts/cleanup-expired-explanation-assets.ts`（仅删 type IN (ai_recommendation_explanation_short, ai_recommendation_explanation_detailed) + createdAt < now - 24h 的行）+ GitHub Actions workflow `.github/workflows/cron-cleanup-explanation-assets.yml` 调度（**Generator 起工前必 grep `scripts/kol-sync-daily.ts` 或 `.github/workflows/cron-*.yml` 确认 daily sync 真实 schedule，cleanup cron 选不冲突时段 — 推荐 06:30 BJT 或 14:30 BJT，避开 04:00-06:00 cron 静默窗**）
- 单测 ≥6 case：read hit / read miss / read expired (>24h) / write success / write RLS denied / TTL boundary (exactly 24h - 1ms)
- L1 PASS（lint + tsc + vitest）
- staging git_sha 与本 commit 一致

---

### F003 — AiRecommendationPanel C2 → C3 升级 + `?` icon 入口

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- 升级 BL-066 F003 中的 `_explanation_placeholder` 占位段：
  - mount 时 batch 调 `Promise.all(top30.map(kol => readShortExplanation(tenantId, campaignId, kol.id, locale)))`
  - 渲染 per kol：HIT → 显 LLM short；MISS → 显 C2 fallback 文案（`cosine match {matchScore} | valueScore {valueScore}` 字符串保持现状）
- 每个 KOL 卡片右上加 `help_outline` Material Symbols icon：
  - `data-testid="explain-trigger-{kolId}"`
  - aria-label 取自 i18n key `campaigns.detail.explainability.queryButtonLabel`
  - 点击 → 打开 `DetailedExplanationDialog`（F004）
- 不在 F003 内主动触发生成（生成在 F005 队列侧）
- 单测 ≥4 case：mount batch read 调用 / hit 显 LLM short / miss 显 C2 fallback / icon 渲染锁
- 不破坏 BL-066 F003 现有 e2e（accept / skip / show-next / 三段 layout）
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F004 — DetailedExplanationDialog UI + 详细版 server action

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.0

**Acceptance：**
- 新组件 `src/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog.tsx`（"use client"）：
  - Props：`{ kolId: string; campaignId: string; kol: KolForCard; valueScore: number; open: boolean; onClose: () => void }`
  - 首次打开调 server action `requestDetailedExplanationAction({ campaignId, kolId, locale })`
  - Loading skeleton 渲染（5 段骨架）
  - 5s 超时 fallback 显 `campaigns.detail.explainability.unavailable` 文案 + 关闭按钮
  - 渲染 5 段结构（标题 i18n + LLM 内容）：matchScore / categoryFit / recentActivity / audienceFit / brandHistory
- 新文件 `src/app/[locale]/(app)/campaigns/[id]/explainability-actions.ts`（"use server"）含：
  - `requestDetailedExplanationAction({ campaignId, kolId, locale }): Promise<{ segments: {...} | null; fallbackToC2: boolean }>`
  - 流程：（1）查 cache → HIT 返回；（2）MISS → `checkLlmCostCap(tenantId)` → 满 → 返回 `{ segments: null, fallbackToC2: true }`；（3）未满 → 拼 input 调 aigcgateway `run_action(AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID, input)` → 解析 JSON → `writeDetailedExplanation` per locale → 返回当前 locale segments
  - audit_log：`logAudit({ actorId, action: 'ai_recommendation.explain_detailed_generated' or '_served_from_cache' or '_cap_exhausted', targetType: 'kol_campaign', targetId: \`${campaignId}:${kolId}\`, tenantId, after: { locale, tokenUsage?, costUsd?, segmentCount } })`
  - Rate limit 沿用 `rateLimitBatchSend` (20/min/user)
- 单测 ≥5 case：dialog 首次打开 cache miss 调 LLM / cache hit 不调 LLM / cap 满返回 fallback / LLM error → 5s timeout 文案 / 5 locale switch 各返回对应 segments
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F005 — BullMQ pre-warm worker + trigger 接入 AiRecommendationPanel

**Executor：** generator
**Priority：** high
**Estimated hours：** 12.0

**Acceptance：**
- 新 worker `src/lib/queue/explain-recommendations-worker.ts` 处理 job type `recommendation-explain-prewarm`（**InMemoryJobQueue 模式，per F001 audit §4:B 裁决**）：
  - 注册 worker handler via `src/lib/jobs/queue.ts` 的 `register(name, handler)` API
  - Payload：`{ tenantId: string; campaignId: string; kolIds: string[] }`
  - jobId 幂等：`prewarm-{tenantId}-{campaignId}`（走 InMemoryJobQueue 的 `idempotencyKey` Map，**同进程内**幂等；进程重启后由 mount self-heal 自然重新 enqueue）
  - Worker 主循环：
    1. for each kolId in kolIds（按顺序）：
    2. `checkLlmCostBudget(tenantId)`（**per F001 audit §1:A 裁决**） → `{ allowed: false }` → `break`（剩余 KOL 不再调 LLM；不记 audit warning per BL-034 风格）
    3. 查 `readShortExplanation` per locale 全 5 locale 命中则 skip 该 KOL（避免重复调用）
    4. **inline import 计算 valueScoreBreakdown**（per F001 audit §3:A 裁决）：`import { computeKolValueScore } from '@/lib/kol/value-score'` → `const { breakdown } = computeKolValueScore({ followerCount, engagementRate, categories, engagementAuthenticity })` → 拿到 `{ followerScore, engagementScore, categoryScore }`
    5. 拼 input：`{ kol: { id, name, followerCount, engagementRate, categories[] }, campaign: { id, name, markets[], productId, product: { name, targetAudience } }, valueScoreBreakdown: { followerScore, engagementScore, categoryScore, total }, locales: ['en','zh','ja','ko','es'] }`
    6. 调 `runAigcAction({ actionId: AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID, variables, tenantId, actionLabel: 'ai_recommendation.explain_short' })`（**per F001 audit §6:A 裁决** — 走 F001 新建的统一 SDK 抽象层而非 inline POST）→ 解析 5 locale JSON
    7. for each locale → `writeShortExplanation(tenantId, campaignId, kolId, locale, content[locale])`
    8. `logAudit({ action: 'ai_recommendation.explain_short_generated', ..., after: { kolId, locales: 5, tokenUsage, costUsd } })`
  - **handler 内手写 1 次 retry**（仅网络错误 retry，JSON 解析失败不 retry — per §5 不变量 #9）
- 新文件 `src/app/[locale]/(app)/campaigns/[id]/prewarm-actions.ts`（"use server"）含：
  - `enqueueExplanationPrewarmAction({ campaignId, kolIds }): Promise<void>` — server 端 `void jobQueue.add('recommendation-explain-prewarm', payload, { idempotencyKey: 'prewarm-' + tenantId + '-' + campaignId, delay: 1 })` **fire-and-forget**（per F001 audit §4:B 裁决：`delay:1` 让 LLM 跑入下一 tick，server action 立即 return 不阻塞 mount）
- AiRecommendationPanel（F003 改造的延续）mount + smart-match 返回 top30 后调 `enqueueExplanationPrewarmAction({ campaignId, kolIds: top30.map(k => k.id) })`
  - server 端 enqueue 幂等：同 idempotencyKey 已存在 → noop（per InMemoryJobQueue `idempotencyKey` Map 行为）
  - 用户进出页面多次不会触发重复 LLM 调用（同进程内）
- 单测 ≥5 case：success / cap 满静默 break / LLM error skip 当前 KOL / 幂等 idempotencyKey / 空 kolIds noop
- L1 PASS
- staging git_sha 与本 commit 一致
- **Dogfood 期监测**：BL-067 dogfood 期间若 PM2 reload 频次 > 2 次/day **或** 用户报 short explanation 频繁 miss，BL-067 done 时评估是否升级 BullMQ（作 fix-round 或下个 batch）

---

### F006 — 5 语言 i18n keys + e2e

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.0

**Acceptance：**
- `messages/{en,zh,ja,ko,es}.json` 加 `campaigns.detail.explainability.*` 完整 keys：
  - `queryButtonLabel` — `?` icon aria-label
  - `dialogTitle` — Detailed Explanation dialog 标题（带 KOL handle 占位）
  - `loading` — 5 段 skeleton 加载文案
  - `unavailable` — 5s timeout fallback 文案
  - `capExhaustedToast` — cap 满时显 toast（仅 F004 dialog 触发 + cap 满路径才显，pre-warm 静默不 toast）
  - `segments.matchScore.title` / `segments.categoryFit.title` / `segments.recentActivity.title` / `segments.audienceFit.title` / `segments.brandHistory.title` — 5 段标题（LLM 仅生成内容，标题走 i18n）
  - `c2Fallback` — F003 cache miss 时的 C2 占位文案（沿用 BL-066 F003 现文案即可，集中到 i18n key 而非硬编码）
- 5 语言全 cover 不留 `_deprecated_by_*` marker（新 keys）
- 新 `tests/e2e/campaign-explainability-flow.spec.ts` 6 case：
  1. panel mount → 等 short 渲染（pre-warm 完成后 reload 验 hit）
  2. cache miss → 显 C2 fallback（用未 pre-warm 的 fresh campaign）
  3. `?` icon click → DetailedExplanationDialog 打开 → 5 段渲染
  4. 同 KOL dialog 二次打开 → cache hit (no LLM call via network mock)
  5. cap 满 → dialog 打开显 fallback 文案
  6. locale switch（en → zh）→ 同 KOL short / detailed 显对应 locale 内容
- L1 PASS（lint + tsc + vitest + e2e）
- staging git_sha 与本 commit 一致

---

### F007 — staging deploy + 视觉 baseline + 24h cost 监控 + signoff prep

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- staging deploy via `deploy-staging.yml`（含 `AIGCGATEWAY_EXPLAIN_*_ACTION_ID` 两个新 env var via SSH 落 `.env.staging`）
- 视觉 baseline regen via `update-visual-baselines` workflow：
  - `en-campaign-detail.png` 必新生成（含 short explanation 显示态 + `?` icon）
  - `en-campaign-detail-detailed-dialog.png` 新增（Dialog 打开态）
- 团队 staging dogfood 清单（Planner 出，F007 commit 时落 `docs/test-reports/BL-067-staging-spot-check.md`）：
  - ≥5 个不同游戏品类 campaign 实测 short 渲染质量
  - ≥3 个 detailed dialog 实测 5 段质量
  - 5 locale 切换 spot check
  - cap 满模拟（mock $5 cost）测 silent fallback
- 24h aigcgateway dashboard cost 监控：daily total cost ≤ 团队 dogfood 实际 cost × 1.5（防止 prompt 偏调用 token 暴增）
- `scripts/bl067-cost-audit.ts` 拉 audit_log type='ai_recommendation.explain_*' 24h 累计 cost / token / call 数报告
- `docs/test-reports/BL-067-signoff-2026-05-XX.md` Reviewer 写最终结论：覆盖率 100% + cost 在 cap 内 + 5 locale 全绿 + 6 e2e PASS
- Reviewer 复验全部 acceptance + signoff，progress.json `status: reverifying → done`

---

## §4 关键决策点（brainstorming 2026-05-15 lock）

| # | 决策点 | 用户 ack（2026-05-15）| 影响 |
|---|---|---|---|
| #1 | spec 成熟度 | **A: ready-to-build**（lock 全部 8 决策点） | spec 立即可进 building，不等 BL-066 dogfood |
| #2 | 渲染时机 + 覆盖率 | **B: campaign 创建后批量预生成**（top 30 × 5 locale） | F005 worker 设计的核心 — pre-warm 模式 |
| #3 | skip/replace 状态 | **A: 保持 BL-066 client-state-only** | BL-067 范围聚焦 explainability；Phase 5 个性化学习启动时另起批次 |
| #4 | user query 详细版 UI | **A: 卡片右上 `?` icon → Modal Dialog** | F004 组件形态锁 — 与现有 settings/product-detail modal 风格一致 |
| #5 | 5 语言生成策略 | **A: 1 次 LLM call 输出 5 locale JSON** | F001 prompt 设计核心 — cost 节省 3x（$0.045 vs $0.15 / campaign） |
| #6 | 模型 + cost 策略 | **A: haiku-4.5 + 沿用 BL-034 F005 cap $5/day/tenant** | F001 + F002 复用中央策略 |
| #7 | LLM 不可用 fallback | **A: silent fallback to C2** | F003 + F004 + F005 全链路 silent fallback；与 BL-034 一致 |
| #8 | pre-warm trigger | **A: AiRecommendationPanel mount + smart-match 返回后** | F005 trigger 接入点 — 不在 server hook 也不延迟到 user accept |

---

## §5 不变量（Generator 落地必查）

1. **cost cap 复用 BL-034 F005**（per F001 audit §1:A §2:A 修订）：F002 + F004 + F005 全部走 `src/lib/ai/cost-cap.ts`（**非** spec 原写的 `src/lib/cost-cap/check.ts`）；F002 加 ≤15 LOC boolean 包装 `checkLlmCostBudget(tenantId): Promise<{ allowed: boolean }>`，`assertDailyCostBudget` 不动保 customize.ts / topic-cloud.ts 向后兼容；与 outreach AI 邮件个性化共享同一 $5/day/tenant 配额（**meter 视角**：count × $0.01 flat — BL-034 MVP 自定边界，BL-040+ 升真实 cost meter）
2. **cache key 三元组**：`(campaignId, kolId, locale)`；同 KOL 跨 campaign 不共享 cache（campaign 上下文不同 → explanation 不同）
3. **TTL 严格 24h**：从 asset.createdAt 起算；不延长 / 不滑动窗口
4. **silent fallback 不发 toast**（pre-warm 路径）：F005 worker cap 满 `break` 后不发任何用户感知通知；用户进页面看到的是 C2 fallback（与未 pre-warm 同效果）
5. **dialog 路径 cap 满才发 toast**：F004 dialog 用户主动点 `?` 触发 cap 满路径时显 `capExhaustedToast`（告知用户为何只看到简单版）
6. **`?` icon 永远显**：不论 cache 是否命中、cap 是否满。用户点击后再走 F004 流程；保持入口一致性
7. **RLS 隔离**：F002 cache 读写必走 tenantId WHERE filter；audit_log 必带 tenantId / actorId / 真实 user uuid（不用 `__system__` 占位）
8. **prompt 含 valueScoreBreakdown 4 维度**：F001 short / detailed 两 action 都接收 follower/engagement/category/total 分数细分，LLM 才能解释"为什么这个排前"（仅传 total 分数 LLM 无法生成 vision §3 场景 2 那种 "15.5% engagement (top 5%)" 的解释）
9. **不重试 LLM JSON 解析失败**：F005 worker LLM 输出不符 JSON schema 时记 error 跳过该 KOL；不 retry 避免 cost 浪费
10. **prewarm 幂等**（per F001 audit §4:B 修订）：用户来回切 detail 页不会触发重复 LLM 调用 — 走 InMemoryJobQueue `idempotencyKey` Map 同进程内幂等；进程重启后 mount self-heal 自然重新 enqueue（PM2 single instance cluster=1 架构下风险可控；如 dogfood 期 PM2 reload 频次 > 2 次/day 或用户报 short 频繁 miss → BL-067 done 评估升级 BullMQ）

---

## §6 cost 估算与风险

### Cost 估算（per F001 audit §2:A meter view 修订）

**当前 BL-034 cap 策略 = count × $0.01 flat**（src/lib/ai/cost-cap.ts MVP 自定边界，BL-040+ graduate）：

| 场景 | 调用次数 | meter（flat $0.01/call）| 真实 token spend 预估（haiku-4.5 ~$0.0015/call）|
|---|---|---|---|
| F005 pre-warm short | 30 calls/campaign（1 call × 30 KOL，5 locale JSON 输出） | **$0.30/campaign** | $0.045/campaign |
| F004 detailed first open | ~5 calls/campaign（avg user 询问） | $0.05/campaign | $0.010/campaign |
| **每 campaign 合计** | **35 calls** | **$0.35** | $0.055 |
| **每 day（5 campaign/tenant）** | 175 calls | **$1.75/day** | $0.275/day |
| **vs $5/day/tenant cap** | — | **远低于 cap（35% 利用率）** | — |

**关键判断**：meter view（count × $0.01）和真实 token spend 都远低于 $5 cap。BL-067 不会误触 cap。
**触发 BL-040 真实 cost meter 升级的条件**：dogfood 期发现 5+ marketers daily 100+ campaign 创建 → 单 day 接近 $5 cap → 升真实 cost 模型分散计费。

### 风险表

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 输出质量低于预期（C2 占位反而更准） | 中 | 高 | F007 staging dogfood 1-2 周；用户接受率 < 30% 则启动 prompt 调优或裁掉 detailed 仅留 short |
| cost 估算偏低（实际 token > $0.0015/call） | 低 | 中 | F007 24h cost 监控 → 超 $5 cap 即 silent fallback；BL-034 F005 cap 中央策略已 proven |
| InMemoryJobQueue 进程重启丢 prewarm（per F001 audit §4:B 已知风险） | 低 | 低 | mount self-heal 重新 enqueue；PM2 single instance reload 频率 ≤ 2 次/day 风险可控；dogfood 期超频 → 升级 BullMQ（fix-round 或下批次） |
| asset 表膨胀（24h TTL 后未清理） | 低 | 低 | F002 同 commit 加 cleanup script + GitHub Actions cron（per F001 audit §5:A 06:30 或 14:30 BJT） |
| 5 locale JSON 输出 token 超限 | 低 | 中 | F001 prompt 中明确"每条 ≤ 80 字"+ JSON 模式压缩；超限 retry 1 次后 fallback |
| BL-066 dogfood 反馈推翻假设（如用户根本不点 `?`） | 中 | 中 | F004 可降级为 inline expand 或裁掉详细版仅留 short — 但 BL-067 已 lock，调整走 fix-round |
| aigcgateway 月预算超限（$100/月 + BL-067 月增 $5-10） | 低 | 中 | 当前余额 ~$49.60 充足；超限时启动 BL-042 max_tokens 治理（roadmap §8 已排 medium 优先级） |

---

## §7 下一批后续

- **BL-068** B3 自然语言 refine — Phase 3 第二批，依赖 BL-067 done。reuse aigcgateway 调用模式，新建 `kol-refine-natural-language` action 解析自然语言为 filter 调整 + 重排 top 30
- **BL-069** Brief 页合并（KB + Campaigns/new）— Phase 4 第一批
- **BL-070** Reach + Insight 页适配新 IA + 二次清理（i18n deprecated keys / 旧路由清理 / nav 旧 key）— Phase 4 第二批
- **Phase 5 候选**（不在 6-10 周硬上线范围）：
  - 个性化学习（捕获用户接受/拒绝信号 → valueScore 权重调整）
  - skip/replace 升级写 DB（作为 Phase 5 学习数据基础）
  - comparative query（"为什么 @kol45 排在第十位而不是更前？" 对比类自由问答）

---

## References

- ADR-013-ai-native-product-pivot §Decision 第 5 条（C3 双向 explainability）
- docs/product/ai-native-vision.md §3 场景 2 / §3 场景 4 / §7 原则 4 / §8 划界
- docs/product/ai-native-roadmap.md §5 BL-067 / §11 Phase 3 verifying gate
- docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md §F003 acceptance（C2 占位）+ §下一批后续 BL-067
- docs/adr/ADR-009-aigcgateway-integration.md（aigcgateway 集成模式 — BM2 + B5 前例）
- src/lib/cost-cap/check.ts（BL-034 F005 中央 cap 策略，本批次 F002+F004+F005 复用）
- src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx（BL-066 F003 升级目标）
