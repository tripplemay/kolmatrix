# ADR-016: kol_campaign 推荐生命周期 — suggestion_status 4 态

## Status

**Accepted**

- 日期：2026-06-05
- 作者：Kimi（Generator，BL-084 实现期沉淀）
- 相关批次：BL-084-ai-match-panel

## Context（背景）

BL-084 把 `/match?campaignId=X` 从"装饰性参数 + 全 KOL 池"重塑为 **AI 推荐三列工作台**（推荐池 / 已接受 / 候补池）。三列各自代表一个 KOL 相对某 campaign 的"决策状态"，需要一个持久化模型记录每个 (kol, campaign) 二元组当前处于哪一列。

约束与现状：

- **已有 `kol_campaign` join 表**（BM1/BM2）记录 KOL 与 campaign 的归属，含 `status`（pending/contacted/quoted/signed/delivered/paid 6 态联系生命周期）+ `source`（manual/ai_smart_match/csv_import…）+ `match_score`。
- BM1 语义下，一行 `kol_campaign` = "这个 KOL 在这个 campaign 里"。AI Panel 引入后需要区分"AI 推荐但未决策" vs "marketer 已接受" vs "已跳过" vs "移到候补"。
- 已有 2.3 万行历史 `kol_campaign`（多 tenant），不能破坏 BM1 既有读取语义（discovery / reach / insight / outreach 都 join 此表）。
- 决策点 A1#3（6/05 lock）：数据模型选 **A（复用 kol_campaign + 加 enum）**，而非新建 `campaign_suggestion` 表。

不决策的后果：三列状态散落在多处（localStorage / 临时表 / 内存），跨会话不一致，且无法在 reach/insight 复用"已接受"集合。

## Decision（决策）

在既有 `kol_campaign` 表上**新增 `suggestion_status VARCHAR(20)` 列**，承载一个 **4 态推荐生命周期**（enum-by-convention，zod/应用层校验，非 DB CHECK，与既有 `status` 同风格）：

| suggestion_status | 含义 | 列 | 写入时机 |
|---|---|---|---|
| `suggested` | AI 召回+重排，未决策 | 推荐池（**不落库**，见下） | — |
| `accepted` | marketer 接受 | 已接受 | acceptKolToCampaign |
| `skipped` | marketer 跳过（未来不再推） | 不显示 | skipKolFromCampaign |
| `swap_pool` | 移到候补 | 候补池 | swapKolToSwapPool |

配套：
- 新增 `suggested_at` / `decided_at` TIMESTAMPTZ；复用既有 `match_score`（cosine 快照）。
- 复合索引 `kol_campaign_suggestion_status_idx (campaign_id, suggestion_status)` 加速三列查询。
- **legacy 行 backfill 到 `accepted`**（`decided_at = created_at`）：pre-BL-084 的每一行都代表"KOL 已在此 campaign"，映射到 accepted 保留 BM1 行为；backfill 行数写 `audit_log 'migration.kol_campaign_suggestion_status_backfill'`。
- **`suggested` 态不落库**：推荐池由 `getCampaignSuggestions`（cosine + LLM rerank 实时 + 24h cache）动态产出，并排除已有 `accepted/skipped/swap_pool` 行的 KOL。只有 marketer 做出决策（accept/skip/swap）才写一行。这避免每次刷新 30 条推荐都写 30 行垃圾数据。

## Consequences（后果）

### 正面

- **零新表**：reach/insight/outreach 已 join `kol_campaign`，"已接受"集合天然可复用（`WHERE suggestion_status='accepted'`），无需跨表。
- **加列即可，additive 安全**：migration 不丢行、RLS 不变（列在已隔离表上）。
- **审计完整**：每个决策写 `audit_log 'kol.campaign_suggestion_decided'`，含 undo 窗口，支撑 Phase 5 个性化训练数据。

### 负面

- `kol_campaign` 表语义被复用承载两套生命周期（`status` 联系态 + `suggestion_status` 推荐态），新读者需理解二者正交。已在 schema 注释 + 本 ADR 说明。
- `suggested` 态"不落库"意味着推荐池无持久排序——刷新可能微调顺序（cosine 稳定，LLM rerank 在 24h cache 内一致）。可接受：推荐本就是实时建议。

### 中性

- enum 用 VARCHAR + 应用层校验（非 DB CHECK / PG enum），与既有 `status` 列一致；新增态时无需 migration ALTER TYPE，但也无 DB 层强约束。
- `undo` = DELETE 决策行（5s 窗口）。因 `suggested` 不落库、accept 的行是新建，undo 删行安全；不会误删 marketer 既有手工归属（那些 legacy accepted 行不进推荐池，不会被 accept 流程触碰）。

## Alternatives Considered（备选方案）

### 方案 A（已拒绝）：新建 `campaign_suggestion` 独立表

- 描述：单独表存 (campaign_id, kol_id, status, score, reason)。
- 拒绝理由：与 `kol_campaign` 高度重叠（accepted 的推荐 = kol_campaign 的归属），下游 reach/insight 需 join 两表取并集，复杂度高于收益。决策点 A1#3 明确选复用。

### 方案 B（已选择）—— 见 Decision 段

### 方案 C（已拒绝）：PG 原生 ENUM 类型

- 描述：`CREATE TYPE suggestion_status_enum AS ENUM(...)`。
- 拒绝理由：新增/重命名态需 `ALTER TYPE`（锁表风险），与项目既有"VARCHAR + 应用层 zod 校验"约定（`status` 列）不一致。一致性优先。

### 方案 D（已拒绝）：`suggested` 态也落库（每次推荐写 30 行）

- 描述：getCampaignSuggestions 每次把 30 条推荐 upsert 为 `suggested` 行。
- 拒绝理由：每次刷新写 30 行（5 campaign × 多次/天 = 大量低价值行），且 cache 失效后需清理；推荐本质是实时计算结果，不该持久化。仅决策（accept/skip/swap）才落库。

## References（引用）

- `docs/specs/BL-084-ai-match-panel-spec.md` §1.3 决策 lock / §2.3 不变量 #3
- `prisma/migrations/20260605160000_bl_084_add_kol_campaign_suggestion_status/migration.sql`
- `src/app/[locale]/(app)/match/server-actions/suggestion-actions.ts`（accept/skip/swap/undo/remove）
- `src/app/[locale]/(app)/match/server-actions/get-campaign-suggestions.ts`（推荐池实时产出 + 排除已决策）
- ADR-014 value-score-formula-v2（match_score 复用语义）
