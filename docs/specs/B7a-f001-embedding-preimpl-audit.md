# B7a F001 · Embedding Pipeline + pgvector 规划稿 / 审计请求

> **发起者：** Generator (cli=Kimi 本会话固定身份)
> **日期：** 2026-04-28
> **触发：** F001 开工前审计，按 pre-impl 审计 → Planner 裁决工作范式（framework/harness/pre-impl-adjudication.md）
> **状态：** 等待 Planner 明确回复，**未收到前不开工**

---

## 1. 背景 & 目标

B7a F001 引入 **pgvector + bge-m3 embedding pipeline**，目标：

- 新建数据库基础设施（pgvector extension + Kol/Product `embedding vector(1024)` 列 + 索引）
- 新建 `src/lib/embedding/` 模块（types / aigcgateway client / kol-embed batch / cosine helper）
- 一次性 embed staging 现有 ~3,300 KOL（也覆盖 prod 768 KOL）
- B6 daily cron 接力 hook（每日新 KOL 自动 embed）
- 月成本预算 < $0.05（低风险）

**下游依赖：** F002 /discovery Smart Match 完全依赖 F001 落地（pgvector 列 + Smart Match SQL `<=>` operator）。

**spec 引用：** `docs/specs/B7-mvp-launch-ready-spec.md` §F001 (line 54-103)

---

## 2. 已查实事（环境扫描）

### 2.1 PostgreSQL + pgvector 可用性

| 项 | 实测 |
|---|---|
| Server version | PostgreSQL 17.9 (Ubuntu 17.9-1.pgdg22.04+1) ✅ |
| `pg_available_extensions WHERE name='vector'` | **0 rows**（extension 未安装到 OS）❌ |
| `apt-cache search pgvector` | `postgresql-17-pgvector` 包**可用** ✅ |
| 当前 staging Kol 数据量 | 3,303（YT 3,289 + non-YT 14） |
| 当前 prod Kol 数据量 | 768（B6 manual sync 后） |
| 当前 staging Product | 16 |

### 2.2 现有 aigcgateway 客户端模式（参考）

| 文件 | 模式 |
|---|---|
| `src/lib/products/generateAiAssets.ts` | 直接 `fetch` POST `/v1/chat/completions`（OpenAI 兼容） |
| `src/lib/email/customize.ts` | 同上（Action endpoint）|
| `src/lib/roi/insights.ts` | 同上 |
| 共用环境变量 | `AIGCGATEWAY_BASE_URL`（默认 `https://aigc.guangai.ai/v1`）+ `AIGCGATEWAY_API_KEY` |
| 项目内 OpenAI SDK 依赖 | **无**（package.json 未引入 openai 包） |

### 2.3 Prisma 已有 Unsupported 列模式（参考）

`src/lib/search/tsvector.ts` + Kol.searchVector：

```prisma
searchVector  Unsupported("tsvector")?  @map("search_vector")
```

App 代码通过 `$queryRaw` 操作 — Prisma generate 不会丢列。

### 2.4 现有 schema 关键字段（embedding 文本来源备选）

| 表 | 候选字段 |
|---|---|
| Kol | `bio`(nullable text) / `displayName` / `categories`(text[]) / `tags`(text[]) / `countryCode` / `language` |
| Product | `name` / `category` / `targetAudience`(nullable) / `uniqueSellingPoints` |

---

