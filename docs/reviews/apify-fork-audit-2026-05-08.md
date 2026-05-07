# apify-kol Fork Audit — guang-tech/apify

> Planner 旁路任务（v0.9.10 模式：不入状态机批次，独立 audit）
>
> - **Audit 日期：** 2026-05-08
> - **Auditor：** Planner johnsong
> - **Audit 对象：** `https://github.com/guang-tech/apify` (private)
> - **目标：** 实物核查 fork 仓库结构 + 5/7 Apify→TikHub 迁移变化 + 4 阻塞项决议依据 + KOLMatrix 接入路径
> - **方法：** `gh api` 抓 README / .env.example / docker-compose.yml / package.json / docs/specs / packages 子树（受限于 private repo 不全 clone，按文件抽样审）
> - **审计动机：** `.auto-memory/project-status.md:16` 记录"5/7 提前交付"+ "fork audit 推荐方案 A"+ "4 阻塞项"，但仓库实物、commit 历史、`docs/specs/` 全无 audit 报告或决议记录 — 违反铁律 1（v0.9.14 任意"X 已实装/未实装"类断言必须实物核查）。本 audit 是补足这块缺失。

---

## 1. Fork 实物状态

| 维度 | 值 |
|---|---|
| 仓库 | `guang-tech/apify` (private) |
| 创建日期 | 2026-05-06T06:56 UTC（5/6 14:56 北京） |
| 最后更新 | 2026-05-07T08:57 UTC（5/7 16:57 北京） |
| 默认分支 | `master` |
| 项目名 | `apify-kol-monorepo` v2026.5.6 |
| 语言 | TypeScript 196KB + JavaScript 10KB + Dockerfile 1KB |
| 工程结构 | pnpm monorepo（pnpm-workspace.yaml） |
| Node 引擎 | ≥18.18.0 |
| Lockfile | pnpm-lock.yaml（184KB） |

### 1.1 顶层文件树

```
.env.example          2.5KB    必填 4 个 env vars
.gitignore            131B
README.md             3.3KB    项目总览 + 30 秒上手
docker-compose.yml    954B     postgres + service 双容器
package.json          463B     workspace 根
packages/             dir      sdk + service 双子包
docs/                 dir      runbooks / specs / user-guide / plans / decisions / backlog
scripts/              dir      运维入口
pnpm-workspace.yaml   27B
pnpm-lock.yaml        184KB
```

### 1.2 packages 子树

| 子包 | name | 角色 |
|---|---|---|
| `packages/sdk/` | `@apify-kol/sdk` | TS 原始接口封装（5/7 全重写为 TikHub REST） |
| `packages/service/` | `@apify-kol/service` | Postgres + pg-boss + Fastify 上层 KOL 数据服务 |

`packages/service/src/`：
```
config.ts             zod env 解析
index.ts              入口
server.ts             Fastify 启动
db/                   Drizzle schema + migrations
extractors/           Level 1 正则 + Level 2 Linktree
jobs/                 pg-boss 配置 + worker 注册
pipeline/             抓取流水线
plugins/              Fastify plugins
repos/                DB 访问层
routes/               HTTP routes
scoring/              4 维度评分
```

### 1.3 docs/specs/ 4 份设计文档

| 文档 | 大小 | 创建日期 | 关键内容 |
|---|---|---|---|
| `2026-05-06-apify-sdk-overview.md` | 4.3KB | 5/6 | SDK 6 个原始接口封装（旧版） |
| `2026-05-06-apify-actor-verification.md` | 8.2KB | 5/6 | Apify Actor 字段口径验证（旧版） |
| `2026-05-06-apify-kol-service-design.md` | 23.7KB | 5/6 | service 主架构设计（最权威） |
| `2026-05-07-tikhub-migration-design.md` | 16.0KB | **5/7** | **Apify→TikHub 全迁移决策 + X 平台新增** |

---

## 2. 重大变化：5/7 Apify → TikHub 全迁移

### 2.1 迁移动机（来源：tikhub-migration-design §1）

