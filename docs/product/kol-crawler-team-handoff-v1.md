---
title: KOL Data Crawler Team — 交接文档 v1
audience: external crawler team
status: v1.0 · 初版
owner: KOLMatrix Planner
date: 2026-04-24
---

# KOL Data Crawler Team — Handoff v1

本文是 KOLMatrix 平台对**独立爬虫团队**的数据需求说明。爬虫团队按本需求产出 KOL 数据 API，KOLMatrix 平台消费该 API 写入自身 PostgreSQL 供用户筛选/触达/分析。

## 0. TL;DR（5 分钟速读版）

我们需要：**一套 REST API**，每天/每小时吐出**全球游戏 KOL/KOC 的结构化画像**，覆盖 **15 维筛选字段**（§3.2），初期支持 **YouTube + TikTok**。

**最小可交付（MVP 级别，供我们接入即用）：**
- ~10 个核心字段（handle / name / followers / country / categories / email 等，§3.1）
- 至少 **5,000 条高质量游戏 KOL**（细分：MOBA / RPG / FPS / 沙盒 / 二次元 / 休闲 等）
- 日级更新（follower count / last upload 等快变指标）
- API 三端点：`GET /kols`（列表带 cursor + filter）/ `GET /kols/:id`（单条）/ `GET /kols?changed_since=ISO`（增量）

**完整可交付（Post-MVP 目标）：**
- 全 15 维覆盖（含 audience demographics / monetization / brand safety 等"深度画像"）
- 覆盖 100,000+ KOL 跨 4 平台（YouTube / TikTok / Twitch / Instagram）
- 小时级增量 + webhook push

**法律/合规铁律：** 严格遵守各平台 ToS + robots.txt + GDPR；**不得**爬个人邮箱（只爬 public business contact），**不得**规避认证墙。

---

## 1. 项目背景与使命

### 1.1 KOLMatrix 是什么

全球游戏 KOL/KOC 智能营销管理平台。面向**出海游戏工作室**的 marketing manager，解决：

- "找人"（Discovery）：15 维筛选符合产品的 KOL
- "触达"（Outreach）：AI 定制邮件 + 发送
- "管理"（CRM）：关系阶段追踪 + 合作历史
- "复盘"（ROI）：营销花费与收益追踪 + AI 洞察

爬虫团队的产出**决定**第一件事（Discovery）的质量。没有高质量数据 = 筛不到合适的人 = 整个产品无价值。

### 1.2 目前数据源现状

**已有（静态 seed，Post-MVP 计划被替换）：**
- XLSX → AI 打标后的 2,524 条 YouTube 微网红（500-10K 粉丝）
- 字段仅 6 个：platform / name / url / region / followers / is_gaming + AI 分类 categories
- **痛点**：数据 2026-04-21 快照，follower count / last upload 等快变指标过期；类目稀疏（MOBA/二次元/沙盒 各 < 10 条）；无 email / 无 engagement rate / 无 audience demographics

**未来（本爬虫团队交付）：**
- 实时/准实时爬取的结构化 KOL 画像
- 覆盖 §3 的 15 维筛选字段
- KOLMatrix 平台定期增量同步到本地 PG

### 1.3 集成模型

```
┌──────────────────┐         ┌────────────────┐          ┌─────────────────┐
│  爬虫团队基建     │  HTTPS  │ 爬虫 REST API  │  定时拉取 │ KOLMatrix 平台  │
│  - 爬虫集群      │ ───────▶│  - /kols       │ ◀────── │ - sync worker   │
│  - 清洗/去重     │         │  - /kols/:id   │          │ - Kol table     │
│  - AI 分类       │         │  - changed_since│         │ - Discovery UI  │
│  - 数据湖存储     │         │  - webhook?   │          │ - Outreach etc  │
└──────────────────┘         └────────────────┘          └─────────────────┘
   ◀───── 爬虫团队责任 ─────▶ ◀─── 契约面 ─────▶ ◀── KOLMatrix 团队责任 ──▶
```

**爬虫团队负责：** 数据采集、清洗、去重、分类、API 提供、SLA 保障
**KOLMatrix 团队负责：** 消费 API、写入本地 DB、UI 筛选/展示、AI 触达/CRM/ROI

---

## 2. 你们要了解的核心需求

### 2.1 目标用户场景（数据驱动的）

Marketing manager 的筛选过程：