## 3. 11 条决议请求

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| 1 | **pgvector OS 安装路径** | `sudo apt install postgresql-17-pgvector` 在 prod + staging VM 上跑（同机共用 PG 17 实例，一次安装两个 DB 都受益） | 改用 docker-compose Postgres + pgvector image（重做整个 DB 部署） | 走云 Postgres（GCP Cloud SQL with pgvector）— 重大架构变更 | **A**（最小变更，pgvector PG 17 包已在 apt 库；用户行动项，需 sudo） |
| 2 | **Prisma vector 列声明** | `embedding Unsupported("vector(1024)")?` + 通过 `$queryRaw` 读写（沿用 searchVector tsvector 模式） | 用 Prisma generator pgvector preview feature（需要 Prisma 6.7+ + 实验性 flag） | 不在 Prisma schema 声明，纯 SQL migration + 不让 Prisma 知晓（db pull 会丢列） | **A**（已有项目内坑成熟模式 + 与 BI4-F005 searchVector 一致） |
| 3 | **索引选型（KOL 表）** | IVFFlat（`lists = max(1, N/1000)`，N=KOL 数。当前 3,303 → lists=4；构建快、内存低、recall 95%+） | HNSW（`m=16, ef_construction=64`；构建慢但 recall 99%、查询更快；适合 > 10K rows） | 不加索引，纯 sequential scan（< 1万行其实够用，~5-10ms） | **A**（spec 已 lock < 10K 用 IVFFlat；< 1万行 IVFFlat 够用，B8/Post-MVP 数据涨到 1万+ 再 reindex 切 HNSW） |
| 4 | **Kol embedding 文本组成** | 只取 `bio`（短而精，但 ~1500 KOL 中 ≥30% bio NULL） | 拼接 `display_name + bio + categories.join(',') + tags.join(',') + (countryCode? language? 元信息)`（最丰富，~50 tokens 平均） | 结构化 JSON 字符串：`{"name":"...", "bio":"...", "cat":[...], "tags":[...]}`（更多 tokens，但 LLM-friendly） | **B**（bge-m3 多语言能力强；拼接覆盖 bio NULL 的 case；50 tokens 成本 $0.0042/1000 KOL，一次性也仅 $0.0014 / 1500 KOL，几乎免费） |
| 5 | **Product embedding 文本组成** | 只取 `description`（但 schema 里没有 description 字段，spec 误写！实际是 `uniqueSellingPoints`） | 拼接 `name + category + targetAudience + uniqueSellingPoints`（最丰富） | 仅 `name + uniqueSellingPoints`（最简） | **B**（同 KOL 思路，拼接多字段；uniqueSellingPoints 是 NOT NULL 字段，category 也是必填，覆盖性好；spec line 73 "Product description" 措辞需修订） |
| 6 | **Re-embed 触发条件** | 永不 re-embed（一次性 embed 后 KOL bio/categories 变化不更新 vector，直到手动 re-embed all） | 每次 B6 refresh 命中（即 last_synced_at 更新）就重 embed（每月 ~$0.006） | 仅当关键字段（bio / categories / displayName）实际变化时才 re-embed（diff hash 比对） | **C**（A 方案 staleness 严重；B 方案对静态数据浪费成本；C 方案需要在 import 路径加字段比对，复杂度增加但最经济。如选 C，Generator 需在 mapToKolRow 加 `embeddingDirty` 计算逻辑） |
| 7 | **一次性 embed 范围（首次 batch script）** | 全部 KOL（3,303 staging + 768 prod，含 demo seed 12 条）一次性 embed | 仅 `metadata.is_demo IS NULL OR metadata.is_demo = false`（即非 demo seed 数据，~3,291 staging） | 仅 `bio IS NOT NULL`（短期省成本，约 70%KOL；NULL bio 的 KOL Smart Match 时即时 embed） | **A**（成本极低 ~$0.014 全量；demo seed 也需要 embedding 否则 demo Smart Match 跑不通；NULL bio 用决议#4-B 的拼接模式，display_name+categories 仍可 embed） |
| 8 | **B6 cron 接力 hook 集成点** | 修改 `src/lib/kol-sync/import.ts` 内 `importRawKolData`，import 完成后立即 embed 新 inserted/updated 的 KOL（同事务） | 修改 `scripts/kol-sync-daily.ts`，import 完成后单独跑 `embedNewlyImportedKols(prisma, since)`（不同事务，错误隔离） | 单独建一个 `infrastructure/cron/kolmatrix-kol-embed-incremental` 在 sync cron 后 30 min 跑 | **B**（错误隔离 + 不污染 import 关键路径；如果 aigcgateway 临时挂机，import 仍成功，embedding 失败重试；同 cron 进程内顺序跑，简单） |
| 9 | **aigcgateway client 实现** | 沿用现有项目模式 — raw `fetch` + 自定义 schema 验证（zod）（与 generateAiAssets.ts/insights.ts 一致） | 引入 `openai` npm 包，使用 `openai.embeddings.create()`（更标准但增加依赖） | 自建 `aigcgateway` 客户端 SDK 的本地副本（`src/lib/aigcgateway/client.ts`） | **A**（与项目惯例一致；无新依赖；fetch + zod 已在用，无 risk） |
| 10 | **Migration 拆分粒度** | 单 migration `20260428xxx_b7a_embedding_setup`（CREATE EXTENSION + ALTER TABLE × 2 + CREATE INDEX × 2，含完整 ROLLBACK SQL） | 拆 2 个：先 `extension_pgvector`（CREATE EXTENSION + 权限 GRANT），后 `kol_product_embedding`（ALTER + 索引） | 拆 3 个（extension / 列 / 索引各一个，最小化 rollback 半径） | **A**（一次跑完语义清晰；ROLLBACK SQL 含 `DROP INDEX` → `ALTER TABLE DROP COLUMN` → `DROP EXTENSION CASCADE`；Prisma migration 是事务的，原子操作；database-patterns.md 未明文反对单 migration） |
| 11 | **Embedding NULL 时 Smart Match 兜底** | Smart Match SQL 加 `WHERE embedding IS NOT NULL` 过滤；Product 无 embedding 时即时 embed（< 100ms）后再查询 | 不过滤 NULL，pgvector `<=>` 对 NULL 直接返回 NULL → 排序末尾，但占用 LIMIT 名额 | Product 无 embedding 时 fallback 到非 AI 关键词搜索（旧 search-vector 路径）| **A**（数据干净 + 即时 embed 延迟可控 ~300ms 一次；F002 acceptance "< 200ms" 仅指 KOL 已全部 embed 后；首次 product 无 embedding 时一次 ~300ms 是合理 trade-off） |