| 驱动 | 数据 |
|---|---|
| **成本节省** | Apify $850-$1170/月 → TikHub ~$515/月（**省 $300-650/月 = $4k-7.8k/年**） |
| **平台缺口** | Apify SDK 缺 X(Twitter)，"X 是游戏圈 KOL 核心阵地"；TikHub 原生覆盖 |
| **能力扩展** | TikHub 现成支持评论（僵尸粉率）、直播（主播识别）、IG `category` 字段（"电游玩家"自标分类）、YT `has_business_email`（预筛标志位） |

### 2.2 平台覆盖对比（与 project-status.md:16 不一致）

| 来源 | 平台覆盖 |
|---|---|
| `.auto-memory/project-status.md:16` 记录 | "IG/TT 给 apify YouTube 给 B6"（3 平台分流） |
| **fork 实物（5/7 tikhub-migration §3.5）** | **IG + TikTok + YouTube + X**（**4 平台齐全**） |

**结论：** project-status 记忆条目陈旧（早于 5/7 X 平台扩展）。审 fork 实物：**4 平台**，且字段口径 5/7 已有完整对照表（IG v3 主端点 + TT web/fetch_user_profile + YT web/get_channel_info + X web/fetch_user_profile）。

### 2.3 架构变更要点（tikhub-migration §5）

| 维度 | 老（Apify Actor 模型） | 新（TikHub REST） |
|---|---|---|
| 调用模型 | 异步 actor run + 轮询 + dataset 拉取 | 同步 REST，runSync 模式 2-4s 返回 |
| 抓 1 IG profile | actor run 30-60s | REST call 2-4s |
| 抓 100 username | 1 次 actor run（批） | 100 次 REST call（10 RPS = 10s） |
| 计费维度 | Apify CU + dataset 双维 | TikHub per-call 单价（按定价表） |
| Token | `APIFY_TOKEN` | `TIKHUB_TOKEN`（旧名兼容过渡期） |
| 错误模型 | `ActorRunError` / `DatasetFetchError` | `TikHubApiError` / `UpstreamRejectedError` / `InsufficientBalanceError` / `EndpointNotAllowedError` |

### 2.4 SDK 兼容策略（service 层零改动）

- **SDK 对外字段**：保持 camelCase（`followersCount` / `externalUrl` 等）
- **SDK 内部**：snake_case（TikHub raw `follower_count` / `external_url`）
- **类别名**：`ApifyKolClient = TikHubClient`（迁移窗口）
- **service 层调用代码改动**：≤10 行（仅 env var 名 + 几个 import）

---

## 3. 架构概览

### 3.1 技术栈

| 组件 | 技术 |
|---|---|
| HTTP | Fastify + `@fastify/swagger`（自动 API doc） |
| ORM | Drizzle ORM |
| DB | PostgreSQL 16（业务数据 + pg-boss 队列） |
| Queue | pg-boss（基于 PG，**无需 Redis**） |
| Logger | Pino |
| Test | Vitest（SDK 25 测试 + service 54 测试 = 79 个） |
| 部署 | Docker Compose（service + postgres 双容器） |

### 3.2 数据模型（4 张表）

| 表 | 角色 |
|---|---|
| `kols` | 主表（跨平台 1 行 1 KOL，UNIQUE(platform, platform_user_id)） |
| `scrape_jobs` | 任务历史（hashtag / seed_expansion / refresh / manual_seed / aggregator） |
| `schedules` | 定时调度配置 |
| `aggregator_pages` | Linktree 中转页解析记录 |

`kols` 主表关键列（service-design §3）：
- 影响力：`followers` / `following` / `posts_count` / `total_likes` / `total_views` / `verified` / `is_business_account`
- 联系方式 L1（bio 文本抽）：`emails[]` / `phones[]` / `telegrams[]` / `discords[]` / `social_handles{}` / `external_url` / `external_urls[]`
- 联系方式 L2（Linktree 解析）：`aggregator_url` / `aggregator_emails[]` / `aggregator_links{}`
- 4 维度评分：`relevance_score` / `influence_score` / `quality_score` / `reachability_score`（0-1）
- 调度：`tier` (hot/warm/cold) + `next_refresh_at`
- 来源：`matched_tags[]` / `matched_keywords[]` / `is_seed` / `source_kol_ids[]`

### 3.3 业务定位（README + service-design §背景）

> 业务方读 API 永远是同步快查询（几十毫秒）；爬取由定时/手动后台进行；爬取触发与数据查询解耦；内部服务，无需公网鉴权 / 计费 / 配额。

