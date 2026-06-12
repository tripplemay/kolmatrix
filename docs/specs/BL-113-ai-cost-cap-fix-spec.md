# BL-113 AI 成本上限修复（prod 故障 hotfix）

> **Type：** Hotfix（prod 故障，走铁律 #9：Planner 诊断→用户确认→Generator 实装→Evaluator 验收）。
> **触发：** 2026-06-12 用户报 prod 两处 AI 降级：① /campaigns/[id] AI 推荐 "AI 重排暂不可用 — 按相似度排序"；② KOL 问号 "当前租户每日 AI 配额已用尽，仅显示简要说明"。
> **决策：** 用户确认 A+B 都修；不立即止血（配额 UTC 零点自动重置）。

## §1 根因（prod 实证，已诊断）

两个降级**同一根因**：per-tenant 每日 AI 成本上限被后台任务吃光，前台 AI 全被 `assertDailyCostBudget` 挡。

**prod 查询（2026-06-12，租户 `2b1dcaa2…`）：**
- 今日 `ai.usage` 事件 **500 个，全是 `kol_country_enrichment`**（后台 KOL 国家补全）。
- cost-cap 计为 **$5.00**（= 默认上限 `DEFAULT_LIMIT_USD=5`）→ 触顶。
- 但单次真实成本 ~$0.0009，**500 次真实仅 ~$0.45**。

**两个缺陷叠加：**
1. **`assertDailyCostBudget`（cost-cap.ts:73-83）按 `count(事件) × $0.01` 估算，忽略真实 costUsd** → cheap 后台调用被 11× 高估，凭空触顶。
2. **后台批量任务（country enrichment 等）与前台用户功能共用同一 per-tenant 每日配额** → 后台 backfill 饿死前台。

**利好：** `recordAiUsage` 集中在 `run-action.ts:240` 一处调用，**已传真实 `usage.costUsd`** 进 payload → A 的数据现成；后台标记也在这一处加 flag 即可。

降级链：MATCH_RERANK 走 `run-action.ts:164` assertDailyCostBudget；EXPLAIN 走 BL-067 callers（`checkLlmCostBudget`）；country enrichment 走 `kol-sync/enrichment-stage.ts`。

## §2 Features

> generator 含单测 + L1 全绿。保持 fail-open（limit=0 禁用）+ `AiDailyCostExceededError` 契约不变。

### F001 — A+B 查询侧：cap 改累加真实 costUsd + 排除后台 source（generator）
- `cost-cap.ts` `assertDailyCostBudget`（+ `checkLlmCostBudget`）：把 `count(events) × 0.01` 改为 **`sum(payload->>'costUsd')`**（今日、本租户、`ai.usage`），与 limit 比。null/缺失 costUsd 按 0 或保守小额。
- **B 查询侧**：sum 排除后台标记（`payload->>'source' = 'system'` 或等价）→ 后台 AI 不计入用户前台配额。
- 保持 fail-open（limit≤0 返回）+ 抛 `AiDailyCostExceededError`（金额用真实 sum）。
- 单测（sum 真实成本 / system source 被排除 / 真实达 $5 才触顶 / null costUsd 处理 / fail-open）。

### F002 — B 调用侧：后台 AI 调用打 source=system 标（generator）
- `run-action.ts` runAigcAction opts 加可选 flag（如 `costBucket:'system'|'user'` 默认 user）→ 透传到 `recordAiUsage` extras `source`。
- **后台 call sites 标 system**：`kol-sync/enrichment-stage.ts`（kol_country_enrichment）+ explain prewarm worker（`explain-recommendations-worker` / prewarm-actions，预热是后台）+ grep 识别其它后台/系统触发的 runAigcAction（区分：用户主动触发=user，系统 cron/worker/backfill=system）。
- 前台不动（默认 user）：match_rerank / explain dialog / email_customize / brief_parse / refine / roi_insights 等。
- 单测（后台调用 recordAiUsage 带 source=system / 前台默认 user）。

### F003 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test。
- L2 部署后 prod/staging：① 该租户 AI Match 重排恢复（不再 "AI 重排暂不可用"）② KOL 问号解释恢复（不再 "配额已用尽"）③ 后台 country enrichment 跑不再吃掉前台配额（cap 计数只算前台真实成本）④ cap 反映真实 USD（sum costUsd）⑤ fail-open / 真实达 $5 仍正确触顶。
- signoff `docs/test-reports/BL-113-signoff-2026-06-XX.md`。

## §3 风险与部署

- **B 排除后台后，后台 AI 无 per-tenant 前台上限**：A 的真实成本累加仍是主防护（enrichment 真实极低）。若未来后台 AI 量/单价暴增需独立全局预算 → follow-up backlog（非本批）。
- **A 改后金额口径变真实** → 现有 cost-cap 测试断言需同步（count×$0.01 → sum costUsd）。
- ⚠️ prod 故障，部署 prod 手动触发尽快修复（staging 先验）。OOM NODE_OPTIONS=4096。
- 软 watch：为何 country enrichment 今日 500 次（一次性 backfill vs 每日复发新 KOL）—— A+B 修复后无论哪种都不再饿死前台；量本身是否合理可另查（非阻塞）。
