# BL-084 AI Match Panel — `/match?campaignId` 三列工作台 Spec

> **Sprint：** BL-084-ai-match-panel
> **Type：** Product UX 重塑（重大功能 + 数据模型扩展）
> **预估工时：** ~17h Generator + 1.5h Reviewer ≈ 2.5 day
> **关联：** `src/app/[locale]/(app)/campaigns/CampaignsTable.tsx:137` 入口 / `src/lib/discovery/smart-match.ts` (B7a-F002 复用) / BL-068 LLM refine 同模式 / BL-067 explain
> **状态：** A0 audit done (现状 + smart-match 基础设施现成 + embedding 99.5%) / A1 8 子决策 lock 6/05 → 待 backlog 选启
> **依赖：** BL-083 done (避免分支冲突, 无功能依赖) + embedding 现状无需 prep 批次

---

## §1 背景与触发

### 1.1 触发 + audit 实证

2026-06-05 用户问 "活动页面点匹配 KOL 按钮 当前实现逻辑 + 是否有差距"。Planner 5 维 audit (CampaignsTable + /match page + runMatchSearch + AiSuggestionsSidebar + smart-match 基础设施)：

**当前实现 (BL-074-F002 落地)：**
- 按钮 = `<Link href="/${locale}/match?campaignId=${row.id}">`
- `/match` 主面板 `runMatchSearch()` **完全不读 campaignId** → 显示全租户 KOL 池子按 valueScore 排
- 右侧 `AiSuggestionsSidebar` (仅 320px) 调 `generateCampaignSuggestions()` → 输出 **3 条 workflow 建议** (action_link 跳 /brief/match/reach/insight)，**不是 KOL 推荐列表**
- `MatchRefineBar` (BL-068) 自然语言 refine 仅响应用户输入

**预期 vs 实际 gap (产品视角 6 维)：**

| 维度 | 用户预期 | 实际 | gap |
|---|---|---|---|
| 主列表 | 该 campaign 智能推荐 KOL top-N + match score | 全 KOL 按 valueScore 排 (与 campaign 无关) | 🔴 严重 |
| AI 入口 | 一键即见推荐 | sidebar 需再点 "生成" (lazy) | 🟡 多一步 |
| AI 输出 | KOL 列表 + 匹配理由 | 3 条 workflow 建议 (非 KOL 推荐) | 🔴 输出形式错位 |
| 自然语言搜索 | 无输入也能用 | refine bar 必须输入触发 | 🟡 |
| 匹配度信号 | 每行 "match: 87" badge | 主列表无 match score | 🔴 |
| 推荐理由 | 每行 hover/click 见原因 | BL-067 explain 在 dialog 内 | 🟡 |

**症结：** "匹配 KOL" 按钮 UX 表达与实际行为脱节 — campaignId 是装饰性 URL 参数。

### 1.2 audit 重大发现 — smart-match 基础设施已 ship

**B7a-F001/F002 已落地 (B7a 沉淀):**

| 现有能力 | 状态 | 复用 |
|---|---|---|
| `runSmartMatch({tenantId, productId, topK})` | ✅ ship | F001 升级 topK 默认 |
| `POST /api/kols/smart-match` | ✅ ship | 可不动 |
| Product JIT-embed (NULL → 自动 embed ~300ms) | ✅ ship | 无需改 |
| KOL embedding 99.5% (2371/2383) | ✅ ship | 充分 |
| Product embedding 60%+JIT (3/5) | ✅ ship | 通过 JIT 自动补 |

**campaign brief embedding 不需要** — `campaign.productId → product.embedding` 代理 (product embedding 来自 name + category + targetAudience + uniqueSellingPoints 文本)。

### 1.3 A1 决策 lock (6/05, 8 项)

| # | 决策点 | Lock |
|---|---|---|
| 1 | 推荐源 | **B: embedding 召回 200 + LLM 重排 30** (沿用 BL-068 模式) |
| 2 | 与 /match 关系 | **Toggle 切换** (campaign 模式默认 AI, 可切回 BM1 全 KOL 池) |
| 3 | 数据模型 | **A: 复用 kol_campaign + 加 suggestion_status enum** (suggested/accepted/skipped/swap_pool) |
| 4 | embedding 依赖 | **无需独立批次** (KOL 99.5% / Product JIT 现成) |
| 5 | LLM 重排输出 | **含 matchReason 短文本** (~15 词/KOL, ~$0.011/call) |
| 6 | Accept 交互 | **一键 Accept 直接写 DB + 5s Undo** |
| 7 | Swap 池子 | **可选 Swap = drag/move 到候补列** (高频 "marketer 逆悔" 场景) |
| 8 | Toggle 默认 | **campaignId 有 → AI; 无 → 全池** |