> "我要推广一款新上线的 MOBA 手游 `星际锋线`，面向美服和日服。预算 $10K。
>   找 50 个符合以下条件的 KOL：
>   - 地区：美国 / 加拿大 / 日本
>   - 平台：YouTube 优先 + TikTok 补充
>   - 粉丝 10K-200K（中腰部）
>   - 最近 30 天发过 MOBA/策略类视频
>   - 互动率 > 3%（行业平均 1.5%）
>   - 有 business email 公开
>   - 品牌安全：G / PG 级（避免 R 级成人内容）
>   - 受众 18-34 岁占比 > 60%"

**所有这些条件**的数据字段都要你们提供。15 维 filter（§3.2）就是围绕这种场景设计的。

### 2.2 数据新鲜度要求

| 字段 | 变化频率 | 要求 |
|---|---|---|
| `followerCount` | 每天 ±1% | 日更 |
| `avgViews` / `lastUploadAt` / `uploadsPerMonth` | 每周 | 周更 |
| `engagementRate` | 月级 | 月更 |
| `audienceDemographics` | 季度 | 季更（或每半年） |
| `categories` / `language` | 基本不变 | 首次爬 + 重大变化时重爬 |
| `email` | 手动录入或公开页提取 | 不变则不更新 |
| `monetizationStatus` | 月级 | 月更 |

**KOLMatrix 同步策略：** 默认每天增量拉一次 + 每周全量 diff 补漏。

### 2.3 数据量与覆盖度

| 阶段 | KOL 数量 | 平台覆盖 | 地区覆盖 |
|---|---|---|---|
| MVP（2026-05）接入首批 | ≥ 5,000 | YouTube | 美/加/英/日/德/法/韩 Top 7 |
| Post-MVP B6（2026-Q3） | ≥ 50,000 | YouTube + TikTok | 全球 30+ 国 |
| 远期 | ≥ 500,000 | + Twitch + Instagram + X | 全球 |

**质量 > 数量**：宁要 5,000 高质量 KOL（email 齐全 + 类目精准 + 数据新鲜），不要 100,000 低质（缺字段 + 分类错误 + 过期）。

---

## 3. 数据字段规格（KOLMatrix 期望接收的 Schema）

### 3.1 核心字段（MVP 必须，10 个）

| 字段 | 类型 | 必填？ | 说明 | 示例 |
|---|---|---|---|---|
| `externalId` | string | ✅ | 爬虫系统内唯一 ID（你们定，跨同步稳定）| `"yt-UCabcdef123"` |
| `platform` | enum | ✅ | 平台：`youtube` / `tiktok` / `twitch` / `instagram` / `x`（小写）| `"youtube"` |
| `handle` | string | ✅ | 平台 handle（不含 @）| `"NintendoGalaxy"` |
| `displayName` | string | ✅ | 显示名 | `"NintendoGalaxy"` |
| `url` | string | ✅ | Canonical 平台链接 | `"https://www.youtube.com/@NintendoGalaxy"` |
| `avatarUrl` | string \| null | ⚠️ | 头像 CDN URL（建议 HTTPS）| `"https://yt3.ggpht.com/..."` |
| `countryCode` | ISO-3166-1 alpha-2 | ⚠️ | 国家码；未知则 `null` | `"DE"` |
| `followerCount` | integer | ✅ | 订阅数 / 关注数 | `9000` |
| `categories` | array of string | ✅ | 内容分类标签（§3.3）；**数组允许 1-5 个** | `["RPG", "Retro"]` |
| `isGaming` | boolean | ✅ | 是否游戏类（你们用 AI 打标）| `true` |

### 3.2 15 维扩展字段（Post-MVP B6 全覆盖；MVP 首批含 5-6 维即可）

对应 KOLMatrix Discovery 页 15 维 filter。用户会把这些当查询条件（WHERE 子句）；缺失字段 = 该维度用户查不到该 KOL。

