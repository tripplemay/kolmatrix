# Match Runbook — AI Match Panel (BL-084)

`/match?campaignId=X` 的 AI 推荐三列工作台运维手册。覆盖架构、配置、降级、排障。

---

## 架构概览

```
/match?campaignId=X (view=ai 默认)
  → page.tsx parseAiView gate → 校验 campaign 解析
  → MatchAiPanel (server component)
       ├─ getCampaignSuggestions(campaignId)      [推荐池]
       │    ├─ Redis 24h cache (hit → 返回)
       │    ├─ runSmartMatch(topK 30)             [F001 cosine 召回]
       │    ├─ 排除已决策 KOL (accepted/skipped/swap_pool)
       │    └─ rerankWithReason(...)              [F002 LLM 重排 + reason]
       └─ kol_campaign WHERE suggestion_status IN (accepted, swap_pool)  [其余两列]
  → MatchAiPanelClient (client) — Accept/Skip/Swap/Re-add/Remove/Undo/drag/refresh
```

数据模型见 [ADR-016](../adr/ADR-016-kol-campaign-suggestion-lifecycle.md)。

---

## 配置依赖

| 配置 | 用途 | 缺失后果 |
|---|---|---|
| `AIGCGATEWAY_MATCH_RERANK_ACTION_ID` | LLM 重排 action（`kol-match-rerank`, id `cmq0hrq25016kbnpe2oru2qb0`） | rerank 降级到 cosine 顺序（无 matchReason），panel 仍可用 |
| `AIGCGATEWAY_BASE_URL` / `AIGCGATEWAY_API_KEY` | aigcgateway 调用 | 同上降级 |
| `REDIS_URL` | 24h 推荐 cache | cache 失效→每次实时重算（成本↑，功能不破） |
| `DATABASE_URL` | kol_campaign + embedding 查询 | 硬失败 |

> env var 落地流程见 `.auto-memory/environment.md` "AIGCGATEWAY" 段 + "修改流程"。
> **重要 ops 经验**：`pm2 reload --update-env` 不重读 env_file，必须先 `set -a; source .env; set +a` 再 reload。

---

## 成本模型

- LLM rerank 单次 ~$0.011（haiku-4.5，30 候选 input ~1.4k / output ~0.5k token）。
- 24h cache 后 99% 调用命中（同 campaignId + 同 product embeddingTextHash）。
- 任一决策（accept/skip/swap）+ product/brief 改动 → cache 自动失效（key 含 embeddingTextHash + SCAN-prefix DEL）。
- 预估月成本（5 active campaigns × 2-3 refresh/天）≈ **<$1/月**。
- 监控：`event_log WHERE type='smart_match.invoked'`（含 campaignId）+ `llm_rerank.fallback`（降级率）+ aigcgateway `list_logs`。

---

## 降级路径

| 故障 | 行为 | 信号 |
|---|---|---|
| LLM rerank timeout/quota/解析失败/schema 不符/permutation 非法 | 返回 cosine 顺序 + 无 reason + `rerankFallback=true` | UI 顶部 "AI 重排暂不可用" warning；`event_log type='llm_rerank.fallback'` payload.reason |
| action 未配置 | 同上（reason=`action_not_configured`） | 检查 env var |
| Redis down | cache read/write swallow → 每次实时重算 | `[getCampaignSuggestions] cache read/write failed` console |
| campaign.productId IS NULL | `product_missing` → panel 显错误 banner | UI errorProductMissing |
| campaignId malformed / RLS 不可见 | fall through 全 KOL 池（full-pool） | data-ai-view 不出现 |

---

## 排障

### 推荐池空 / 加载中不消失
1. campaign 是否绑 product？`product_missing` → 关联 product。
2. product 有 embedding？runSmartMatch JIT-embed 首次 ~300ms；查 `product.embedding_text_hash IS NOT NULL`。
3. KOL pool 有 embedding？`SELECT count(*) FROM kol WHERE embedding IS NOT NULL`（现状 99.5%）。
4. 已决策 KOL 占满？top-30 cosine 全被 accept/skip/swap 排除 → 池可能 <30 甚至空；refresh 或扩 topK。

### 所有推荐都没有 reason（chip 不显示）
→ LLM rerank 在降级。查 `event_log type='llm_rerank.fallback'` 最近 reason；检查 `AIGCGATEWAY_MATCH_RERANK_ACTION_ID` 是否落到 `/proc/$PID/environ`。

### Accept 后 KOL 没进"已接受"列
→ 乐观更新失败回滚。查 server action 是否 `internal_error`；确认 `kol_campaign` 唯一键 `(tenant_id, kol_id, campaign_id)` 无冲突；查 `audit_log type='kol.campaign_suggestion_decided'`。

### Undo 点了没反应
→ 5s 窗口已过（`undo_expired`）或离开页面（client-only state 丢失）。这是预期：Tooltip 已提示"5s 内可撤回"。

### Toggle 切换后又弹回 AI
→ carryover 缺 `view=full-pool`。确认 MatchSearchBar `view` prop 传了 `full-pool`（page.tsx `carriedView`）+ buildCarryoverFields 有 full-pool 分支。

---

## Migration 运维

- migration: `20260605160000_bl_084_add_kol_campaign_suggestion_status`
- 幂等（`IF NOT EXISTS`），低峰 apply 安全；含 ROLLBACK header（DROP INDEX + 3 COLUMN，**不删 match_score**——它 pre-existing）。
- backfill 影响行数查：`SELECT payload FROM audit_log WHERE action='migration.kol_campaign_suggestion_status_backfill'`。
- prod apply：`pm2` 部署链 `npx prisma migrate deploy`（见 `docs/dev/deployment-runbook.md`）。
