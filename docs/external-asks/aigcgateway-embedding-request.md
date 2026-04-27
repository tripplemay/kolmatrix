---
name: aigcgateway-embedding-modality-request
type: external-product-request
target_project: aigcgateway
source_project: KOLMatrix
requested_by: tripplezhou (KOLMatrix Planner Kimi)
created_at: 2026-04-28
priority: medium-high（不阻塞 KOLMatrix MVP，但 MVP+1 月升级窗口高 ROI）
estimated_aigcgateway_effort: 3-5 day
estimated_kolmatrix_effort: 5 day（aigcgateway 支持后启动）
---

# AIGCGateway Embedding Modality Support — Customer Request

> **Source：** KOLMatrix（aigcgateway 第一个内部生产客户，月消耗 ~$5-10）
>
> **Status：** Customer feature request → 待 aigcgateway 产品 review
>
> **Target reader：** aigcgateway 产品 / 工程团队

---

## 1. 摘要（TL;DR）

KOLMatrix（KOL 营销管理平台，aigcgateway 内部客户）希望 aigcgateway 增加 **embedding modality** 支持（除现有 `text` / `image` 之外）。

**核心诉求：**
- 提供 1-2 个主流 embedding model（推荐 `bge-m3` + `text-embedding-3-small`）
- API 与 OpenAI `/v1/embeddings` 兼容
- Action 系统支持 embedding output（vs 现有 chat completions）
- 计费按 input tokens（embedding 仅 input cost）

**对 KOLMatrix 价值：**
- B7 Smart Match（即将启动）cost 28x↓ + latency 50-150x↓
- 解锁 4 个新业务能力（多语言 KOL 匹配 / KOL 相似推荐 / 智能聚类 / 异常检测升级）
- 长期可持续（KOL 库 100x 扩大后 LLM ranking 不可承担）

**aigcgateway 工时：** ~3-5 day
**KOLMatrix 配合工时：** ~5 day（aigcgateway 上线后启动 BL-014 升级批次）

---

## 2. 业务背景（KOLMatrix 客户视角）

### 2.1 KOLMatrix 当前 aigcgateway 集成

KOLMatrix 是 aigcgateway 的第一个内部生产客户（aigcgateway 自己的"实战 dogfood"案例）：

- **当前 5 个 Actions：**
  - `kol-email-customize`（claude-haiku-4.5）
  - `roi-insights`（gemini-3-flash）
  - `weekly-report-for-client`（gemini-3-flash）
  - `ui-i18n-translate-doubao`（doubao-pro）
  - `ui-i18n-translate-gemini`（gemini-2.5-flash-lite）
- **月消耗：** ~$5-10 USD
- **预算上限：** $100/月
- **发展阶段：** MVP 即将上线（~2026-05-22），种子用户 5-10 人

### 2.2 KOLMatrix 9 个 embedding 受益场景

| # | 场景 | 当前实现 | embedding 升级价值 |
|---|---|---|---|
| 1 | **KOL × Product Smart Match**（B7 即将上线）| LLM ranking（deepseek-v4-flash 长 context）| cost 28x↓ + latency 50-150x↓ + 扩展性 |
| 2 | **多语言 KOL 跨区匹配** | LLM 翻译 + 匹配 | 中日韩跨语言直接匹配（KOLMatrix 主要客户群是中文 game studio）|
| 3 | **KOL 相似推荐（"找到下一个"）** | 无 | 全新功能，复用客户审美，类比 Spotify 推荐 |
| 4 | KOL 智能聚类（自动发现新类目）| 硬编 categories mapping | 长尾类目自动发现（Vtuber / 电竞解说 / 家庭游戏 等）|
| 5 | 邮件回复语义分类（B4-extended F004）| LLM 分类 | cost 10x↓ + latency 30x↓ |
| 6 | KOL 异常检测升级（B6 F005）| 5 静态规则 | 量化异常度（cluster outlier detection）|
| 7 | 历史成功 campaign 自学习 | 无 | 客户复用成功经验（数据积累 6+ 月后高价值）|
| 8 | 语义搜索（NL → KOL）| SQL filter | 自然语言入口替代 NL→SQL 转换 |
| 9 | 词云 / 主题聚类（B5 stretch）| LLM 提取关键词 | 数学聚类，可量化趋势 |