业务方代码极简：`GET /kol?platform=tiktok&minFollowers=10000&hasEmail=true&sort=reachability`。

### 3.4 对外 API 端点

#### 业务读 API（需 `BUSINESS_API_KEY`，header `x-api-key`）

| Path | 角色 |
|---|---|
| `GET /kol` | 列表查询，15+ 过滤维度 |
| `GET /kol/:platform/:userId` | 单 KOL 详情 |

`GET /kol` 全部 query 参数：`platform` / `tags` / `keywords` / `minFollowers` / `maxFollowers` / `verified` / `hasEmail` / `hasContact` / `minRelevance` / `minInfluence` / `minQuality` / `minReachability` / `sort` (relevance/followers/influence/quality/reachability/recent) / `order` / `page` / `pageSize`

响应字段（与 KOLMatrix Prisma `Kol` model 对齐）：`id` / `platform` / `platformUserId` / `username` / `displayName` / `bio` / `avatarUrl` / `profileUrl` / `followers` / `following` / `postsCount` / `totalLikes` / `totalViews` / `verified` / `isBusinessAccount` / `emails[]` / `phones[]` / `telegrams[]` / `discords[]` / `socialHandles{}` / `externalUrl` / `externalUrls[]` / `aggregatorUrl` / `aggregatorEmails[]` / `aggregatorLinks{}` / `relevanceScore` / `influenceScore` / `qualityScore` / `reachabilityScore`

#### 管理 API（需 `ADMIN_API_KEY`）

| Path | 角色 |
|---|---|
| `POST /admin/scrape-jobs` | 触发抓取 |
| `POST /admin/seeds` | 录种子 KOL |
| `/admin/schedules` CRUD | 定时调度 |
| `GET /admin/scrape-jobs[/:id]` | 任务历史 |
| `GET /admin/aggregator-pages` | Linktree 解析记录 |
| `GET /admin/stats` | 整体统计（含 `apifyCostThisMonthUsd`） |

---

## 4. 成本结构（TikHub 计费 gotcha）

### 4.1 计费基础（tikhub-migration §八附录）

| 项 | 值 |
|---|---|
| Token scope | 全平台（IG v1/v2/v3、TT web/app/creator/ads/shop、YT web/web_v2、X web 等） |
| 余额模式 | balance($) + free_credit($) 两种 |
| **关键阻塞** | **部分 endpoint 不接受 free_credit**（IG / YT / X 主端点） |
| 阶梯折扣 | 仅部分 endpoint 享受（`allow_discount=1`），**IG/YT 主端点不打折** |
| Rate limit | 默认 10 RPS |
| Cache | 每次响应自带 `cache_url`，**24h 内重复访问免费** |

### 4.2 关键端点单价

| 端点类型 | 单价 |
|---|---|
| IG v2/v3 主（profile / followers / following） | **$0.002**（贵 2x） |
| IG v1 / TikTok / YouTube / X | **$0.001** |

### 4.3 月度成本估算（10K KOL 规模）

每个 KOL 平均 2 次 call（profile + posts）= 20K calls/月；按混合定价 ~$0.0014/call 平均：
- **基础月费 ~$28/月**（10K KOL 1 次刷新）
- **包含 hot/warm/cold 分层调度的实际月费 ~$515/月**（hot 每日 + warm 每周 + 长尾每月混合）

### 4.4 TikHub 充值要求

- **MVP / Demo（500-1K KOL）**：建议首充 ≥$50/月 paid balance（避开 free_credit 不可用端点）
- **正式上线（10K KOL）**：~$515/月 paid balance，按月续充
- **付费方**：决议项 — KOLMatrix 项目 vs 爬虫团队商务约定

---

## 5. 部署模式

### 5.1 VPS 推荐配置（deployment.md §2.1）

| 数据规模 | KOL 数量 | 每天 TikHub 任务 | CPU | RAM | 磁盘 | VPS 月费 |
|---|---|---|---|---|---|---|
| **冷启动 / Demo** | <1k | <50 | 1 vCPU | 1 GB | 20 GB SSD | $5-10（Hetzner CX11 / DO） |
| **MVP 单领域** | 1k-10k | 50-200 | 2 vCPU | 2 GB | 40 GB SSD | $10-20（Hetzner CPX11） |
| **多领域 / 10k+** | 10k-50k | 200-1000 | 4 vCPU | 4 GB | 80 GB SSD | $20-40（Hetzner CPX21） |
| **大规模** | 50k+ | 1000+ | 8 vCPU | 8 GB | 200 GB SSD | $50+ |