| 字段 | 类型 | Filter 用途 | 说明 | 示例 |
|---|---|---|---|---|
| `language` | ISO-639-1 (2 letters) | 主说语言筛选 | 频道主要语言（非字幕）| `"en"` |
| `engagementRate` | decimal(5,2) | `>N%` 互动率筛 | (likes + comments) / views × 100，近 10 条视频均值 | `3.42` |
| `avgViews` | integer | `>N` 平均播放筛 | 最近 10 条视频平均播放数 | `25000` |
| `uploadsPerMonth` | integer | `>N` 活跃度筛 | 最近 90 天平均每月上传数 | `8` |
| `lastUploadAt` | ISO 8601 timestamp | `date range` 最近上传 | 最近一条视频发布时间 | `"2026-04-20T14:32:00Z"` |
| `monetizationStatus` | enum | 变现能力筛 | `NONE` / `MONETIZED` / `VERIFIED` | `"MONETIZED"` |
| `brandSafetyRating` | enum | 品牌安全筛 | `G` / `PG` / `PG13` / `R`（MPAA 风格）| `"PG"` |
| `knownBrandCollabs` | array of string | 竞品合作筛 | 已知品牌合作，品牌名数组 | `["RedBull", "Razer"]` |
| `audienceAgeDist` | JSON object | 受众年龄筛 | `{ "13-17": 0.12, "18-24": 0.35, "25-34": 0.28, ... }` 百分比求和 = 1.0 | 见 §3.4 |
| `audienceGeoDist` | JSON object | 受众地区筛 | `{ "US": 0.42, "DE": 0.18, ... }` ISO-2 国家码 | 见 §3.4 |
| `audienceGenderDist` | JSON object | 受众性别筛 | `{ "male": 0.72, "female": 0.26, "other": 0.02 }` | 见 §3.4 |
| `engagementAuthenticity` | integer 0-100 | 假粉丝识别 | 真实互动率评分（100 = 完全真实）；算法由你们定（建议：评论/like 比例 + 粉丝增长曲线异常检测） | `82` |
| `bio` | text | 全文搜索命中 | KOL 简介全文；未来用于 LLM 匹配 | `"Retro gaming enthusiast..."` |
| `tags` | array of string | AI 打标 | 你们 AI 打的细粒度标签（与 categories 不同；tags 更细更自由） | `["nostalgia", "walkthrough", "commentary"]` |
| `email` | string \| null | 触达能力筛 | **仅公开 business email**（频道 about 页、视频描述中自报）；**绝不爬私人邮箱** | `"business@nintendogalaxy.com"` |

### 3.3 `categories` 值域（我们接受的分类）

必须来自以下枚举（若你们的分类体系不同，先 map 到我们的 17 类）：

**Gaming 主类（isGaming=true 时必填至少 1 个）：**
```
MOBA / FPS / RPG / MMO / Strategy / Sandbox / Simulation / Racing /
Sports / Fighting / Puzzle / Card / Retro / Esports / Indie / Mobile / Casual
```

**Non-gaming 类（isGaming=false 时用）：**
```
Music / Entertainment / Education / Tech / Lifestyle / Vlog / Other
```

**Gaming 细分（categories 可含多个，但至少一个主类）：**
- 示例合法：`["RPG", "Indie"]`, `["MOBA", "Esports", "Mobile"]`, `["Retro", "Nostalgia"]`
- 示例非法：`[]`（至少 1 个）, `["Blockchain"]`（不在枚举内 → 拒绝入库）

### 3.4 JSON 字段 shape 约束

**audienceAgeDist**（固定 7 桶，percent float 和为 1.0，±0.01 容差）：
```json
{
  "13-17": 0.12,
  "18-24": 0.35,
  "25-34": 0.28,
  "35-44": 0.14,
  "45-54": 0.07,
  "55-64": 0.03,
  "65+": 0.01
}
```

**audienceGeoDist**（Top-10 国，ISO-2 大写，剩余合并为 `"OTHER"`，和为 1.0）：
```json
{
  "US": 0.42,
  "DE": 0.18,
  "GB": 0.09,
  "JP": 0.06,
  "KR": 0.04,
  "CA": 0.03,
  "FR": 0.03,
  "AU": 0.02,
  "OTHER": 0.13
}
```

**audienceGenderDist**（3 值，和为 1.0）：
```json
{
  "male": 0.72,
  "female": 0.26,
  "other": 0.02
}
```

### 3.5 元数据字段（供追踪用）

| 字段 | 类型 | 说明 |
|---|---|---|
| `dataQuality` | enum `high/medium/low` | 该条数据整体置信度（你们给）|
| `fieldSources` | JSON object | 每个字段的来源：`{"followerCount": "youtube-data-api", "email": "channel-about-page", "categories": "ai-gpt-4"}` |
| `lastCrawledAt` | ISO 8601 | 本条 KOL 最近一次爬取时间 |
| `crawlerVersion` | string | 你们爬虫版本（如 `"v2.3.1"`），便于后续 diff 诊断 |

---

## 4. API 契约规格

### 4.1 端点清单（MVP 必须）