### 2.3 关键数据（驱动 ROI 论证）

KOLMatrix 业务数据规模演化：

| 时间节点 | KOL 库规模 | 用户/月调用量（预估）|
|---|---|---|
| MVP 上线（2026-05-22）| 1500+ | ~500 调用 |
| MVP+1 月（2026-06-22）| 2500-3000 | ~2000 调用 |
| BL-012 爬虫团队接入（2026-06-25）| 7500-8000 | ~5000 调用 |
| MVP+3 月（2026-08）| 10000+ | ~15000 调用 |
| MVP+6 月（2026-11）| 30000-50000 | ~50000 调用 |
| MVP+1 年（2027-04）| 100000+ | ~200000 调用 |

**LLM ranking 成本曲线：** 与 KOL 库规模 × 用户调用量**双重线性增长**
- MVP 上线: $1-5/月
- MVP+3 月: $50-200/月
- MVP+1 年: **$2000-5000/月** ⚠️（突破 aigcgateway 月预算 $100）

**Embedding 成本曲线：** 仅与 KOL 库规模线性（一次性 embed），调用量增长几乎免费
- MVP 上线: $0.05/月（一次性 embed 1500 KOL ≈ $1.5）
- MVP+1 年: $5/月（10x KOL 库 + 增量 daily sync）

**ROI：** Embedding 升级在 MVP+3 月即开始回本，1 年节省 ~$24k-60k 月成本。

---

## 3. 需求清单（aigcgateway 实施细节）

### 3.1 必做（Must-have）

#### 3.1.1 Embedding modality 注册

修改 `list_models` 支持 `embedding` modality：

```typescript
// 现状：modality 仅 'text' | 'image'
// 需求：加入 'embedding'
type ModelModality = 'text' | 'image' | 'embedding';

// list_models response 新增 embedding 字段
interface EmbeddingModel {
  id: string;
  modality: 'embedding';
  brand: string;
  dimensions: number;       // 向量维度（如 1536 / 1024 / 3072）
  maxInputTokens: number;   // 单次 max input
  pricing: {
    inputPerMillion: number;  // embedding 仅按 input tokens 收费
    currency: string;
  };
  capabilities: {
    multilingual: boolean;
    languages?: string[];   // 支持的主要语言
  };
}
```

**list_models 调用：**

```bash
# 新增过滤参数
GET /v1/models?modality=embedding
```

#### 3.1.2 Embedding API endpoint

OpenAI 兼容格式：

```bash
POST /v1/embeddings
Content-Type: application/json
Authorization: Bearer pk_xxx

{
  "model": "bge-m3",
  "input": "KOL bio: gaming creator focused on FPS and esports..."
  // 或批量：input: ["text1", "text2", ...]
}

# Response
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.011, ..., 0.043],  // 向量数组
    }
  ],
  "model": "bge-m3",
  "usage": {
    "prompt_tokens": 32,
    "total_tokens": 32
  }
}
```

#### 3.1.3 Action 系统支持 embedding output

类似现有 `chat` Action，支持 `embedding` Action：

```typescript
// create_action 加 type 字段
{
  "name": "kol-bio-embed",
  "type": "embedding",          // 新增 type，区分 chat / embedding / image
  "model": "bge-m3",
  "variables": [
    { "name": "kol_bio", "type": "string", "required": true }
  ],
  "input_template": "{{kol_bio}}"  // 直接作为 input
}

// run_action 返回 embedding 数组
{
  "embedding": [0.0023, -0.011, ..., 0.043],
  "dimensions": 1024,
  "tokens_used": 32,
  "cost_usd": 0.000004
}
```

#### 3.1.4 至少 1 个主流 embedding model 上架

**Planner 推荐优先支持 model（按 KOLMatrix 业务匹配度）：**