> 瓶颈在 TikHub 端的 RPS / 并发限制，不在 VPS。

### 5.2 网络与安全

- **入站**：仅 SSH (22)；service 3000 + PG 5432 **保持只在内部网络可达，不暴露公网**
- **出站**：访问 `api.tikhub.io` (HTTPS) + Linktree 域名 (`linktr.ee` / `beacons.ai`) + 通用 HTTPS
- **DNS / TLS**：默认不需要；仅当对外暴露才申请域名 + 反代

### 5.3 部署 3 选项

| 选项 | 描述 | 优劣 |
|---|---|---|
| **A. 复用 KOLMatrix VM** | apify-kol-service docker compose 部署到 prod VM；apify_kol DB 独立（不影响 kolmatrix DB） | ✅ 资源开销小（~1-2 GB RAM）；16GB VM 富余；零增量月费<br>⚠️ 与 KOLMatrix 共生，单点故障联动 |
| **B. 独立 VPS** | Hetzner CPX11 ~$10/月，完全隔离 | ✅ 隔离性好，资源独立<br>⚠️ +$10/月成本；需独立监控 |
| **C. 爬虫团队自托管** | 爬虫团队部署，KOLMatrix 通过内网 / VPN 调用 | ✅ 商务边界清晰<br>⚠️ 跨网络延迟；需 VPN 配置 |

**Audit 推荐：** Demo 早期 → A；上线稳定后 → B；需爬虫团队负责运维 → C。

---

## 6. KOLMatrix 接入路径

### 6.1 KOLMatrix 端现状

`src/lib/kol-sync/`：
```
adapters/
  crawler-team.ts.todo   ← 占位（基于 4/24 handoff-v1 设计，与 5/7 fork 实物 API 不一致 ⚠️）
  mock.ts                ← 测试用
  youtube.ts             ← B6 落地的 YouTube Data API adapter
cursor.ts                ← 游标分页
dispatcher.ts            ← KolSyncDispatcher 调度器
engagement-batch-client.ts
engagement-batch.ts
import.ts                ← Prisma upsert 入口
log.ts
published-after.ts
quality.ts               ← 5 条质量过滤规则
refresh-selector.ts
retry.ts                 ← 30s/2min/5min 重试
types.ts                 ← KolSyncAdapter trait + RawKolData type
```

### 6.2 ⚠️ 占位与实物 API 不一致

`crawler-team.ts.todo` 占位是基于 `docs/product/kol-crawler-team-handoff-v1.md` (4/24 handoff)，与 5/7 fork 实物 API 不一致：

| 字段 | 占位（handoff-v1 设计） | fork 实物（apify-kol-service） |
|---|---|---|
| API base | `https://api.crawler-team.example/v1` | `http://<host>:3000`（内网调用） |
| 鉴权 | `Authorization: Bearer <token>` | `x-api-key: <BUSINESS_API_KEY>` header |
| 业务读 path | `GET /v1/kols?...` | `GET /kol?...`（无 v1 前缀） |
| Refresh path | `GET /v1/kols/:externalId` | `GET /kol/:platform/:userId` |
| 字段命名 | snake_case (handoff §3) | **camelCase**（service 端转换过的） |
| 平台覆盖 | YouTube only（占位文件 §discover 注释） | **IG + TikTok + YouTube + X** |
| 分页 cursor | `?cursor=...&limit=...&next_cursor=...` | `?page=...&pageSize=...` |
| 字段 mapping | `externalId/handle/displayName/subscriberCount/topicCategories/...` | `platformUserId/username/displayName/followers/matchedTags/.../emails[]/phones[]/socialHandles{}/aggregator*` |

**结论：** crawler-team.ts.todo 占位**不能直接 promote**为 .ts，需按 fork 实物 API 重写。差异点 ~30%，但接入策略（KolSyncAdapter trait 实现）依然适用。

### 6.3 接入实装路径（修订版，按 fork 实物）