```
GET  /v1/kols                 # 列表 + filter + cursor pagination
GET  /v1/kols/:externalId     # 单条详情
GET  /v1/kols?changed_since=YYYY-MM-DDTHH:MM:SSZ  # 增量同步
```

### 4.2 认证

- **Bearer token in `Authorization` header**：`Authorization: Bearer <API_KEY>`
- 我们期望每个租户或消费方独立 key（用于审计 + 限流）
- key 长度 ≥ 32 chars base64；格式 `crawler_<env>_<random>`（如 `crawler_prod_pk_...`）

### 4.3 `GET /v1/kols` 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `platform` | enum | optional | 过滤平台（`youtube` / `tiktok` / ...）|
| `country_code` | string | optional | ISO-2 国家码过滤 |
| `is_gaming` | boolean | optional | 仅游戏 KOL |
| `min_followers` | integer | optional | 下限 |
| `max_followers` | integer | optional | 上限 |
| `categories` | string (逗号分隔) | optional | 命中任一即返回（OR 语义），如 `MOBA,RPG` |
| `changed_since` | ISO 8601 | optional | 仅返回 `lastCrawledAt >= changed_since` 的条目（增量同步用）|
| `cursor` | opaque string | optional | 上次返回的 `next_cursor`，首次调用为空 |
| `limit` | integer 1-200 | optional (default 50) | 单页返回条数 |

**Response shape：**
```json
{
  "items": [ {...kol schema...}, ... ],
  "next_cursor": "opaque-string-or-null",
  "total_estimate": 5234,
  "generated_at": "2026-04-24T10:30:00Z"
}
```

### 4.4 `GET /v1/kols/:externalId`

返回单条完整 KOL 画像（§3 所有字段），404 若不存在。

### 4.5 增量同步的坑

- 时间戳用**爬虫侧** `lastCrawledAt`（非平台侧 `updatedAt`，你们更有权威）
- 分页不用 offset 用 cursor（100K+ 数据 offset 不可扩展）
- **删除的 KOL**（频道删除 / 封号 / 改 handle）：用专用 `deleted` 字段而非从列表消失
  ```json
  { "externalId": "yt-UCabc", "deleted": true, "deletedAt": "2026-04-20T10:00Z" }
  ```

### 4.6 限流与配额

- 我们的同步 worker 每天大致 1 次全量 + 24 次增量 = ~25 次请求
- 单次请求可能拉 100-200 条
- 请支持至少 **300 req/hour** 限流（MVP）/ **3000 req/hour**（B6）
- 429 响应含 `Retry-After` 头

### 4.7 Webhook（Post-MVP 可选，不是 MVP 要求）

若你们提供 webhook push，我们可以做准实时同步：

- 我们提供 `POST https://kol.guangai.ai/api/v1/crawler-webhook` endpoint
- Body: `{ "events": [{"externalId": "yt-...", "type": "updated|created|deleted", "timestamp": "..."}] }`
- 附 HMAC-SHA256 签名头：`X-Crawler-Signature: hex(hmac_sha256(secret, body))`
- 幂等（同 externalId 同 timestamp 重推无副作用）

**Webhook 不是 MVP 必须**；有就加分，没有我们可接受 polling + changed_since。

---

## 5. 数据质量与 SLA

### 5.1 质量指标（你们保障）

| 指标 | 目标 |
|---|---|
| 核心字段（§3.1 10 个）完整率 | ≥ 98% |
| `followerCount` 准确率（vs 平台 API 官方值） | ≥ 95%，24h 内同步 |
| `categories` AI 分类准确率 | ≥ 85%（人工抽检 100 条） |
| `email` 可送达率（对真实邮箱测试） | ≥ 90% |
| `audienceAgeDist/GeoDist` 与平台自报值偏差 | ≤ 10% per bucket |
| `engagementAuthenticity` 真实性判断准召回 | ≥ 80%（对已知假粉案例测试） |
| 重复/错误去重率（same handle 不同 externalId） | 0% |
| 过期数据保留期（`lastCrawledAt` 超 90 天未更新） | < 5% |

### 5.2 SLA

| 指标 | 目标 |
|---|---|
| API 可用性 | ≥ 99.5% 月 |
| P99 latency（`GET /v1/kols?limit=50`） | ≤ 500ms |
| P99 latency（`GET /v1/kols/:id`） | ≤ 200ms |
| 故障告警响应 | ≤ 4h |

---

## 6. 样例数据（完整 payload）