### 裁决格式要求

请 Planner 就每条给出明确的 **A / B / C** 选择 + 简短理由（偏离建议时）。
用 `#1:A #2:A #3:A #4:B #5:B #6:C #7:A #8:B #9:A #10:A #11:A` 短格式回复即可。

---

## 4. 已知漂移 / 已发现的 spec bug

### 4.1 spec line 73 措辞 bug：Product description 字段不存在

B7-mvp-launch-ready-spec.md §F001 line 73:
> `Product 表加 embedding 列... Product description ─→ aigcgateway bge-m3 ─→ vector[1024]`

**事实：** Product 表 schema 无 `description` 字段。实际可用字段：`name / category / targetAudience(nullable) / uniqueSellingPoints`。

**建议：** Planner 裁决决议 #5 时一并修订 spec 措辞（"Product description" → "Product key fields (name + category + uniqueSellingPoints)"）。

### 4.2 spec line 71 措辞瑕疵：PostgreSQL 16 → 实际是 17.9

B7-mvp-launch-ready-spec.md §F001 line 71:
> 启用 pgvector extension（PostgreSQL 16 已支持）

**事实：** prod + staging 都是 PG 17.9。pgvector 在 11/12/13/14/15/16/17 全支持。

**建议：** Planner 裁决决议 #1 时一并修订 spec 措辞。

### 4.3 spec line 80 与决议 #4 关联：bio/categories 表述简化

B7-mvp-launch-ready-spec.md §F001 line 80:
> `kol-embed.ts — 一次性 embed 全部 Kol（batch 100/call）+ B6 daily 增量 embed`

未具体说明 batch size 100 的依据 + embed 文本组成。本审计决议 #4 明确文本组成；batch size 100 留作 Generator 实现细节（aigcgateway batch 上限未知，先 100 试，超限自动降）。

---

## 5. 风险登记（不需 Planner 裁决，仅记录 Generator 会监控）