5 步实装：

1. **新建 `src/lib/kol-sync/adapters/apify-kol.ts`**（不复用 crawler-team.ts.todo，因 API 不一致；旧占位删除或归档）
   - implements `KolSyncAdapter`
   - constructor: `{ baseUrl, apiKey, maxRequestsPerSecond, maxItemsPerRun }`
   - `discover(params)`: `GET /kol?platform=...&minFollowers=...&page=N&pageSize=100`，循环到 `data.length < pageSize`
   - `refresh(externalIds)`: 按 platform 分组，调 `GET /kol/:platform/:userId` per id
   - `healthCheck()`: `GET /health` 返回 `{status: "ok"}`

2. **字段映射 `mapApifyKolItemToRawKolData(item)`**：
   - `id` (string) → `externalId`
   - `platformUserId` → `externalId`（备用）
   - `username` → `handle`
   - `displayName` → `displayName`
   - `bio` → `description`
   - `avatarUrl` → `thumbnailUrl`
   - `profileUrl` → 复用 import.ts deriveUrl
   - `followers` → `subscriberCount`
   - `matchedTags[]` → `topicCategories[]`
   - `emails[]` / `phones[]` / `aggregatorEmails[]` → `raw.contacts.{emails,phones,...}`
   - `relevanceScore` / `influenceScore` 等 → `raw.scoring`
   - `tier` → `raw.tier`
   - 全部 raw 留档

3. **集成测试 `tests/integration/apify-kol-adapter.test.ts`**：
   - msw 或 fixture server mock fork 端 `/kol` 响应
   - 验证 pagination + 429 + 字段映射 + Prisma upsert 一致

4. **scripts/kol-sync-daily.ts 接入**：
   ```ts
   const dispatcher = new KolSyncDispatcher([
     new YouTubeKolSyncAdapter(/* B6 已在 */),
     new ApifyKolSyncAdapter({
       baseUrl: process.env.APIFY_KOL_BASE_URL!,
       apiKey: process.env.APIFY_KOL_BUSINESS_API_KEY!,
     }),
   ]);
   ```

5. **env vars**：
   - `.env.production` + `.env.staging` 加 `APIFY_KOL_BASE_URL` + `APIFY_KOL_BUSINESS_API_KEY`
   - `.auto-memory/environment.md` secrets 表加 2 行
   - `docs/dev/kol-sync-runbook.md` 更新 cron 调度说明（apify-kol 与 youtube 双 adapter）

**预估工时：** ~5-6h Generator + 0.5h Reviewer

### 6.4 双数据源策略（B6 cross-ref 已设计好）

`metadata.source` 字段区分：
- `'youtube-api-daily'` → B6 YouTube Data API adapter
- `'apify-kol'` → fork 端 apify-kol service

互为容灾：apify-kol 端故障时 YouTube 单源继续 / YouTube 端 quota 耗尽时 apify-kol 兜底。

---

## 7. 4 阻塞项答疑（基于 fork 实物）

### 7.1 TikHub 付费 ✅ 决议依据明确

| 子问题 | 答 |
|---|---|
| 必须付费吗？ | **是**。IG/YT/X 主端点不接受 free_credit |
| 月度预算？ | Demo: ≥$50；正式上线（10K KOL）: ~$515 |
| 付费方？ | **待用户决议** — KOLMatrix 项目 vs 爬虫团队商务约定 |
| 如何充值？ | https://user.tikhub.io/dashboard/key 按 paid balance 充 |
| 监控？ | apify-kol service `/admin/stats` 返回 `apifyCostThisMonthUsd`（命名残留 Apify 时代，实际是 TikHub） |

### 7.2 部署位置 ✅ 3 选项推荐 A → B 渐进

见 §5.3。**Audit 推荐 5/13 早期 = A（复用 KOLMatrix VM）**：
- 复用 prod VM（16GB RAM 富余）
- apify-kol service 独立 PG DB（不影响 kolmatrix DB）
- docker-compose 内部网络通信（KOLMatrix 调 `http://localhost:3000/kol`，零公网延迟）
- 零增量 VPS 月费

### 7.3 批次调度 ✅ 自动化

