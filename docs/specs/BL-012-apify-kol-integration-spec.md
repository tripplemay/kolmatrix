# BL-012 apify-kol Integration Spec

> KOLMatrix 接入爬虫团队 `guang-tech/apify` fork（apify-kol-service）作为第二数据源，与 B6 YouTube Data API adapter 双源容灾。
>
> - **Spec 起草日期：** 2026-05-08
> - **Spec 作者：** Planner johnsong
> - **批次类型：** 单批次合并（Stage 1 ops 在 §4 数据准备 + Stage 2 features.json 7 generator features）
> - **状态：** Locked → Building（features.json F001-F007）
> - **关联文档：** `docs/reviews/apify-fork-audit-2026-05-08.md`（462 行 audit 报告 / 用户决议依据）

---

## 1. 背景与目标

### 1.1 业务背景

KOLMatrix 当前 KOL 数据源：
- **B6 YouTube Data API daily sync**（`src/lib/kol-sync/adapters/youtube.ts`，prod 在用）
- **静态 XLSX seed**（2524 条，已逐步淘汰）
- **Apify Discovery API 即用即抓**（discovery 页 ad-hoc）

爬虫团队 5/6 创建 `guang-tech/apify` fork，5/7 完成 Apify→TikHub 全迁移，提供独立的 apify-kol-service（IG+TikTok+YouTube+X 4 平台覆盖）。本批次接入此 service 作为第二数据源。

### 1.2 业务目标

1. **多平台覆盖：** 接入 apify-kol 后 KOLMatrix 数据源覆盖 IG / TikTok / YouTube（B6 + apify 双源容灾）/ X 4 平台
2. **双源互备：** B6 YouTube quota 耗尽时 apify 兜底；apify TikHub 端故障时 B6 单源继续
3. **5/13 上线节点：** 含 Stage 1（service 已部署 + 数据后台累积），不含 Stage 2 KOLMatrix 端 adapter；5/14-15 完成 Stage 2 prod redeploy

### 1.3 audit 已锁定的 5 项决议

| # | 决议项 | 选择 |
|---|---|---|
| 1 | TikHub paid balance 付费方 | **B. 爬虫团队负责** |
| 2 | apify-kol service 部署位置 | **A. 复用 KOLMatrix VM** |
| 3 | 5/13 上线是否含 BL-012 | **B. 含 Stage 1 only**（service 部署，KOLMatrix 端 adapter 5/14+） |
| 4 | TikHub 首充金额 | **A. $50 demo / 1K KOL 量级** |
| 5 | BL-012 拆 stage 还是合并 | **B. 合并单批次**（Stage 1 ops 入 spec §4，Stage 2 features.json） |

### 1.4 范围边界

**本批次包含：**
- KOLMatrix 端新建 `src/lib/kol-sync/adapters/apify-kol.ts` adapter（implements KolSyncAdapter）
- 字段映射 `mapApifyKolItemToRawKolData()`（fork 实物 camelCase → KOLMatrix `RawKolData`）
- dispatcher 集成 + scripts/kol-sync-daily.ts 接入
- 集成测试 ≥3 case
- 文档同步（runbook + environment.md secrets 表）
- 删除/归档过期占位 `crawler-team.ts.todo`（与 fork 实物 API 不一致，audit §6.2）

**本批次不包含：**
- apify-kol-service 端代码改动（fork 维护方负责）
- KOLMatrix 端新增 UI / Discovery 页面调用 apify 业务读 API（数据通过 sync 流入 Kol 表后既有 UI 自动可用）
- TikHub 充值 / 商务约定（爬虫团队负责）
- 4 平台 IG/TT/X 的 Discovery 抓取链路（apify-kol-service 自动处理；KOLMatrix 端 adapter 仅消费 sync 数据）

---

## 2. 关键设计决策

### 2.1 为什么不复用 `crawler-team.ts.todo` 占位

`src/lib/kol-sync/adapters/crawler-team.ts.todo` 是 4/24 基于 `docs/product/kol-crawler-team-handoff-v1.md` 起的占位，与 5/7 fork 实物 API 不一致：

