# BL-067-F001 Pre-Impl Audit — Spec ↔ Codebase Drift 裁决

> **起草：** 2026-05-15 北京 / Generator johnsong
> **状态：** 待 Planner 裁决（per framework v0.9.21 `framework/harness/pre-impl-adjudication.md` 模式，BL-066 已 3 次审计验证 ROI）
> **批次：** BL-067-explainability-c3 building（progress.json status=building, 0/7 features done）
> **影响范围：** F001 spec acceptance / F002 spec acceptance / F005 spec acceptance / 部分 §5 不变量措辞
> **参考前例：** BL-066 F002 audit (e2d6b71) / F006 audit (a682cde) / F007 audit (用户裁决 #7=B + #8=C)

## 起因

Generator 启动 building 阶段前置检查时，对照 spec 路径 + 函数签名扫描 codebase，发现 5 处 spec 与现实不符。如直接落 F001 prompt design + action 注册，下游 F002 / F004 / F005 实装时会撞死多次 → 浪费 build/fix 轮次。先起一次性 audit 请 Planner 裁决。

---

## §1 ISSUE-1：cost-cap 路径 + 函数签名错位（影响 F002/F004/F005）

### 现实

| 项 | spec §F002 §F004 §F005 写 | 实际 codebase |
|---|---|---|
| 文件路径 | `src/lib/cost-cap/check.ts` | `src/lib/ai/cost-cap.ts`（BL-034 F005，commit 历史可查） |
| 主函数名 | `checkLlmCostCap(tenantId)` | `assertDailyCostBudget(tenantId)`（**throws** `AiDailyCostExceededError`） |
| 返回 | `{ allowed: boolean; remainingUsd: number }` | `Promise<void>` — 抛 throw 而非 boolean |
| 计费 | spec §6 估算 `~$0.055/campaign`（按实际 token cost） | **count × $0.01 flat estimate**（MVP 简化，BL-034 注释明确点出 BL-040+ 才升真实 costUsd） |
| meter | spec 未规定 | `recordAiUsage(tenantId, action, costUsd=0.01, extras?)` — BL-044 F004 已开 extras 字段 |

调用模式实测（`src/lib/email/customize.ts` :140 + `src/lib/kol-detail/topic-cloud.ts`）：

```typescript
try {
  await assertDailyCostBudget(tenantId);
} catch (err) {
  if (err instanceof AiDailyCostExceededError) {
    // 业务层重新包装为自有错误码
  }
  throw err;
}
// ... aigcgateway 调用 ...
await recordAiUsage(tenantId, "kol_email_customize");
```

### 影响

- F002 acceptance "导入 `src/lib/cost-cap/check.ts` `checkLlmCostCap`" → **文件不存在 / 函数不存在**
- F004 流程 "MISS → `checkLlmCostCap(tenantId)` → 满 → 返回 fallback" → 需要 boolean 而非 throw，silent fallback 不 throw 即可
- F005 worker "每 KOL `checkLlmCostCap(tenantId)` → 满 → break" → 同 F004 需要 boolean

### 选项

- **A（Generator 推荐）：** F002 范围内新增轻量包装 `checkLlmCostBudget(tenantId): Promise<{ allowed: boolean }>` 到现有 `src/lib/ai/cost-cap.ts`（≤15 LOC，**复用同一 count 查询逻辑**），导出与 spec §F004/F005 流程契合的 boolean 形态。`assertDailyCostBudget` 不动（向后兼容 customize.ts / topic-cloud.ts）。F004 + F005 调用新函数无 try/catch 噪音。
- **B：** F004 + F005 直接 try/catch `assertDailyCostBudget` 包 `AiDailyCostExceededError`。零新代码但每个 caller 写一遍 try/catch（4-5 处）。
- **C：** 改 `assertDailyCostBudget` 返回值（破坏 BL-034 customize.ts + topic-cloud.ts 已有 caller）。**Reject** — 违反铁律 #10 跨批次影响。

### Generator 建议

**#1：A** — 同 commit F002 加 `checkLlmCostBudget()` 包装。15 LOC 新增 + 0 LOC 修改。

---

## §2 ISSUE-2：计费模型与 spec 估算口径不符（影响 §6 cost / §5 不变量 #1）

### 现实

BL-034 现行 `assertDailyCostBudget` 的成本估算 = `today's count × $0.01 flat`（src/lib/ai/cost-cap.ts:43 + 83-85）。**不读 aigcgateway 返回的真实 cost / token usage**。注释明确："BL-040+ 将 graduate to a dedicated `ai_usage` table with actual costUsd numerics"。

`recordAiUsage(tenantId, action, costUsd=0.01, extras?)` 允许 caller 传入 `costUsd` 写入 `event_log.payload`，但 **assertDailyCostBudget 当前只 count(*) 不 SUM(costUsd)**。

### 影响

- spec §6 风险表 "cost 估算偏低（实际 token > $0.0015/call）" — 假设了精确 token cost；现实是 `$0.01 × count` flat。
- spec §6 cost 估算 "~$0.055/campaign"（推断按 token-based pricing）— 实际 meter 视角："30 calls × $0.01 = $0.30/campaign"（30 KOL pre-warm + 5 locale 在 1 call 内完成）。
- 决策点 #6 "haiku-4.5 + 沿用 BL-034 F005 cap $5/day/tenant" — meter view 下 cap = 500 calls/day/tenant。BL-067 pre-warm = 30 calls/campaign → 5 campaigns/day = 150 calls + detailed dialog 重度用户 ≤350 次点击 = 满 cap。**实际 token spend ≪ $5（按 haiku-4.5 实价估算 $0.30-$1/day）。**

### 选项

- **A（Generator 推荐）：** 沿用 flat 模型，BL-067 本批次不升级 cost-cap.ts 计费。spec §6 estimation table 改写为 "meter view: 30 calls/campaign = $0.30 (count × \$0.01 flat)，实际 token spend 预估 ≪ \$5/day 远低于 cap"。BL-040+ 单独 batch 升级真实 cost。
- B：F002 同 commit 升级 `assertDailyCostBudget` 走 `SUM(payload->costUsd)` raw SQL（破 BL-034 MVP 注释自定的边界 → BL-040 提前到 BL-067）。**Reject** — 不在 BL-067 spec acceptance 范围 + ADR-013 已 lock 路线。
- C：BL-067 自建独立 cap，不复用 BL-034。**Reject** — 违反决策点 #6 lock。

### Generator 建议

**#2：A** — 沿用 flat。spec §6 措辞调整由 Planner 落实（如在 done 阶段更新 spec / 或不更新留 BL-040 落地点）。

---

## §3 ISSUE-3：`valueScoreBreakdown` 4 维度数据源 — 不在 smart-match 返回值（影响 F001 prompt + F005 worker）

### 现实

- `src/app/api/kols/smart-match` 返回的 `SmartMatchKolHit` (src/lib/discovery/smart-match.ts:50-73) 仅暴露 `valueScore: number | null`（合并 total），**无 breakdown**。
- `src/lib/kol/value-score.ts:87 computeKolValueScore(input)` **已返回 `{ score, breakdown: { follower, engagement, category } }`**（ADR-014 公式 v2 实装的 BL-066 F007 commit 71c6ef0）。
- spec §5 不变量 #8 "prompt 必含 valueScoreBreakdown 4 维度细分分数" — 数据存在但需要 F005 worker 主动调用 `computeKolValueScore(input)` 复算（**不**走 smart-match endpoint，**直接 import**）。

### 影响

- F005 worker step 4 input 拼装：`{ kol: { id, name, followerCount, engagementRate, categories[] }, ..., valueScoreBreakdown: { followerScore, engagementScore, categoryScore, total } }` — 需新增 1 行 `computeKolValueScore({ followerCount, engagementRate, categories, engagementAuthenticity })` 拿 breakdown。
- F001 prompt design：清晰列出 `value_score_breakdown_json` 的 4 个字段名 + 数值范围（follower ∈ [0,80] / engagement ∈ {8,12,16,20,25} / category ∈ [0,15] / total ∈ [0,100]），LLM 才能生成 vision §3 场景 2 那种 "15.5% engagement (top 5%)" 解释。

### 选项

- **A（Generator 推荐）：** F005 worker import `computeKolValueScore` from `@/lib/kol/value-score`，每 KOL inline 调用拿 breakdown，零额外查询/网络成本（纯计算 + 已有 KOL 行的 follower/engagement/categories 字段）。
- B：升级 smart-match endpoint 返回 breakdown（侵入 BL-066 已 frozen 的 panel 数据流）。**Reject** — 跨批次。
- C：spec §5 不变量 #8 降级为 "prompt 含 valueScore total + 原始 follower/engagement/categories 字段"，不强求 breakdown。**功能可工作但 LLM 解释质量降级**，违反决策点 #1 lock + ADR-013 explainability 原则 4。

### Generator 建议

**#3：A** — F005 worker inline import + 调用 `computeKolValueScore`。零侵入。

---

## §4 ISSUE-4：BullMQ 不存在 — InMemoryJobQueue 现状（影响 F005 acceptance）

### 现实

- `src/lib/jobs/queue.ts` 第 1-3 行 + 类名：`InMemoryJobQueue`，注释明确 "MVP ships with an in-memory executor; the B5 sprint will swap in a BullMQ-backed implementation without touching any call sites"。
- **当前支持**：`idempotencyKey`（Map 持久化于进程内）+ `add(name, payload, options)` + `register(name, handler)`。
- **当前不支持**：worker concurrency（inline 执行）/ retry / backoff / 跨进程 / 持久化（进程重启全丢）。
- `src/lib/redis.ts` 存在（rate-limit 用，BL-020 F005 lock 后）— BullMQ 接 Redis 的 dependency 已 ready。

### 影响

F005 spec 写：
- "新 worker `src/lib/queue/explain-recommendations-worker.ts` 处理 job type `recommendation-explain-prewarm`"
- "Worker concurrency=2"
- "retry=1（仅网络错误 retry）"
- "jobId 幂等"
- "用户进出页面多次不会触发重复 LLM 调用"

**spec assumed BullMQ**，但 codebase 无 BullMQ。如硬走 InMemoryJobQueue：
- inline 执行 → mount 时 `enqueueExplanationPrewarmAction` server action **阻塞** 用户 30 KOL × LLM 调用 ~5-30s（决策点 #2 "异步 pre-warm" 破坏）
- 进程重启 → idempotency Map 丢失 → 用户重 enter campaign 重新触发 LLM
- 单进程 → PM2 cluster=1 当前架构 OK；未来 scale-out 失效

### 选项

- A：F005 范围 += BullMQ wiring (~8-12h 增量)。引入 `bullmq` npm dep + 新建 `src/lib/queue/bullmq.ts` worker / queue 抽象 + 改 `src/lib/jobs/queue.ts` 实现注入策略 + 改 instrumentation.ts 启动 worker → spec acceptance 完整满足。
- **B（Generator 推荐）：** 当前批次走 InMemoryJobQueue + `idempotencyKey`，**fire-and-forget pattern**：server action `enqueueExplanationPrewarmAction` 内 `void jobQueue.add('recommendation-explain-prewarm', payload, { idempotencyKey: 'prewarm-' + tenantId + '-' + campaignId, delay: 1 })` — `delay:1` 让 `setTimeout(0)` 把 LLM 跑入下一 tick，server action 立即 return，不阻塞 mount。spec acceptance "worker concurrency=2" 措辞调整为 "InMemoryJobQueue inline 模式 + delay:1 异步触发"，"retry=1" 由 worker handler 内手写一层 try/catch + 1 次重试覆盖。**风险已知：进程重启丢 prewarm（无 persistence）**，但 mount 触发 self-heal — 用户重 enter 同 campaign 自动再触发，spec §5 不变量 #10 "prewarm jobId 幂等" 在同进程内 OK。
- C：F005 推迟到 B5 BullMQ swap 完成的下一个 batch；BL-067 本批次仅 F004 dialog 路径主动按需生成。**推翻决策点 #2 lock**，需要用户重新 ack。
- D：F005 范围 += BullMQ swap-in（与 A 等价表述 — B5 sprint 原计划 deferred）。

### Generator 建议

**#4：B** — fire-and-forget InMemoryJobQueue。spec §F005 acceptance 措辞 + §5 不变量 #10 接受小幅调整。**保留 A 作为 fallback：** 如 Planner 认为 "进程重启丢 prewarm" 风险不可接受（PM2 reload 频率 > 用户 mount 频率），则升级到 A 接 BullMQ。

**估算差：** A +8-12h；B +0h（spec measurement 范围内）；C 推翻决策点。

---

## §5 ISSUE-5：Asset cleanup 现状 — 无现有 cron（影响 F002 acceptance 末端）

### 现实

- 全仓 `find scripts/ -name "*cleanup*expired*" -o -name "*expired*asset*"` 返回空。
- 全仓 `grep -r "expired.*asset\|asset.*cleanup"` 返回空。
- `prisma/schema.prisma:620-644` Asset model 无 TTL 字段 / 无 GC 索引。

### 影响

F002 acceptance "Cleanup 调研：F002 起工前先 grep 现有 asset cleanup 机制；如已有 → 沿用；如无 → F002 范围同 commit 加 `scripts/cleanup-expired-explanation-assets.ts` per-day cron 删 24h 过期行" → **确认无现有 → 必须新增**。

### 选项

- **A（Generator 推荐）：** F002 范围同 commit 加 `scripts/cleanup-expired-explanation-assets.ts`（仅删 type IN (ai_recommendation_explanation_short, ai_recommendation_explanation_detailed) + createdAt < now - 24h 的行），cron schedule 由 `.github/workflows/cron-*.yml` 或 server crontab 配置（与 BL-027 daily sync 同模式）。
- B：F002 范围内不加 cleanup，asset 表持续膨胀至下游 batch 收尾。**Reject** — spec §6 风险表点出此项。

### Generator 建议

**#5：A** — 同 commit 加 cleanup script + GitHub Actions workflow (cron 每日 04:30 BJT，避开 daily sync 04:00-06:00 窗口 — per ADR-014 注释)。

---

## §6 ISSUE-6（额外）：aigcgateway action 调用现状 — 无统一抽象层（影响 F001/F004/F005 重复代码）

### 现实

- `src/lib/email/customize.ts:128-237` — inline `POST /actions/run` + `parseFencedJson` + cost-cap + audit + error mapping
- `src/lib/kol-detail/topic-cloud.ts:121-179` — 同模式 inline 重写一遍
- 无统一 `aigcgatewayClient.runAction(actionId, variables)` 封装

spec §F005 acceptance "aigcgatewayClient.runAction(AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID, input)" — 抽象层假设存在但实际**不存在**。

### 影响

F004 + F005 两 caller 如各自 inline POST → 重复 ~80 LOC × 2 = 160 LOC 复制粘贴 + 后续维护两份 error mapping / retry / timeout 逻辑分叉。

### 选项

- **A（Generator 推荐）：** F001 范围 += 新建 `src/lib/aigc/run-action.ts` 统一 SDK 封装：
  ```typescript
  export async function runAigcAction<T>(opts: {
    actionId: string;
    variables: Record<string, string>;
    tenantId: string;          // 用于 cost-cap meter
    actionLabel: string;        // 用于 recordAiUsage meter
    timeoutMs?: number;         // default 15s
  }): Promise<{ output: T; usage: { totalTokens: number; costUsd: number }; traceId: string | null }>
  ```
  内部：assertDailyCostBudget → POST /actions/run → parseFencedJson → recordAiUsage → typed return。F004 + F005 两 caller 各 ~20 LOC 调用。
- B：F004 + F005 各自 inline POST（与 customize.ts / topic-cloud.ts 三份重复）。**Reject** — 后续 BL-068 B3 自然语言 refine 还会再 inline 第四份。
- C：F001 范围内不加抽象层，BL-068 下批次再统一。**Reject** — F004 + F005 仍然要写 inline，沉淀点错过。

### Generator 建议

**#6：A** — F001 commit 同时落 `src/lib/aigc/run-action.ts` 统一抽象层。F001 估算工时 4h → +2h = 6h（含 ≥4 unit tests + 复用现有 fetchWithRetry / xml-escape / parseFencedJson 三个 BL-034 / BL-035 已沉淀基础设施）。**沉淀价值：** BL-068 + 未来所有 action caller 不再重复 inline POST。

---

## §7 裁决汇总表 (Generator 默认建议)

| # | 议题 | 默认建议 | 影响范围 | 增量工时 | 风险 |
|---|------|---------|---------|---------|------|
| #1 | cost-cap 函数签名 | **A：F002 加 `checkLlmCostBudget` 包装** | F002 | +0.5h | 低（15 LOC 新增） |
| #2 | 计费模型口径 | **A：沿用 flat，spec 措辞调整** | spec §6 doc | +0h | 低（meter 视角清晰） |
| #3 | valueScoreBreakdown 4 维 | **A：F005 inline `computeKolValueScore`** | F005 | +0h | 零（已存在 pure 函数） |
| #4 | BullMQ vs InMemory | **B：fire-and-forget InMemory + delay:1** | F005 | +0h | 中（进程重启丢 prewarm，self-heal mitigate） |
| #5 | Asset cleanup cron | **A：F002 加 cleanup script** | F002 | +1h | 低 |
| #6 | aigcgateway 统一 SDK | **A：F001 范围 += run-action.ts** | F001 | +2h | 低（复用现有基础设施） |

**总工时变化：** spec 估算 6 day Generator → +3.5h ≈ 同 6 day（在估算偏差范围内）。

---

## §8 待 Planner 回执

请就 §1-§6 六项给出裁决（格式 `#1:A / #2:A / #3:A / #4:B / #5:A / #6:A` 或偏离 + 简短理由），Generator 收到后立即起 F001 开工。

如 Planner 偏离 #4 选 A（升级 BullMQ）：F005 估算 +8-12h，可能需要分拆 F005 为 F005a (BullMQ swap-in) + F005b (worker + trigger)。

如 Planner 偏离 #6 选 B（不抽 SDK 层）：F001 估算保持 4h，F004 + F005 各自 inline ~80 LOC。

如有 #7 议题在 Generator 落地中未识别：Planner 可直接 in-line 补充。

---

## References

- `docs/specs/BL-067-explainability-c3-spec.md` @ commit 5275a79（本 audit 的对象）
- `src/lib/ai/cost-cap.ts`（BL-034 F005 实装，§1 §2 evidence）
- `src/lib/email/customize.ts` + `src/lib/kol-detail/topic-cloud.ts`（§6 重复代码 evidence）
- `src/lib/jobs/queue.ts:1-3` + `src/lib/redis.ts`（§4 InMemoryJobQueue evidence）
- `src/lib/kol/value-score.ts:87 computeKolValueScore`（§3 evidence）
- `docs/adr/ADR-014-value-score-formula-v2.md`（§3 breakdown 公式 source）
- `framework/harness/pre-impl-adjudication.md`（BL-066 已 3 次审计模式，v0.9.21 ROI 验证）

---

## §9 Planner 裁决（2026-05-15 11:30 BJT / johnsong）

### 裁决汇总

| # | 议题 | 裁决 | 与 Generator 推荐 |
|---|------|------|------------------|
| #1 | cost-cap 函数签名 | **A** | ✓ 一致 |
| #2 | 计费模型口径 | **A** | ✓ 一致 |
| #3 | valueScoreBreakdown 数据源 | **A** | ✓ 一致 |
| #4 | BullMQ vs InMemory | **B** | ✓ 一致 |
| #5 | Asset cleanup cron | **A** | ✓ 一致 |
| #6 | aigcgateway 统一 SDK | **A** | ✓ 一致 |

**6 项全 ack Generator 默认建议。** 总工时 +3.5h（spec 6 day 估算偏差范围内，不重排）。

### 各项裁决理由（简短）

**#1:A** — 15 LOC 包装最小侵入。`assertDailyCostBudget` 不动保 customize.ts / topic-cloud.ts 向后兼容，BL-067 4-5 处 caller 复用 `checkLlmCostBudget` boolean API 减 try/catch 噪音。

**#2:A** — flat 模型属 BL-034 MVP 注释自定边界（"BL-040+ graduate"），BL-067 不越界。meter view 30 calls × $0.01 = $0.30/campaign × 5/day = $1.50/day ≪ $5 cap，**安全余量足够，不会误触 cap**。spec §6 cost 估算口径修订（meter view 写明 + 真实 token spend 预估保留作 BL-040 触发点参考）由本 commit 同步落实。

**#3:A** — `computeKolValueScore` 是 pure 函数 + KOL 行已有 follower/engagement/categories 字段，inline 调用零额外查询。决策点 #1 lock + ADR-013 explainability 原则 4 必须保留 4 维度细分分数喂 LLM，C 降级直接拒。

**#4:B** — 4 条理由支撑：（1）当前 PM2 是 cluster=1 single instance，多 worker 并发 / 跨进程不是痛点；（2）BullMQ 引入是 B5 sprint 原计划独立 batch 推进，不属于 BL-067 spec acceptance；（3）InMemoryJobQueue + delay:1 已满足决策点 #2 "异步 pre-warm" 不阻塞 mount；（4）进程重启丢 prewarm 风险通过 mount self-heal mitigate（用户重 enter campaign → 重新 enqueue 同 jobId），可观察 dogfood 期 PM2 reload 频率确认实际影响。**如 dogfood 期发现 PM2 reload 频次 > 2 次/day 或用户报 short explanation 频繁 miss，BL-067 done 时评估是否升级 BullMQ（作 fix-round 或下个 batch）。**

**#5:A** — spec §6 风险表"asset 表膨胀"必须根治。**Generator 起工前必 confirm cron 时机**：实测 daily sync 真实 schedule（参考 `scripts/kol-sync-daily.ts` 或 `.github/workflows/` cron yml），cleanup cron 选不冲突时段（推荐 **06:30 BJT** 或 **14:30 BJT** 避开任何 daily 自动 sync 窗口）。Audit doc §5 "04:30 BJT" 时机错（在 04:00-06:00 cron 静默窗内），Generator 起工时修正。

**#6:A** — 三份 inline 实测案例（customize.ts + topic-cloud.ts + BL-067 即将再加 2 处）+ BL-068 还会再加 1 处 → 沉淀点错过将持续付出 cost。F001 +2h 抽 `src/lib/aigc/run-action.ts` SDK 抽象层最经济。**约束：** 不动 customize.ts / topic-cloud.ts 现有 caller（向后兼容），仅 BL-067 新 caller 用新抽象。长期迁移 customize.ts + topic-cloud.ts 留 BL-068 done 阶段评估（作 proposed-learning 候选）。

### F001 / F002 / F005 spec acceptance 同步修订（本 commit 落地）

**F001（4h → 6h）：**
- ✅ acceptance 新增 1 条：建立 `src/lib/aigc/run-action.ts` 统一 SDK 抽象层（runAigcAction<T>(opts) 含 cost-cap + audit + typed return）+ ≥4 unit tests 复用现有 fetchWithRetry / xml-escape / parseFencedJson

**F002（8h → 8.5h）：**
- ✅ "导入 src/lib/cost-cap/check.ts checkLlmCostCap" → 改 "在现有 `src/lib/ai/cost-cap.ts` 加 15 LOC 包装函数 `checkLlmCostBudget(tenantId): Promise<{ allowed: boolean }>`（复用同一 count 查询逻辑，assertDailyCostBudget 不动）"

**F005（12h → 12h）：**
- ✅ "Worker concurrency=2 + retry=1" → 改 "InMemoryJobQueue + delay:1 fire-and-forget 模式（server action 立即 return 不阻塞 mount）+ worker handler 内手写 1 次 retry（仅网络错误）"
- ✅ "为 5 locale 全 hit 则 skip" → 锁定 worker step 4 input：F005 worker inline import `computeKolValueScore from '@/lib/kol/value-score'`，per KOL 计算 valueScoreBreakdown breakdown.{follower, engagement, category}

**spec §5 不变量同步调整：**
- ✅ #1 表述微调：cost cap 复用现 `src/lib/ai/cost-cap.ts` + F002 加 boolean 包装 `checkLlmCostBudget`
- ✅ #10 措辞调整：InMemoryJobQueue idempotencyKey Map 同进程内幂等；进程重启后 mount self-heal 重新 enqueue 同 jobId

**spec §6 cost 估算表同步调整：**
- ✅ flat $0.01/call meter view 写明：30 calls × $0.01 = $0.30/campaign + 5 campaigns/day = $1.50/day ≪ $5 cap
- ✅ 真实 token spend 估算保留（haiku-4.5 ~$0.0015/call × 30 = $0.045/campaign）作 BL-040 升真实 cost meter 时触发点参考

### Generator 起工动作（裁决回执后立即可起）

1. F001 起 prompt design doc + run-action.ts SDK 抽象层 + MCP create_action × 2 + SSH 落 env vars
2. F002 起工前 grep daily sync cron schedule confirm cleanup 时机不冲突（06:30 / 14:30 二选一）+ schema.prisma AssetType enum 加 2 值 + checkLlmCostBudget 包装 + cleanup script
3. F005 用 InMemoryJobQueue + delay:1 fire-and-forget + inline computeKolValueScore + handler 内 retry

### 若实施中出现 #7+ 新议题

按 v0.9.21 模式，Generator 可单独起 `docs/specs/BL-067-F00X-preimpl-audit-v2.md` 请 Planner 二次裁决，**不要 inline 自行决策**（铁律 #6 executor 边界 + #10 spec-driven feature 号归属）。

---