| 风险 | 缓解 |
|---|---|
| pgvector apt 包安装后需 PG 服务重启（中断 ~10s）| 用户安装时小心：宜在低峰期；prod 用户已知 |
| aigcgateway batch API 是否真支持 100 个 input 数组 | Generator 实测 + 失败时自动降到 50/20，写 retry log |
| IVFFlat 索引在 N < lists × 32 时性能退化 | 当前 N=3,303 / lists=4 → 文档说 N ≥ lists × 32 = 128 OK；HNSW 后续切换 |
| RLS 与 vector 列 | embedding 列继承 kol 表 RLS 策略；Smart Match SQL 必须 `withTenant` 包；不需特殊 policy |
| pgvector dimension 强类型 | `vector(1024)` 维度不匹配会插入失败；client 测试时验证返回向量长度 |
| 重启 Postgres 时 IVFFlat 索引会退化（需要 ANALYZE） | migration 末尾跑 `ANALYZE kol;` `ANALYZE product;` |

---

## 6. 开工条件

收到 Planner 对 11 条决议 + 4.1-4.3 spec 修订建议的明确回复后，Generator 将：

1. **用户先做 prerequisite（acceptance #1 阻塞）：** `sudo apt install postgresql-17-pgvector` 在 prod VM（staging + prod 同机共用 PG 17 实例，一次安装搞定）+ `sudo systemctl restart postgresql@17-main` 验证 `pg_available_extensions WHERE name='vector'` 出现 `vector`
2. 按决议实现 migration + `src/lib/embedding/` + 一次性 embed 脚本 + B6 hook
3. 走闸门：tsc / lint / unit + integration tests / staging 一次性 embed 验证 / event_log 'embedding.invoked' 埋点
4. Push 到 main（CI 应触发——src/ 改动 + 新 migration ≠ paths-ignore）

**未收到明确回复前不开工。**

---

## 7. 估算开工时长

| 环节 | 预估 |
|---|---|
| 用户安装 pgvector OS 包（prerequisite） | ~5 min |
| Migration（CREATE EXTENSION + ALTER + CREATE INDEX + ROLLBACK SQL） | ~30 min |
| `src/lib/embedding/types.ts + client.ts + cosine.ts` | ~1 h |
| `kol-embed.ts`（batch script + dirty-check 逻辑 + retry） | ~1.5 h |
| 一次性 embed staging（实跑 + 验证）| ~30 min（含 aigcgateway 调用 + 写 DB） |
| 一次性 embed prod（实跑） | ~10 min |
| B6 hook 集成（kol-sync-daily.ts 改） | ~30 min |
| Tests（unit + integration） | ~1 h |
| event_log 埋点 + cost 监控 | ~20 min |
| L1 闸门 + commit + push | ~15 min |
| **总计** | **~5.5 h（不含审计 + 裁决等待）** |

---

## 8. 相关文档

- spec：`docs/specs/B7-mvp-launch-ready-spec.md` §F001 (line 54-103)
- spec：`docs/specs/B7a-discovery-smart-match-spec.md`（如有，B 方案拆分时建立 — 现在 features.json 内）
- 外部需求：`docs/external-asks/aigcgateway-embedding-request.md`（含 bge-m3 上线确认 + 月成本估算）
- 框架：`framework/harness/database-patterns.md`（migration ROLLBACK 规则、RLS NULLIF）
- 框架：`framework/harness/pre-impl-adjudication.md`（本审计模板来源）
- 现有参考：`src/lib/products/generateAiAssets.ts`（aigcgateway raw fetch 模式）
- 现有参考：`src/lib/search/tsvector.ts` + `prisma/schema.prisma:Kol.searchVector`（Unsupported 列模式）

---

## 9. Planner 裁决（待用户填写）

**短格式：** `#1:_ #2:_ #3:_ #4:_ #5:_ #6:_ #7:_ #8:_ #9:_ #10:_ #11:_`

**逐条理由（如偏离建议）：**

| # | 决定 | 理由 |
|---|---|---|
| 1 | _ | _ |
| ... | _ | _ |

**spec 修订清单（裁决时一并交代）：**
- [ ] B7-mvp-launch-ready-spec.md §F001 line 73 "Product description" 改为 "Product (name + category + uniqueSellingPoints)"
- [ ] B7-mvp-launch-ready-spec.md §F001 line 71 "PostgreSQL 16" 改为 "PostgreSQL 17"
- [ ] 是否要把决议 #4 / #5 / #6 的最终文本组成 + re-embed 策略写进 spec acceptance？

**额外叮嘱（非阻塞）：**

| 类目 | 内容 |
|---|---|
| _ | _ |