| 字段 | 占位（handoff-v1 设计） | fork 实物（apify-kol-service） |
|---|---|---|
| API base | `https://api.crawler-team.example/v1` | `http://<host>:3000`（KOLMatrix VM 内网） |
| 鉴权 | `Authorization: Bearer <token>` | `x-api-key: <BUSINESS_API_KEY>` header |
| 业务读 path | `GET /v1/kols?...` | `GET /kol?...`（无 v1 前缀） |
| Refresh path | `GET /v1/kols/:externalId` | `GET /kol/:platform/:userId` |
| 字段命名 | snake_case | **camelCase** |
| 平台覆盖 | YouTube only | **IG + TikTok + YouTube + X** |
| 分页 cursor | `?cursor=...&limit=...&next_cursor=...` | `?page=...&pageSize=...` |

**决策：** F005 删除/归档 `crawler-team.ts.todo`，新写 `apify-kol.ts`。删除文件比 promote 后改字段更省工时（占位字面错配 ~30%）。

### 2.2 字段映射策略

KOLMatrix `RawKolData` schema（`src/lib/kol-sync/types.ts`）vs fork 实物 `GET /kol` 响应：

| KOLMatrix RawKolData | fork 实物 camelCase | 转换 |
|---|---|---|
| `externalId` | `id`（string）| 直传 |
| `platform` | `platform`（enum）| 直传 |
| `handle` | `username` | 直传 |
| `displayName` | `displayName` | 直传 |
| `description` | `bio` | 直传 |
| `thumbnailUrl` | `avatarUrl` | 直传 |
| `subscriberCount` | `followers` | 直传（`bigint→number` 已 service 端处理） |
| `topicCategories` | `matchedTags` | 直传 |
| `country` | — | null（fork 实物未带 country；KOLMatrix 端 fallback null） |
| `language` | — | null（同上） |
| `lastUploadAt` | — | null（fork 端在 raw.posts[0].createTime；本批次不展开，留 raw） |
| `brandSafetyRating` | — | null（fork 实物 4 维度评分独立，不映射到 brandSafetyRating） |
| `raw` | 完整响应 + scoring + contacts | 整体存 `raw`（含 `relevanceScore` / `influenceScore` / `qualityScore` / `reachabilityScore` / `tier` / `emails[]` / `phones[]` / `aggregatorEmails[]` 等 fork 端 enrichment） |

**关键设计：** B5/B6 后续 enrichment 阶段会从 `raw` 提取 `email` / `engagementRate` 等到 Prisma 列；本批次不动 enrichment 链路，仅做 RawKolData 入库。

### 2.3 Adapter 命名 `apify-kol` 而非 `crawler-team`

`metadata.source` 字段：
- 已在用：`'youtube-api-daily'`（B6 YouTube adapter）
- **新增：`'apify-kol'`**（不用 `'crawler-team'`，因 fork 实物项目名是 apify-kol-monorepo，命名一致）

下游 dispatcher / quality / refresh-selector / 周报模块按 `metadata.source` 分支：本批次新增 `'apify-kol'` 分支需在 quality module 加质量过滤规则（继承 youtube 规则 + fork 端 4 维度评分作辅助信号）。

### 2.4 Pagination 策略

fork 实物 `GET /kol`：page-based pagination（`?page=N&pageSize=100`，最大 100）。

Adapter 实装：循环到 `data.length < pageSize` 即结束（无 next_cursor 字段）。配 `maxItemsPerRun` 上限（默认 5000）防爆量。

### 2.5 错误处理与重试

apify-kol-service 上游错误透传：
- 401/403 → `AdapterAuthError`（API key 配置错；不重试，告警）
- 429 → `AdapterRateLimitError`（fork 端限速；按 `Retry-After` 重试）
- 502/503 → `AdapterTransientError`（service 重启 / 健康检查失败；走既有 30s/2min/5min retry）
- 5xx 其他 → `AdapterUnknownError`（重试 3 次后 fail）