| 优先级 | Model | Brand | 维度 | 多语言 | 估算 pricing | 推荐场景 |
|---|---|---|---|---|---|---|
| **P0** | `bge-m3` | 智源研究院 | 1024 | ✅ 中日韩英强 | $0.02/M tokens（推算） | KOLMatrix 主推（中日韩 KOL） |
| **P1** | `text-embedding-3-small` | OpenAI | 1536 | ✅ 通用 | $0.02/M tokens | 兜底通用 |
| **P2** | `text-embedding-3-large` | OpenAI | 3072 | ✅ | $0.13/M tokens | 高精度场景 |
| P3 | `multilingual-e5-large`（开源）| Microsoft | 1024 | ✅ 100+ 语言 | 自部署免费 | 海外扩张时考虑 |
| P4 | `voyage-3-lite` | Voyage AI | 512 | ✅ | $0.02/M tokens | 速度优先 |

**KOLMatrix 推荐 P0 + P1 组合：** bge-m3（中日韩 KOL 强）+ text-embedding-3-small（通用兜底）

### 3.2 应做（Should-have）

#### 3.2.1 批量 embedding（batch API）

支持单次调用 embed 多个文本：

```bash
POST /v1/embeddings
{
  "model": "bge-m3",
  "input": ["text1", "text2", ..., "text100"]  // 最多 100 个/次
}
```

**KOLMatrix 用例：** 一次性 embed 1000+ KOL bios（避免 1000 次 API 调用）

#### 3.2.2 计费 + 配额监控

- embedding 按 input tokens 计费（无 output tokens）
- 月预算阈值告警（同现有 chat 模式）
- 用量统计在 `get_usage_summary` 返回（按 model 分组 + embedding 单独行）

#### 3.2.3 可选 dimensions 参数

支持指定 dimensions（如 OpenAI text-embedding-3 系列允许指定 128/256/512/1024/1536/3072）：

```bash
POST /v1/embeddings
{
  "model": "text-embedding-3-small",
  "input": "...",
  "dimensions": 512   // 可选，省存储 + 加速
}
```

### 3.3 可做（Nice-to-have）

#### 3.3.1 cosine similarity 内置 endpoint

提供方便的相似度计算（替客户端做向量数学）：

```bash
POST /v1/embeddings/similarity
{
  "model": "bge-m3",
  "query": "FPS gaming creator",
  "candidates": [
    { "id": "kol-1", "text": "..." },
    { "id": "kol-2", "text": "..." }
  ],
  "top_k": 10
}

# Response
{
  "rankings": [
    { "id": "kol-7", "score": 0.92 },
    { "id": "kol-3", "score": 0.87 },
    ...
  ]
}
```

**KOLMatrix 价值：** 简化客户端实现（KOLMatrix 不需自己做 cosine 计算 + 索引）

但**非必须**：客户端可自己用 pgvector / 内存计算。

#### 3.3.2 持久化向量存储（aigcgateway 端）

可选：aigcgateway 提供 namespace + key-value 向量存储，客户端只发 query → aigcgateway 返回 top k。

**KOLMatrix 不需要**（自己有 PostgreSQL + pgvector），但其他 aigcgateway 客户可能需要。

---

## 4. 技术规格建议

### 4.1 优先支持的 model（投票）

**Top 1 推荐：`bge-m3`**

理由：
- 智源研究院开源，质量业内顶尖（MTEB 中日韩 benchmark 领先）
- 多语言原生支持（中文 + 日韩英）
- 1024 维度（OpenAI 1536 的 70%，存储节省）
- 自部署 cost 低（aigcgateway 可走 OpenRouter / 自建 Ollama）
- 国产，对国内客户合规友好

**Top 2 推荐：`text-embedding-3-small`**

理由：
- OpenAI 官方，业内 baseline
- 通用质量稳定
- KOLMatrix 兜底场景使用
- 已通过 OpenRouter 等渠道集成（aigcgateway 可能已有 OpenAI key）

### 4.2 API 设计建议

完全兼容 OpenAI `/v1/embeddings`（参考 https://platform.openai.com/docs/api-reference/embeddings）

**优势：**
- 客户端可用 openai SDK 切换（仅改 baseUrl）
- KOLMatrix 已用 openai SDK（src/lib/products/generateAiAssets.ts）
- 主流 embedding 客户端工具（langchain / llama-index）开箱即用

### 4.3 计费模型

**embedding 按 input tokens 计费**（无 output 概念）：

```
cost = input_tokens × pricing.input_per_million / 1_000_000
```