### 1.4 角色分配

`role_assignments = null` (默认: Generator + Codex Reviewer)

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- **F001** `runSmartMatch` 升级 (topK 默认 30 + campaignId 参数 log + cache key)
- **F002** LLM 重排服务 `src/lib/match/llm-rerank.ts` + aigcgateway action 注册
- **F003** Schema migration: `kol_campaign` 加 `suggestion_status` enum + `suggested_at` + `decided_at` + `match_score` + index + ROLLBACK SQL
- **F004** Server action `getCampaignSuggestions(campaignId)` 编排 cosine + LLM rerank + 24h cache (key `campaign-ai-suggestions-{tenantId}-{campaignId}`)
- **F005** Server actions `acceptKol / skipKol / swapKol` + audit_log + 5s Undo state
- **F006** UI `MatchAiPanel.tsx` 三列 + KolCard 升级 (match badge + reason chip + 3 按钮)
- **F007** `/match/page.tsx` toggle 路由 + campaignId 默认 AI 逻辑
- **F008** i18n 5 locale 新 key
- **F009** Codex Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- 现 AiSuggestionsSidebar (3 条 workflow 建议) — 保留 (campaign 模式下与 AI Panel 并存或迁到 detail page TBD per F006 UX)
- 现 MatchRefineBar (BL-068) — 保留 (与 AI Panel 互补: AI Panel = 默认推荐, refine = 自然语言重排)
- 主列表 vector index 优化 (pgvector ivfflat) — 现 KOL pool 2371 cosine 查询 <100ms 够用, >100K 再考虑
- 跨 campaign 推荐去重 (同 KOL 在 5 个 campaign 都被推) — 业务上是 feature 非 bug
- Tinder swipe / keyboard shortcuts — 留独立 polish 批次
- LLM rerank 模型升级 (haiku→sonnet) — 留 cost/quality 评估后单独决策

### 2.3 不变量

1. **不破坏现有 `runSmartMatch` 既有 caller** (B7a 旧 /smart-match API 路径) — F001 升级保持向后兼容 (新参数 optional)
2. **不破坏现 /match 全 KOL 池子体验** (toggle 切回时完整 BM1 行为)
3. **不破坏现 `kol_campaign` 表读取** (新 suggestion_status enum 默认 'accepted' for 现存行 — `prospect` legacy 行 migration 时映射到 'accepted' 保持显示)
4. **24h cache 失效兼容** — manual refresh 按钮 + product/brief 改动自动失效 (per Hash)
5. **migration 必带 ROLLBACK SQL**
6. **0 业务路径破坏**: discovery / match / reach / insight / outreach 现有 join `kol_campaign` 的语义不变
7. **rate limit**: 同 BL-068 单 tenant ≤10 req/min `getCampaignSuggestions`

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit (CampaignsTable + /match + runMatchSearch + smart-match 现状) | ✅ done 6/05 |
| **A1** | 8 子决策 lock | ✅ done 6/05 |
| **B** | F001 runSmartMatch 升级 | 0.5h | Generator |
| **C** | F002 LLM 重排服务 | 3h | Generator |
| **D** | F003 Schema migration | 1.5h | Generator |
| **E** | F004 Server action 编排 + cache | 2h | Generator |
| **F** | F005 accept/skip/swap actions + Undo | 2h | Generator |
| **G** | F006 UI MatchAiPanel 三列 | 4h | Generator |
| **H** | F007 toggle 路由 | 1.5h | Generator |
| **I** | F008 i18n | 1h | Generator |
| **J** | F009 Reviewer L1+L2 + signoff | 1.5h | Codex |

**Critical path：** B→C→D→E→F+G+H 并行 → I → J

---

## §4 验收门槛 (5 dimensions)

### 4.1 功能正确性