```json
{
  "externalId": "yt-UCabcdef123",
  "platform": "youtube",
  "handle": "NintendoGalaxy",
  "displayName": "NintendoGalaxy",
  "url": "https://www.youtube.com/@NintendoGalaxy",
  "avatarUrl": "https://yt3.ggpht.com/ytc/...",
  "countryCode": "DE",
  "language": "en",
  "followerCount": 9000,
  "engagementRate": 3.42,
  "avgViews": 2500,
  "uploadsPerMonth": 4,
  "lastUploadAt": "2026-04-20T14:32:00Z",
  "monetizationStatus": "MONETIZED",
  "brandSafetyRating": "G",
  "knownBrandCollabs": ["Nintendo"],
  "categories": ["Retro", "Nintendo", "Indie"],
  "isGaming": true,
  "tags": ["nostalgia", "walkthrough", "commentary"],
  "bio": "Dedicated retro gaming enthusiast exploring Nintendo's greatest hits from NES to Switch.",
  "email": "business@nintendogalaxy.com",
  "audienceAgeDist": {
    "13-17": 0.08, "18-24": 0.32, "25-34": 0.35, "35-44": 0.15,
    "45-54": 0.06, "55-64": 0.03, "65+": 0.01
  },
  "audienceGeoDist": {
    "DE": 0.38, "US": 0.24, "GB": 0.08, "AT": 0.05, "CH": 0.04,
    "FR": 0.03, "NL": 0.03, "OTHER": 0.15
  },
  "audienceGenderDist": {
    "male": 0.81, "female": 0.17, "other": 0.02
  },
  "engagementAuthenticity": 87,
  "dataQuality": "high",
  "fieldSources": {
    "followerCount": "youtube-data-api",
    "avgViews": "youtube-data-api",
    "email": "channel-about-page",
    "categories": "ai-gpt-4",
    "audienceAgeDist": "youtube-analytics-api-authorized"
  },
  "lastCrawledAt": "2026-04-24T08:30:00Z",
  "crawlerVersion": "v2.3.1"
}
```

---

## 7. 交接时间线与里程碑

| 里程碑 | 目标日期 | 交付物 | 责任方 |
|---|---|---|---|
| **M0 · Kickoff** | 2026-04-25 | 本文档确认 + 爬虫团队首次 sync 会议 | 双方 |
| **M1 · API spec v0.1** | 2026-05-05 | OpenAPI spec + 3 端点签名 + sample response | 爬虫团队 |
| **M2 · Sandbox 上线** | 2026-05-15 | 100 条 sample KOL + test API key | 爬虫团队 |
| **M3 · KOLMatrix sync worker v0.1** | 2026-05-25 | 能从 sandbox 拉 100 条到 PG + 展示在 Discovery | KOLMatrix |
| **M4 · 首批 5,000 KOL 交付** | 2026-06-15 | §2.3 MVP 覆盖度；YouTube 平台 7 国 | 爬虫团队 |
| **M5 · 联调 + 端到端验证** | 2026-06-25 | KOLMatrix sync + UI + Journey A 全链路 staging PASS | 双方 |
| **M6 · Prod 上线** | 2026-07-05 | 5,000 KOL 替换静态 seed，Discovery 页真实数据 | KOLMatrix |
| **M7 · 扩展到 TikTok + 50,000 KOL** | 2026-Q3 | §2.3 Post-MVP 覆盖度 | 爬虫团队 |

**关键阻塞风险：**
- M1 晚 → M3 等，整体推迟
- M2 数据质量 < §6.1 目标 → 返工
- M5 联调发现 schema 不匹配 → 回到 M1 迭代

---

## 8. 双方职责边界

### 爬虫团队 ✅ 负责
- 数据采集（各平台 API / scraping / 清洗）
- 去重、归并（跨平台同一人识别）
- AI 分类（categories / tags）
- 数据质量监控与修复
- API 服务部署 + SLA
- 法律合规（ToS / robots.txt / GDPR）
- API 文档 + sample + changelog

### 爬虫团队 ❌ 不负责
- KOLMatrix 平台内的 UI / 筛选逻辑 / 展示
- Email 发送（Resend / 邮件模板等）
- 用户 CRM 状态管理
- 我们的 AI 个性化邮件（aigcgateway Action）
- ROI 计算 / 周报生成
- 客户支持 / 续约等商务流程

### KOLMatrix 团队 ✅ 负责
- 消费爬虫 API 的 sync worker
- 本地 PG 存储（Kol table）+ RLS 多租户隔离
- Discovery / Database / KOL 画像 UI
- 筛选逻辑 + 搜索（tsvector）
- 所有下游功能（Outreach / CRM / ROI / 周报）
- 租户数据权限
- 反馈收集（通过 B7 客户协同筛选 → 爬虫团队数据质量改进）