**KOLMatrix 估算月成本（MVP+1 年规模）：**
- 一次性 embed 100K KOL × ~50 tokens = 5M input tokens × $0.02/M = $0.10（一次性）
- 增量 embed daily ~50 新 KOL × 50 tokens × 30 days = 75K tokens/月 × $0.02/M = $0.0015/月
- Smart Match 查询 200K 次/月 × ~20 query tokens = 4M tokens/月 × $0.02/M = $0.08/月
- **月总 < $0.50**（vs LLM ranking $2000-5000/月）

---

## 5. 优先级 + 时机

### 5.1 KOLMatrix 视角时机

| 节点 | KOLMatrix 状态 | aigcgateway 加 embedding 的影响 |
|---|---|---|
| **现在 ~05-22**（MVP 上线前）| B7 已 lock LLM ranking 方案 | **不阻塞**，B7 可正常上线 |
| **MVP+1 月（~06-22）** | 用户反馈期 + B6 持续同步 KOL +1500 | **如有 embedding 可启动 BL-014 升级**（B7 Smart Match 改造，~3 day）|
| **BL-012 接入（~06-25）** | 爬虫团队 +5000 KOL | LLM ranking 开始紧张，embedding ROI 凸显 |
| **MVP+3 月（~08）** | 10000+ KOL，调用量 ~15000/月 | LLM cost 突破 $100/月预算，embedding **必须** |

### 5.2 aigcgateway 推荐排期

- **建议优先级：medium-high**
- **建议时机：MVP+1 月窗口**（与 KOLMatrix BL-014 升级同步）
- **不紧急**：KOLMatrix MVP 不阻塞，可在 aigcgateway 自身 roadmap 排期

### 5.3 工时分配

| 任务 | 工时 | 团队 |
|---|---|---|
| aigcgateway 加 embedding modality + 1 个 model（bge-m3）+ /v1/embeddings endpoint + Action 系统支持 + 计费 | ~3-5 day | aigcgateway 团队 |
| KOLMatrix BL-014 升级（B7 Smart Match 改用 embedding + KOL 相似推荐新功能 + 多语言匹配）| ~5 day | KOLMatrix 团队 |

---

## 6. 验收标准（aigcgateway 完成 → KOLMatrix 验证）

### aigcgateway 侧 done 条件

- [ ] `list_models?modality=embedding` 返回至少 1 个 embedding model（推荐 bge-m3）
- [ ] `POST /v1/embeddings` endpoint 工作，OpenAI 兼容
- [ ] Action 系统支持 type='embedding'（create_action / run_action）
- [ ] 计费按 input tokens（无 output）+ 在 get_usage_summary 显示
- [ ] MCP server 加 embedding 相关 tools（embed_text / list_embedding_models）
- [ ] aigcgateway 文档更新（含 embedding API 示例）

### KOLMatrix 侧验证步骤

- [ ] KOLMatrix 用 openai SDK 调 `/v1/embeddings` 拿到向量（base 验证）
- [ ] KOLMatrix 跑 一次性 embed 1500 KOL bios（cost ~$1.5）+ 写入 Kol.metadata.embedding 字段
- [ ] KOLMatrix Smart Match 改用 embedding cosine（latency 测试 < 100ms / cost < $0.0001/调用）
- [ ] KOLMatrix 加 KOL 相似推荐 POC（KOL detail 页底部"相似 KOL" 5 个）
- [ ] KOLMatrix 月成本下降验证（升级前 vs 后对比）

---

## 7. ROI 量化（aigcgateway 视角）

### 7.1 KOLMatrix 单客户价值

**消耗增长（升级后）：**

| 节点 | LLM ranking 月消耗 | Embedding 月消耗 | aigcgateway 收入差（按 30% margin）|
|---|---|---|---|
| MVP+1 月 | $5 | $0.5 | -$1.5（短期降）|
| MVP+3 月 | $50-200 | $0.5-2 | -$15-60（更降）|
| MVP+1 年 | $2000-5000 | $5-10 | **-$600-1500（短期看 aigcgateway 收入降低）**|

**aigcgateway 视角短期看似"亏"，但长期价值：**