apify-kol service **自带 pg-boss + cron**：
- `REFRESH_SCHEDULER_INTERVAL_MS=300000`（5min 扫一次 next_refresh_at < now() 的 KOL）
- hot/warm/cold tier 分层（hot 每日 / warm 每周 / cold 每月）
- KOLMatrix 端 `scripts/kol-sync-daily.ts` 仅消费 `GET /kol?...`（与 BL-052 F003 `kpi-snapshot:daily` 同 cron 行 00:30 UTC）

### 7.4 5/13 是否含 ⚠️ 推荐 5/13 **不含**

3 项前置：

| 前置 | 工时 | 阻塞依赖 |
|---|---|---|
| (a) apify-kol-service 部署到 KOLMatrix VM + TikHub 充值 + smoke | ~半天 + ~$50 充值 | 用户决议付费方 + 充值入口 |
| (b) KOLMatrix 端 `apify-kol.ts` adapter 实装 + 测试 + dispatcher 集成 | ~5-6h Generator + 0.5h Reviewer | 前置 (a) 必须先 ready |
| (c) seed KOL 录入 + 触发首批抓取 + 数据累积 | ~1-2 天（异步抓取需运行时间） | hot 头部当天可见，长尾需 1 周累积 |

**总 end-to-end 时间：** ~2-3 天（5/13 上线前 buffer 5 天理论可行，但 cold 数据累积会跨上线）

**Audit 建议时间线：**
- 5/13 上线**不含** BL-012；保持现有 B6 YouTube + manual seed + Apify Discovery 数据
- 5/14-5/15 启动 BL-012 stage 1 + 2（部署 + adapter 实装）
- 5/16-5/20 数据累积 + 业务测继承
- 5/22 起 BL-012 完整可用

---

## 8. 推荐方案：BL-012 拆 2 stage

### Stage 1: BL-012a-apify-kol-deploy（Planner ops + 用户手动）

| 项 | 值 |
|---|---|
| 类型 | Codex-only 批次（pure ops，无代码改动 KOLMatrix） |
| 工时 | ~半天 + 用户充值 |
| Features | F001 KOLMatrix VM 装 docker-compose 上下游验证 / F002 git clone fork + .env 配 / F003 docker compose up + smoke /health + /admin/stats / F004 TikHub paid balance 充值 ≥$50 / F005 录 1-2 个 seed KOL 触发首批抓取 / F006 验证 GET /kol 返回数据 |
| Owner | Planner ops（部署）+ 用户手动（充值 + 商务决议） |
| 依赖 | 无 |
| 触发时机 | BL-052 done 后 5/13-5/14 |

### Stage 2: BL-012b-apify-kol-adapter（Generator 工作）

| 项 | 值 |
|---|---|
| 类型 | 普通批次（generator） |
| 工时 | ~5-6h Generator + 0.5h Reviewer |
| Features | F001 新建 `src/lib/kol-sync/adapters/apify-kol.ts` + KolSyncAdapter trait 实装 / F002 `mapApifyKolItemToRawKolData` 字段映射 / F003 集成测试 ≥3 case / F004 dispatcher 集成 + scripts/kol-sync-daily.ts 加 adapter / F005 env vars + 5 处 sync 协议 / F006 删除/归档 `crawler-team.ts.todo`（API 不一致） / F007 docs/dev/kol-sync-runbook.md 更新 + environment.md secrets 表 +2 行 |
| Owner | Generator |
| 依赖 | Stage 1 完成（apify-kol service 在 staging/prod 运行） |
| 触发时机 | Stage 1 done 后立即 |

---

## 9. 风险清单