### KOLMatrix 团队 ❌ 不负责
- 爬虫自身的运行 / 运维
- 数据采集合法性（由你们把关）
- 支持你们改 schema（请先走 §10 流程通知我们）

---

## 9. 变更管理（schema 改动流程）

一旦 M6 上线后，任何 schema 改动走此流程：

1. 爬虫团队 propose change → 写 change doc（含 migration 策略）
2. KOLMatrix 团队 review + agree 时间表（通常需要 2 周适配）
3. 爬虫团队**并行**提供 **old shape + new shape**（字段 alias 或双响应）持续 ≥ 2 周
4. KOLMatrix 切到 new shape
5. 爬虫团队下线 old shape

**禁止**：
- ❌ 爬虫团队单方面改 response shape 不通知
- ❌ 爬虫团队删字段不提前 4 周告知
- ❌ 爬虫团队加字段不更新 OpenAPI spec

---

## 10. 开放问题（请爬虫团队在 M1 前答复）

以下问题需要爬虫团队评估并答复：

1. **平台覆盖优先级**：同意 YouTube → TikTok → Twitch → Instagram → X 顺序吗？或你们有更擅长的平台起步？
2. **首批 5,000 KOL 选择策略**：随机抽 / 按粉丝量 top-down / 按 KOLMatrix 给的 target list 抽？
3. **AI 分类准确率 85% 目标**：你们预估实际水平？需要我们给 sample ground truth 吗？
4. **audienceDemographics 数据源**：YouTube Analytics API 需要 channel owner 授权。你们通过其他方式拿（如 SimilarWeb / Sensor Tower / Social Blade）？数据准确度？
5. **`email` 字段**：你们爬 about 页；若爬不到，改用第三方（如 Hunter.io / Apollo.io）吗？成本由谁出？
6. **中国大陆 KOL 覆盖**：B 站 / 快手 / 小红书是否支持？合规方式？
7. **历史数据**：你们能补 KOL 最近 30/90 天的历史（followerCount trend）吗？或只有当前 snapshot？
8. **`dataQuality: low` 数据是否推送**：按你们判断低质是否推给 KOLMatrix，还是内部过滤？
9. **OpenAPI spec 自动化**：你们 API 是否可以吐 OpenAPI 3.1 YAML 让我们自动生成 client？
10. **退出机制**：某 KOL 要求 "do not track"，你们支持吗？KOLMatrix 收到用户反馈后如何通知你们？

---

## 11. 通信与对接

### 11.1 技术对接会议

- **首次 kickoff**：2026-04-25（或双方方便时）
- **周会**：M1-M6 期间每周 1 次 1h，Zoom / Google Meet
- **Slack / Lark channel**：技术讨论，SLA 内回复

### 11.2 对接人

- **KOLMatrix 产品 + 技术：** johnsong（Planner，cli）
- **KOLMatrix 集成工程师：** TBD（M3 前指定）
- **爬虫团队 产品 + 技术：** TBD（请你们指定）

### 11.3 问题升级路径

1. 字段级疑问 → Slack / Lark channel，24h 内答复
2. Schema 改动 → 周会讨论，文档化共识
3. SLA 问题 → 对接人 + Mgr 24h 内对齐补偿/修复时间
4. 法律/合规问题 → 双方法务会议

---

## 12. 参考资料

- **KOLMatrix 当前 Kol schema**（`prisma/schema.prisma` model Kol，见 §3 即为提炼）
- **KOLMatrix MVP PRD**：产品方向与目标用户（需要请向 KOLMatrix 团队申请）
- **KOLMatrix Discovery UI**（https://kol.guangai.ai/en/discovery，sandbox 账号可访问看 MVP 现状）
- **YouTube Data API v3**：https://developers.google.com/youtube/v3
- **TikTok Developer**：https://developers.tiktok.com/
- **GDPR 合规参考**：https://gdpr.eu/

---

## 13. 文档版本

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-04-24 | 初版，基于 KOLMatrix MVP schema + 15 维 filter 设计 |

**下次修订触发：** 爬虫团队答复 §11 开放问题后 → v1.1 纳入答复 + 锁 API spec v0.1

---

*本文档由 KOLMatrix Planner 起草，**经 KOLMatrix 内部 review 未经商务合同签署不构成法律约定**。最终技术 + 商务细节在后续合作协议中明确。*