- F001 `runSmartMatch({topK: 30, campaignId})` 返 30 个 KOL + matchScore + valueScore
- F002 LLM 重排测：input 30 KOL + campaign meta → output 30 KOL + matchReason (每条 ≥5 词 ≤30 词)，rank order 与 input 不同 (证明真重排)
- F003 migration: `\d kol_campaign` 显新 4 字段 + index `kol_campaign_suggestion_status_idx`
- F004 server action 抽样：第一次调 5-10s + 24h 内同 campaignId 调 <100ms (cache 命中)
- F005 Accept/Skip/Swap 写 audit_log 抽样：每动作一条 `kol.campaign_suggestion_decided` event with status + actor
- F006 UI 三列：拖拽 Swap 抽样 ≥3 KOL，列间数据立即更新
- F007 toggle：`?campaignId=X` 默认 AI panel；toggle 点 [全 KOL 池] 切回 runMatchSearch；URL 同步保持 `?campaignId=X&view=full-pool`
- F008 i18n 5 locale 新 key grep 无 missing

### 4.2 量化提升

- 主列表带 match score: 100% AI 模式下 KOL 行展示 match badge (0-100)
- AI 推荐覆盖率：`getCampaignSuggestions` 30 条返回率 ≥95% (其余 5% 来自 KOL pool 不足 30 或 LLM rerank fail)
- 5s Undo 命中率：Undo 按钮可点击窗口 5s 内 100% 撤回
- 24h cache 命中率：staging 抽样 next-24h 内同 campaignId 重复调 cache hit ≥80%

### 4.3 成本影响

- LLM rerank 单次 ~$0.011 (haiku-4.5, ~1000 tokens input + 500 output)
- 24h cache 后 99% 调用 cache 命中
- 实际月成本 (假设 5 active campaigns + 各 2-3 次/天 refresh) ≈ **<$1/月**

### 4.4 数据完整性

- migration 不丢现 kol_campaign 行 (additive)
- legacy 行 suggestion_status 默认 'accepted' (per §2.3 不变量 #3) — 不显示在推荐列
- ADR-worthy: kol_campaign 推荐生命周期 4 态 (suggested→accepted/skipped/swap_pool/cancelled) 起 `docs/adr/ADR-016-kol-campaign-suggestion-lifecycle.md`

### 4.5 framework / 文档

- `framework_reviewed` 由 F009 done 收尾决定
- `docs/dev/match-runbook.md` 新建 §"AI Match Panel" 段说明
- ADR-016 起草 (kol_campaign suggestion_status 4 态生命周期)

---

## §5 风险与已知边界

| 风险 | 缓解 |
|---|---|
| **LLM rerank fail (timeout/quota/API error)** | 降级返 embedding cosine top-30 (无 matchReason)，UI 显 "AI 重排暂不可用" warning |
| **24h cache 过时 (KOL pool / brief 变化)** | F004 cache key 含 product.embeddingTextHash → 自动失效；manual refresh 按钮强制重生成 |
| **5s Undo 失效 (用户 navigate away)** | Undo state 仅 client-side；如离开页面则 accept 永久。Tooltip 提示 "5s 内可撤回, 离开后无效" |
| **Swap 池子无限增长** | Swap 池子按 campaign cap 50 KOL；超出时 oldest swap out 提示 |
| **legacy prospect 行 status 迁移歧义** | Migration script: existing prospect → 'accepted' (保留 BM1 行为) + audit_log 'migration.kol_campaign_status_backfill' |
| **multi-tenant cache 隔离** | cache key 含 tenantId; Redis 按 tenant 隔离 |
| **Toggle 状态 URL vs localStorage** | F007 用 URL `?view=ai|full-pool`, 不依赖 localStorage |
| **prod 部署 schema migration block daily-sync** | 选低峰 (BJ 03:00) + migration `IF NOT EXISTS` 防重复 apply |

---

## §6 完成定义 (DoD)

- [ ] F001-F008 全 PASS (features.json acceptance)
- [ ] F009 Reviewer signoff `docs/test-reports/BL-084-signoff-2026-06-XX.md` 含 L1/L2 实测
- [ ] Staging 验：AI Panel 三列工作 + Accept/Skip/Swap 数据流闭环 + Undo 5s 内可撤
- [ ] Prod 部署后 next-7d 监控：AI Panel 加载 P95 <12s (首次), <500ms (cache hit)
- [ ] commit message 含 `feat(BL-084-F00X):` 标签对应 features.json
- [ ] ADR-016 起草并入 git
- [ ] `docs/dev/match-runbook.md` 新建