| 风险 | 影响 | 缓解 |
|---|---|---|
| TikHub 上游平台 ban → 400 通用错误 | 抓取失败率上升 | apify-kol 内部 `UpstreamRejectedError` + 重试；KOLMatrix 端 youtube adapter 单源继续 |
| TikHub balance 耗尽 → 402 | 抓取静默停止 | apify-kol `/admin/stats` 月度监控 + KOLMatrix BL-054 后加告警；用户每月续充 |
| IG v2 端点抽风（实测当前不可用） | profile 抓取失败 | SDK 只用 IG v1/v3，代码禁用 v2（5/7 已落） |
| YT 数字字段返回 string（"482M subscribers"） | 类型不一致 | SDK 内部统一 parser 转 number（5/7 已落） |
| fork 仓库 private + 单点维护方 | 协作风险 / Bus factor | 5/7 提前交付证明合作活跃；建议 KOLMatrix 端保留 mirror 或 git submodule 兜底 |
| **占位 `crawler-team.ts.todo` 与实物 API 不一致** | Generator 误用占位会写错 | Stage 2 F006 删除占位 + 新写 `apify-kol.ts`（本 audit 明示） |
| apify-kol service `/admin/stats.apifyCostThisMonthUsd` 字段名残留 | 字段名误导 | 5/7 tikhub-migration §七验收标准要求改名 `tikhub_cost_usd`，但 README ai-usage.md 5/7 还显示旧名 — 跟踪 fork 后续修订 |
| KOLMatrix VM 共生单点故障 | apify-kol + KOLMatrix 一起挂 | Stage 2 后期评估迁独立 VPS（部署选项 B） |
| TikHub paid balance 商务约定未定 | 不知道谁付费 | 用户决议必须先 lock |

---

## 10. 用户决议清单（5 项）

| # | 决议项 | 选项 |
|---|---|---|
| **1** | TikHub paid balance 付费方 | A. KOLMatrix 项目自付（建议 demo 早期）<br>B. 爬虫团队负责<br>C. 商务后续约定 |
| **2** | apify-kol service 部署位置 | A. 复用 KOLMatrix VM（推荐 5/13 早期）<br>B. 独立 VPS（推荐稳定后）<br>C. 爬虫团队自托管 |
| **3** | 5/13 上线是否含 BL-012 | A. 5/13 不含（推荐，buffer 安全）<br>B. 5/13 含 stage 1 only（service 部署，KOLMatrix 端 adapter 5/14+）<br>C. 5/13 全含（需 5/8-12 加紧实装，buffer 紧张） |
| **4** | TikHub paid balance 首充金额 | A. $50（demo / 1K KOL 量级）<br>B. $200（MVP / 5K KOL 量级）<br>C. $515（正式 / 10K KOL 量级）<br>D. 暂不充，先看 free_credit 试 |
| **5** | BL-012 拆 stage 还是合并 | A. 拆 stage 1 + 2（推荐，依赖清晰）<br>B. 合并单批次（stage 1 由 Planner ops 嵌入，stage 2 generator 接力） |

---

## 11. Audit 后续动作（v0.9.10 模式 5 项）

按 `framework/harness/planner.md` §"上线前 audit 触发条件" 用户接收后 Planner 后续动作：

1. **backlog.json 增补 BL-012 文件:行明细** — 把 4 阻塞项答疑、Stage 1+2 拆分、API 不一致警告（占位 `crawler-team.ts.todo` 与 fork 实物差异）写入 BL-012 description
2. **新增 BL-012a / BL-012b 条目（如用户选 stage 拆分）** — 决议项 #5 = A 时
3. **`.auto-memory/project-status.md` 更正第 16 行** — "IG/TT 给 apify YouTube 给 B6"陈旧表述改为"4 平台齐全 IG+TT+YT+X via TikHub"
4. **proposed-learnings.md 加候选** — 反面案例「记忆条目陈旧风险」候选 v0.9.17（5/7 fork 实物已新增 X 平台 + Apify→TikHub 全迁移，但 project-status 记忆停留在 4/24-5/7 之间的中间态）
5. **不动当前 in-flight 批次** — BL-052 已 done，无 in-flight；本 audit 不打断任何状态机批次

---

## 12. 附录：审计方法限制

- Fork 仓库 private，未做完整 clone，仅 `gh api` 抽样审 README + .env.example + docker-compose.yml + package.json + 4 份 docs/specs + packages/ 目录结构 + ai-usage.md 前 120 行 + service-design.md 前 200 行
- 未实测 fork 端 `GET /health` / `GET /kol` 返回（需先部署）
- 未实测 TikHub paid balance 充值流程（需用户决议付费方）
- 未审 fork commits 历史（仅看到 5/6 创建 + 5/7 16:57 最后更新）
- 未审 fork 单测实物（仅看到 README 声称 SDK 25 + service 54 = 79 个）

完整核对建议：用户决议方案后，Stage 1 部署 ops 阶段做 staging smoke + adapter 实装阶段做 fork 单测跑通验证。