dispatcher 既有 `withRetry` wrapper（`src/lib/kol-sync/retry.ts`）已覆盖此模式，adapter 本身保持 stateless surface 错误。

---

## 3. 数据契约

### 3.1 fork 实物 `GET /kol` Response Shape（已确认 audit §3.4）

```json
{
  "data": [
    {
      "id": "1",
      "platform": "tiktok" | "instagram" | "youtube",
      "platformUserId": "6893491656277394438",
      "username": "tommiimichelle",
      "displayName": "Tommi Michelle",
      "bio": "black girl gamer | twitch partner",
      "avatarUrl": "https://...",
      "profileUrl": "https://www.tiktok.com/@tommiimichelle",

      "followers": 38800,
      "following": 850,
      "postsCount": 137,
      "totalLikes": 591700,
      "totalViews": null,
      "verified": false,
      "isBusinessAccount": null,

      "emails": ["business@xx.com"],
      "phones": [],
      "telegrams": [],
      "discords": [],
      "socialHandles": { "twitch": "xxx" },
      "externalUrl": "https://twitch.tv/xxx",
      "externalUrls": [...],

      "aggregatorUrl": null,
      "aggregatorEmails": [],
      "aggregatorLinks": null,

      "relevanceScore": 0.5,
      "influenceScore": 0.7,
      "qualityScore": null,
      "reachabilityScore": 0.4,

      "matchedTags": ["gaming", "esports"],
      "matchedKeywords": ["gameplay"],
      "tier": "warm",
      "isSeed": false
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

**重要：** X(Twitter) 平台 audit 时 fork README 未明示是否在 `GET /kol?platform=...` 已支持（README 仅列 IG/TT/YT 三 enum）。如 X 平台尚未在业务读 API exposed，本批次接入 IG+TT+YT 三平台已 OK，X 等 fork 端 ready 后追加。

### 3.2 fork 实物 `GET /health`

```json
{ "status": "ok" }
```

KOLMatrix `healthCheck()` 验证：HTTP 200 + body `status === "ok"`。

### 3.3 fork 实物 `GET /kol?platform=:p` 过滤维度

15+ 过滤维度（audit §3.4 已列）。本批次 adapter 调用最少使用：
- `platform`（必填）
- `minFollowers`（可选）
- `hasEmail`（可选，加速 email-only 抽取）
- `sort=recent`（按 `last_scraped_at` 降序，增量同步）
- `page` / `pageSize`

---

## 4. 数据准备步骤（Stage 1 ops，5/13 上线前必须完成）

> **说明：** Stage 1 不入 features.json，由 Planner ops + 用户协作完成。Stage 2 building 启动前需 Stage 1 §4.1-§4.6 全部 ✓。Generator building 不实施 Stage 1 ops（铁律 #6 executor 边界）。

### 4.1 [用户 + 爬虫团队] TIKHUB_TOKEN + 首充

| 任务 | Owner | Acceptance |
|---|---|---|
| 协调爬虫团队提供 `TIKHUB_TOKEN`（apify-kol-service `.env` 必填） | 用户 + 爬虫团队 | TIKHUB_TOKEN 可用，长度 ≥40 字符（来自 https://user.tikhub.io/dashboard/key） |
| 爬虫团队 TikHub paid balance 首充 ≥$50（决议 4=A） | 爬虫团队 | TikHub Dashboard 显示 paid balance ≥$50 + IG/YT/X 主端点 quota 可用 |

### 4.2 [Planner ops + 用户] KOLMatrix VM SSH 部署 apify-kol-service

| 任务 | Owner | Acceptance |
|---|---|---|
| `ssh tripplezhou@34.180.93.185 'cd /opt && git clone git@github.com:guang-tech/apify.git apify-kol-service'` | Planner ops | `/opt/apify-kol-service/` 存在 + git status clean |
| `cp .env.example .env` 填 4 个必填变量 | Planner ops（用户提供 token） | `.env` 含 `POSTGRES_PASSWORD` / `TIKHUB_TOKEN` / `BUSINESS_API_KEY` / `ADMIN_API_KEY`，全部强随机 ≥32 字符 |
| 端口选定 | Planner ops | `SERVICE_PORT=3003`（避开 3001 KOLMatrix prod / 3002 KOLMatrix staging）+ `POSTGRES_PORT=15432`（避开 5432 共享 PG） |
| `docker compose up -d` | Planner ops | 2 容器 healthy（postgres + service），`docker ps` 显示 2 个 running |

### 4.3 [Planner ops] Service smoke

| 任务 | Owner | Acceptance |
|---|---|---|
| `curl http://localhost:3003/health` | Planner ops | 返回 `{"status":"ok"}` |
| `curl http://localhost:3003/docs`（Swagger UI） | Planner ops | HTTP 200 + Swagger HTML |
| `curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:3003/admin/stats` | Planner ops | 返回 `{kolsByPlatform:[],kolsByTier:[],apifyCostThisMonthUsd:0}`（空库正常） |