1. **KOLMatrix 客户留存**：如不支持 embedding，KOLMatrix 1 年内会迁移到 OpenAI 直调（绕开 aigcgateway） → aigcgateway 失去这个客户全部消耗
2. **吸引同类客户**：embedding 是 RAG / 推荐 / 搜索场景的标配；缺失会让 aigcgateway 在"AI 应用平台"定位上失去竞争力
3. **客户消耗结构升级**：embedding 用户通常会 + chat（混合场景），总消耗反而上升
4. **平台战略价值**：embedding modality 是 aigcgateway 进入 RAG / 推荐 / 搜索市场的入场券

### 7.2 通用价值（不只是 KOLMatrix）

embedding 是以下场景的核心基础：
- RAG（Retrieval-Augmented Generation）— 几乎所有企业 AI 产品必需
- 语义搜索（vs 关键词）
- 推荐系统（电商 / 内容 / 社交）
- 异常检测（金融 / 安全）
- 文档去重 / 聚类
- 多模态（如 CLIP，但需独立 image embedding）

预估：aigcgateway 加 embedding 后，6 个月内可吸引 **3-5 个新客户**（假设每个月 $50-200 消耗）。

---

## 8. 待 aigcgateway 团队决策

1. **是否纳入下一季度 roadmap？**
2. **优先支持哪个 model？**（Planner 推荐 bge-m3 + text-embedding-3-small）
3. **是否做 4.3.1 cosine similarity 内置 endpoint？**（KOLMatrix 不需，但其他客户可能要）
4. **是否做 4.3.2 持久化向量存储？**（KOLMatrix 不需，但远期客户可能要）
5. **预估 aigcgateway 上线时间？**（KOLMatrix BL-014 排期参考）

---

## 9. 附录

### 9.1 KOLMatrix 业务上下文（给 aigcgateway 团队背景）

- 项目：KOLMatrix — 全球游戏 KOL/KOC 智能营销管理平台
- 技术栈：Next.js 16 + PostgreSQL + Prisma + Redis + Resend + aigcgateway（你们的客户 ✅）
- 用户画像：海外发行的中国 game studio marketers（中文为主，目标客户语言 zh/ja/ko/es/en）
- 核心功能：KOL 发现 + 营销 campaign + 邮件触达 + ROI 追踪
- 当前规模：MVP 上线前夜，1500+ KOL，5-10 种子用户

### 9.2 KOLMatrix 现有 Actions（aigcgateway 可看到的客户使用模式）

| Action | Model | 月调用量（估）|
|---|---|---|
| `kol-email-customize` | claude-haiku-4.5 | 1000-5000 |
| `roi-insights` | gemini-3-flash | 500-2000 |
| `weekly-report-for-client` | gemini-3-flash | 100-500 |
| `ui-i18n-translate-doubao` | doubao-pro | < 50（运维工具）|
| `ui-i18n-translate-gemini` | gemini-2.5-flash-lite | < 50 |
| **新增 BL-014 之后：** | | |
| `kol-bio-embed`（embedding） | bge-m3 | 1500 一次性 + 50/day 增量 |
| `kol-product-similarity`（embedding） | bge-m3 | 5000-50000（Smart Match）|
| `kol-similar-recommend`（embedding） | bge-m3 | 5000-20000（KOL 相似推荐）|

### 9.3 参考实现（aigcgateway 团队）

- OpenAI Embeddings API：https://platform.openai.com/docs/api-reference/embeddings
- BGE-m3 论文 + 代码：https://github.com/FlagOpen/FlagEmbedding
- 主流 embedding model 对比：https://huggingface.co/spaces/mteb/leaderboard
- pgvector（PostgreSQL 向量索引）：https://github.com/pgvector/pgvector

### 9.4 KOLMatrix 内部 spec 引用

- B7 当前 LLM ranking 方案：`docs/specs/B7-mvp-launch-ready-spec.md` §F001 / §F002
- 升级后 KOLMatrix 侧 spec（待起草）：`docs/specs/BL-014-embedding-upgrade-spec.md`（aigcgateway 上线后）

---

## 10. 联系方式

- **KOLMatrix 产品 + Planner：** tripplezhou（同 aigcgateway 产品方）
- **沟通渠道：** 跨项目内部沟通
- **Review 周期建议：** aigcgateway 团队 1 周内 review 给反馈

---

**文档状态：** customer request draft（2026-04-28 KOLMatrix Planner 起草，待 aigcgateway 产品 + 工程 review）