### 4.4 [Planner ops + 用户] 录种子 KOL + 触发首批抓取

| 任务 | Owner | Acceptance |
|---|---|---|
| `POST /admin/seeds` 录入 5-10 个游戏 KOL 种子（IG / TT / YT / X 各 1-2 个） | Planner ops + 用户提供种子列表 | 种子已写入 apify-kol service 端 `kols` 表 + `is_seed=true` |
| `POST /admin/scrape-jobs` 触发 hashtag 抓取（如 "gaming" / "mobilegame" 各 100 帖） | Planner ops | 任务 status=queued / running 不直接 fail |
| 等 24h 数据累积 | 自动 | `GET /admin/stats` 返回 `kolsByPlatform` 含至少 50 个真 KOL |

### 4.5 [Planner ops] KOLMatrix VM .env 加 apify-kol 环境变量

| 任务 | Owner | Acceptance |
|---|---|---|
| `/opt/kolmatrix/.env.production` + `/opt/kolmatrix-staging/.env.staging` 各加 2 行：`APIFY_KOL_BASE_URL=http://localhost:3003` + `APIFY_KOL_BUSINESS_API_KEY=<BUSINESS_API_KEY 同 4.2>` | Planner ops（铁律 #6 跨角色 ops 用户授权） | env 文件已加 + `pm2 reload kolmatrix --update-env` + `pm2 reload kolmatrix-staging --update-env` |

### 4.6 [用户] business 验证 fork 数据可用性

| 任务 | Owner | Acceptance |
|---|---|---|
| `curl -H "x-api-key: $BUSINESS_API_KEY" http://localhost:3003/kol?platform=tiktok&pageSize=5` | 用户 | 返回 5 个 KOL 数据 + 字段齐全（含 emails / scores / matchedTags） |

### 4.7 Stage 1 完成判定

§4.1-§4.6 全部 ✓ → Generator 可启动 Stage 2 building（features.json F001-F007）。

§4.1-§4.6 任一未完成 → building 等待，Planner 在 progress.json `evaluator_feedback` 字段记录"Stage 1 ops 进度"+ 用户授权 ops 落实情况。

---

## 5. KOLMatrix 端实装（Stage 2，features.json F001-F007）

### 5.1 文件总览

新增 / 修改 / 删除：

| 文件 | 操作 | feature |
|---|---|---|
| `src/lib/kol-sync/adapters/apify-kol.ts` | 新增（implements KolSyncAdapter） | F001 + F002 |
| `tests/integration/apify-kol-adapter.test.ts` | 新增（≥3 case） | F003 |
| `src/lib/kol-sync/dispatcher.ts` | 修改（注册 apify-kol adapter） | F004 |
| `scripts/kol-sync-daily.ts` | 修改（dispatcher 注入 apify-kol adapter） | F004 |
| `src/lib/kol-sync/quality.ts` | 修改（加 `'apify-kol'` source 分支质量规则） | F004 |
| `src/lib/kol-sync/adapters/crawler-team.ts.todo` | **删除**（占位与实物 API 不一致） | F005 |
| `docs/dev/kol-sync-runbook.md` | 修改（双 adapter 调度说明） | F006 |
| `.auto-memory/environment.md` | 修改（secrets 表 +2 行 + 新增 §"apify-kol service" 段） | F006 |

### 5.2 关键 API 调用模式

```ts
// adapters/apify-kol.ts
export class ApifyKolSyncAdapter implements KolSyncAdapter {
  readonly name = "apify-kol";
  readonly source = "apify-kol";

  constructor(private readonly cfg: ApifyKolAdapterConfig) {}

  async discover(params: SyncParams): Promise<RawKolData[]> {
    const items: RawKolData[] = [];
    let page = 1;
    const pageSize = 100;
    while (items.length < (this.cfg.maxItemsPerRun ?? 5000)) {
      const resp = await this.fetch(
        `/kol?platform=${params.platform}&page=${page}&pageSize=${pageSize}&sort=recent`
      );
      const batch = resp.data.map(mapApifyKolItemToRawKolData);
      items.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }
    return items;
  }

  async refresh(externalIds: readonly string[]): Promise<RawKolData[]> {
    return Promise.all(
      externalIds.map(async (id) => {
        // id 形式 "platform:platformUserId"（与 import.ts 现有约定对齐）
        const [platform, platformUserId] = id.split(":");
        const item = await this.fetch(`/kol/${platform}/${platformUserId}`);
        return mapApifyKolItemToRawKolData(item);
      })
    );
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const resp = await this.fetch("/health");
    return {
      healthy: resp.status === "ok",
      details: { upstream: "apify-kol-service" },
    };
  }

  private async fetch(path: string): Promise<any> {
    const url = `${this.cfg.baseUrl}${path}`;
    const headers = { "x-api-key": this.cfg.apiKey };
    // 错误分类参 §2.5
    // ...
  }
}
```

---

## 6. 测试策略

### 6.1 单测（F001 同 commit）

`apify-kol.ts` 内部 `mapApifyKolItemToRawKolData()` 纯函数单测：
- ≥3 case：完整 IG profile / 缺 email TT profile / 缺 scores YT profile

### 6.2 集成测试（F003）

`tests/integration/apify-kol-adapter.test.ts`，msw / vitest fixture mock fork 端响应：

| Case | 验证 |
|---|---|
| 1. discover 多页 | mock 3 页响应 → adapter 循环到 `data.length < pageSize` 退出 → 返回数据条数对（300 条） |
| 2. discover 429 + Retry-After | mock 第 2 页 429 with Retry-After: 5 → adapter 重试 → 第 3 次成功 → 总耗时 ≥5s |
| 3. refresh 单个 KOL | mock GET /kol/tiktok/123 → 字段映射正确 → Prisma upsert 通过 import.ts 路径 |
| 4. healthCheck OK | mock /health 返回 `{status:"ok"}` → healthy=true |

### 6.3 L1 验证（F007）

`npm run lint` 0 error / `npx tsc --noEmit` 0 error / `npm test` 1084+ tests 全绿（含新 IT）/ `npm run test:integration` 既有 + 新 PASS。

### 6.4 acceptance 边界（v0.9.16 P5.2 应用）

`tests/integration/pre-commit-hook.test.ts` flaky 已 BL-052 P5 裁决划归 BL-054，本批次 acceptance **不含**全套 `npm run test:integration` 普遍绿门槛。Reviewer 验收只看 BL-012 引入测试 + spec acceptance 表逐项。

---

## 7. 部署 + cron 调度

### 7.1 dispatcher 集成位置（F004）

`scripts/kol-sync-daily.ts`：

```ts
const dispatcher = new KolSyncDispatcher([
  new YouTubeKolSyncAdapter(/* B6 已在 */),
  new ApifyKolSyncAdapter({
    baseUrl: process.env.APIFY_KOL_BASE_URL!,
    apiKey: process.env.APIFY_KOL_BUSINESS_API_KEY!,
    maxRequestsPerSecond: 5,
    maxItemsPerRun: 5000,
  }),
]);
await runDailySync(dispatcher);
```

`runDailySync` 既有循环每个 adapter，apify-kol 端故障时 youtube 单源继续，反之亦然（双源容灾）。

### 7.2 cron 行（用户手工待办）

`/etc/cron.d/kolmatrix-daily-sync`（与 BL-052 F003 kpi-snapshot:daily 同 cron 行）：

```
00:30 UTC tripplezhou cd /opt/kolmatrix && npm run kol-sync:daily && npm run kpi-snapshot:daily 2>&1 | logger -t kolmatrix-cron
```

apify-kol-service 自带 pg-boss + cron（5min 扫一次），独立运行不需 KOLMatrix 端 cron 干预。

### 7.3 prod redeploy 时机（5/14-15）

Stage 2 done + Reviewer signoff PASS → `gh workflow run deploy-prod.yml --ref main` → KOLMatrix prod 含 apify-kol adapter 接通。

apify-kol-service 端不动（已在 Stage 1 部署）。

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| TikHub balance 耗尽 → fork 端抓取静默停止 | apify-kol /kol 数据不更新 | apify-kol /admin/stats 月度监控 + KOLMatrix 端 cron 日志告警 + 用户每月续充 |
| fork 端 service 重启 → 502/503 | adapter 单次抓取失败 | dispatcher withRetry 已覆盖（30s/2min/5min）+ B6 youtube 单源继续 |
| fork 端字段增减 / camelCase 命名变更 | adapter 字段映射失效 | 集成测试覆盖（F003 case 3 验证字段映射），fork 改 schema 时 KOLMatrix 端有 CI red 告警 |
| KOLMatrix VM RAM 共生瓶颈 | apify-kol service 抢 RAM 影响 KOLMatrix | apify-kol-service docker container 限 mem 1GB（docker-compose mem_limit）；超 mem 触发监控 |
| port 3003 / 15432 端口冲突 | service 启动失败 | Stage 1 §4.2 端口选定时实地 `lsof -i :3003` / `:15432` 验空闲 |
| X 平台 fork 端业务读 API 未 expose | adapter 接入 X 失败 | 本批次先接 IG/TT/YT 三平台，X 待 fork 端 ready 后追加（不阻塞 5/13） |
| crawler-team.ts.todo 删除后 BL-027 等其他 spec 引用断 | 文档链接失效 | F005 同 commit grep `crawler-team.ts.todo` 全仓更新引用（如 BL-027 spec 引用此占位文件，更新为 `apify-kol.ts`） |

---

## 9. Acceptance 表（features.json F001-F007）

详 `features.json`。每条 acceptance 必须 Reviewer 逐项验收 PASS。Stage 1 ops 进度由 Planner 在 `progress.json.session_notes` 维护，不计入 features 评分。

---

## 10. 不在本批次（Out of Scope）

- apify-kol-service 端代码改动（fork 维护方负责）
- KOLMatrix 端 UI / Discovery 页面新增调用 apify 业务读 API（数据通过 sync 流入 Kol 表后既有 UI 自动可用）
- 4 平台 IG/TT/X 的 Discovery 抓取链路（apify-kol-service 自动处理）
- TikHub 商务约定 / 充值流程（爬虫团队负责）
- B6 YouTube adapter 改动（保持现状双源容灾）
- BL-013+ 后续可能涉及的 webhook / 准实时 push（apify-kol service 端 ready 后另起批次）

---

## 11. 完成判定（Definition of Done）

- [ ] Stage 1 §4.1-§4.6 全部 ✓（用户 + Planner ops 协作完成）
- [ ] features.json F001-F007 全部 status=completed
- [ ] L1 全套 PASS：lint 0 error + tsc 0 + 1084+ unit + targeted IT
- [ ] Reviewer signoff PASS（B+ 以上 / Readiness=Ready）
- [ ] prod redeploy 含 BL-012（5/14-15）
- [ ] `.auto-memory/project-status.md` 更新 BL-012 → DONE
- [ ] `.auto-memory/environment.md` secrets 表 +2 行（`APIFY_KOL_BASE_URL` / `APIFY_KOL_BUSINESS_API_KEY`）
- [ ] `docs/dev/kol-sync-runbook.md` 双 adapter 调度说明已加
