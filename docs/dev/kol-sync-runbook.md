# KOL Sync Runbook

**Owner:** KOLMatrix backend / Generator agent.  
**Spec:** `docs/specs/BL-059-youtube-deprecate-and-engagement-derive-spec.md`
(post-deprecate; legacy `docs/archive/B6-kol-daily-sync-spec.md` retained
for audit only).  
**On-call entry point:** `/var/log/kolmatrix-kol-sync.log` on prod.

This is the day-to-day operational guide for the daily apify-kol
sync cron (single-source since BL-059, 5/9). For architectural
background see the spec; this doc is strictly "what does each alert
mean and what do I do about it".

---

## Where things live

| Path | Purpose |
|---|---|
| `/etc/cron.d/kolmatrix-kol-sync` | crontab entry — fires at 00:30 UTC = 08:30 BJ daily |
| `/etc/logrotate.d/kolmatrix-kol-sync` | 30-day daily rotation, gzip after delaycompress |
| `/var/log/kolmatrix-kol-sync.log` | structured JSON, one line per run |
| `/opt/kolmatrix/docs/test-reports/kol-sync-daily-{YYYY-MM-DD}.md` | per-run markdown summary |
| `scripts/kol-sync-daily.ts` | the binary the cron invokes |
| `src/lib/kol-sync/` | adapter dispatcher + retry + log classifier |

The structured log is the source of truth for alerting. Markdown reports
are for humans skimming; never depend on them programmatically.

---

## Reading the structured log

Each line is a single JSON object:

```json
{
  "timestamp": "2026-04-29T00:30:01.041Z",
  "endedAt":   "2026-04-29T00:30:47.892Z",
  "durationMs": 46851,
  "level": "INFO",
  "adapters": [{ "name": "apify-kol", "healthy": true }],
  "discoverCount": 47,
  "refreshCount": 0,
  "inserted": 35,
  "updated": 12,
  "skipped": 0,
  "dedupeSkipped": 0,
  "estimatedQuotaConsumed": 1815,
  "estimatedQuotaRemaining": 8185,
  "errors": [],
  "zeroDiscoverStreakBefore": 0,
  "alerts": []
}
```

Quick triage:

```bash
# Most recent run
tail -1 /var/log/kolmatrix-kol-sync.log | jq

# Anything not INFO in the last 7 days
tail -200 /var/log/kolmatrix-kol-sync.log | jq 'select(.level != "INFO")'

# Yesterday's discover count
tail -1 /var/log/kolmatrix-kol-sync.log | jq .discoverCount
```

---

## Alert thresholds

| Trigger | Level | What it means | First-pass action |
|---|---|---|---|
| `estimatedQuotaConsumed > 100` | WARN | apify-kol pagination is iterating much harder than usual. Steady-state is single-digit units (1u healthCheck + ~1u per /kol page); >100 means many short-page rescans or runaway. | Check `errors[]` and inspect the markdown report; if scoreScore filter is letting too few rows through, may need to revisit the apify-kol double-low threshold. |
| `discoverCount === 0` | WARN | Today's run found 0 new KOL (after dedupe). Could be apify-kol-service down, scrape quota at the fork end, or low-volume hashtag schedules. | Look at `errors`. SSH the prod host and `curl -fsS http://localhost:3003/health` on the fork. Re-run manually with `npm run kol-sync:daily` and observe. |
| `discoverCount === 0` for 3 days running | **ALERT** | Single-source apify-kol likely broken, or fork TikHub balance exhausted. | Page on-call. SSH `/opt/apify-kol-service` and `sudo docker compose ps` + `sudo docker compose logs --tail 200`. Check fork `/admin/stats` for paid balance. 30-day soft-delete window means the youtube-api-daily fallback can be restored via SQL §3.3 in BL-059 spec. |
| `errors.length > 0` | WARN | At least one adapter call exhausted retries. | Read each error string in `errors[]`. Most are transient — re-run manually if budget allows. |
| `durationMs > 300000` (5 min) | WARN | Run took longer than the rotation budget. Almost always a sign of network slowness on the VPS or a 429 retry-storm. | Re-run; if it persists, check `free -m` and `iostat 1` on the VPS. |

The streak counter (`zeroDiscoverStreakBefore`) is computed from the
log itself — `countTrailingZeroDiscoverStreak()` walks backwards
through the file. A malformed line resets the streak to 0, so log
corruption fails closed (we don't accidentally silence the ALERT).

---

## Manual operations

### Run on demand (live, prod-only)

Cheap (single-digit units) since apify-kol-service hosts the heavy
scrape work — KOLMatrix only paginates GET /kol.

```bash
ssh tripplezhou@<prod-host>
cd /opt/kolmatrix
npm run kol-sync:daily
tail -1 /var/log/kolmatrix-kol-sync.log | jq
```

### Dry-run to validate config

Free, no API calls.

```bash
npm run kol-sync:daily:dry
```

> **BL-059:** the legacy `--no-refresh` and `--refresh-batch` flags
> are accepted but ignored — the refresh phase was tied to the
> YouTube tiered selector and was removed with the deprecate. Old
> cron lines passing them keep working without change.

### Revoke the cron temporarily

```bash
sudo mv /etc/cron.d/kolmatrix-kol-sync /etc/cron.d/kolmatrix-kol-sync.disabled
# … investigate …
sudo mv /etc/cron.d/kolmatrix-kol-sync.disabled /etc/cron.d/kolmatrix-kol-sync
```

---

## Common false alarms

- **First two days after deploy** the structured log is short, so the
  ALERT streak counter can't yet trigger. WARN-level zeroDiscover for
  a single day is not actionable.
- **apify-kol-service container restart:** if cron fires while
  `docker compose up -d --build` is rebuilding (e.g. a mid-day fork
  sync), the first request can get a 503. The retry layer's
  30s/2min/5min schedule absorbs this transparently — it shows up as
  `errors[0]` even though the run succeeded later.
- **`refreshCount` always 0 since BL-059** — refresh phase was
  removed with the YouTube deprecate. `inserted + updated` come
  entirely from discover.

---

## When to escalate

Go straight to the user (no automated paging in B6 — Sentry/Slack is
BL-013 territory):

- `level = ALERT`
- 3+ consecutive runs with `errors.length > 0`
- API key invalidation: `errors[0]` contains `auth rejected (HTTP 401)`
  or `(HTTP 403)` — `APIFY_KOL_BUSINESS_API_KEY` mismatch with the
  fork's `BUSINESS_API_KEY`
- 30-day soft-delete window (BL-059) approaching expiry without
  clear apify-kol data quality signal — block on user decision
  before any hard delete

---

## apify-kol 单源 + cron schedules + 30 天 soft delete 回滚（BL-059）

自 `BL-059` (5/9) 起，daily cron 仅跑 **single adapter** —
apify-kol-service（`source: 'apify-kol'`，guang-tech/apify fork 部署
在同 VM `localhost:3003`）。`scripts/kol-sync-daily.ts` 中
`YouTubeKolSyncAdapter` 注入 + engagement-batch + tiered refresh phase
全部移除；`src/lib/kol-sync/adapters/youtube.ts` + `engagement-batch*.ts`
+ `published-after.ts` 已 git rm。

| 维度 | apify-kol（唯一 adapter） |
|---|---|
| 类名 | `ApifyKolSyncAdapter` |
| 文件 | `src/lib/kol-sync/adapters/apify-kol.ts` |
| `metadata.source` | `apify-kol` |
| 上游 | apify-kol-service（同 VM port 3003） |
| 平台覆盖 | Instagram / TikTok / YouTube（X 平台 SDK 已接但 service 端 route 未实装，BL-058 跟踪）|
| Refresh phase | **不跑**（BL-059 deprecate 时一并移除，30 天可回滚双源时再决策）|
| 质量过滤 | 通用 spam/zombie/NSFW 规则 + apify-kol 专属：`relevance < 0.2 && influence < 0.2` 双低 → skip（`quality.ts`）|
| `engagement_rate` | `mapApifyKolItemToRawKolData` derive：`(totalLikes / postsCount) / followers * 100`（BL-059-F001 简化公式，缺 totalComments）|
| Cron 时间 | 00:30 UTC（fork 端 30 hashtag schedules 覆盖 IG/TT/YT，详 fork `/admin/stats`）|

**单源风险与缓解：**
- apify-kol-service 故障 → 当日 daily run 仍完成 healthCheck 阶段并写
  `level: ALERT`（`anyHealthy === false` bail 早退），下游业务面 KOL
  数量本日不增长但既有 KOL 不受影响
- 30 天 soft delete 窗口（5/9 → 6/8）内可执行 BL-059 spec §3.3 SQL
  恢复 youtube-api-daily 数据 + git revert 恢复 youtube.ts 双源容灾
  （应急回滚铁律 #9 hotfix 流程）
- 长期质量监控走 BL-058（4 维度评分稳定性 + 主流程 UI 默认过滤）

**`metadata.source` 隔离铁律（BL-012 spec §4.5.4 + BL-059 沿用）：**
- apify-kol 数据 4 维度评分阈值未达稳定阶段，主流程 UI 层 **不加默认过滤**，
  但 SQL 清理 / 业务方反馈次质量数据时可按 `metadata.source = 'apify-kol'`
  单源回滚
- soft-deleted youtube-api-daily 行（5/9 起）保留于表中含完整 audit_log，
  6/8 后用户决议硬删 vs 永久 soft delete 保留

---

## apify-kol-service fork 同步流程（5/7 fork @ guang-tech/apify，2026-05-09 lock）

apify-kol-service 是独立部署的 Node 服务，KOLMatrix 通过 HTTP 集成。
fork 仓库 path（同 VM）：`/opt/apify-kol-service`。本 §仅覆盖 KOLMatrix
侧 ops，fork 内部架构由爬虫团队维护。

### 1. 同步前兼容性 check（fork 端有 push 时执行）

```bash
ssh tripplezhou@34.180.93.185
cd /opt/apify-kol-service
gh api repos/guang-tech/apify/commits --jq '.[0].sha,.[0].commit.message'
git log -1 --format='%H %s'
# 比较 fork master HEAD 与 local HEAD 之间的 commits
```

逐项审查 fork 端 push 是否影响以下 5 个 sed workaround / KOLMatrix 集成点：

1. **business read API path**：`GET /kol` + `GET /kol/:platform/:userId` + `GET /health` 是否仍存在 / 仍兼容（`src/lib/apify-kol/schemas.ts` 的 zod schema 是 KOLMatrix 侧契约，fork 端字段增加 OK，删除 / 改名 = breaking）
2. **response shape**：`externalUrls` / `aggregatorLinks` 的 union shape（详 v0.9.19 framework sediment）— 新行 shape 出现时必须先在 schemas.ts 加测试再同步
3. **env vars**：`BUSINESS_API_KEY` / `ADMIN_API_KEY` / `TIKHUB_TOKEN` / `DATABASE_URL` 是否新增字段
4. **platform enum**：`["instagram", "tiktok", "youtube", "x"]` 是否新增（X service 端实装 = BL-058 后续）
5. **sed workaround 失效信号**：`Dockerfile` 是否仍 `pnpm install --frozen-lockfile`（应改 `--no-frozen-lockfile`）；`docker-compose.yml` 是否仍 `3000:3000`（应改 `3003:3000`）

如任一项变化 → 提案改动 + 通知用户 → 用户 ack 后再同步。**未 ack 不得直接 reset --hard**。

### 2. 同步执行（B 方案 — reset + 重 apply workaround）

```bash
cd /opt/apify-kol-service
git fetch origin master
git reset --hard origin/master
# 重 apply 2 sed workaround
sed -i 's/pnpm install --frozen-lockfile/pnpm install --no-frozen-lockfile/' Dockerfile
sed -i 's/3000:3000/3003:3000/' docker-compose.yml
sudo docker compose down       # 不带 -v，pg_data volume 保留
sudo docker compose up -d --build
# Smoke 验证（host port 3003）
curl -fsS http://localhost:3003/health | jq
```

### 3. 数据保留说明

- **保留：** `pg_data` docker volume（KOL profile + 运行历史）/ 容器外 `.env` 文件 / `/opt/apify-kol-service/storage` (apify SDK kvs)
- **重置：** docker image（rebuild 拉新代码）/ 容器内 `/app` 工作目录
- **千万别带 `-v`：** `docker compose down -v` 会删 pg_data volume，全量数据丢失。本流程的 `down` **不带 `-v`**。

### 4. 长期 todo（待爬虫团队修 fork）

| 当前 workaround | 失效信号（爬虫团队修复后） |
|---|---|
| `Dockerfile --no-frozen-lockfile` | fork 端 `pnpm-lock.yaml` 与 package.json 一致后可去除 |
| `docker-compose.yml 3003:3000` | fork 端默认 port 改 3003 后可去除 |
| KOLMatrix `apify-kol` adapter zod schema 兼容 union shape | fork 端 docs 明示 `externalUrls` / `aggregatorLinks` shape 后可收紧 |
| `platform: 'x'` 不入 dispatcher | fork 端 X service 端 route 实装后可加（BL-058 触发条件之一）|

### 5. KOLMatrix 侧必备 env（部署到 `/opt/kolmatrix/.env.production` + `/opt/kolmatrix-staging/.env.staging`）

```bash
APIFY_KOL_BASE_URL=http://localhost:3003
APIFY_KOL_BUSINESS_API_KEY=<同 fork 端 .env BUSINESS_API_KEY>
```

**BL-059 后单源依赖：** 任一 env var 缺失即 fail-fast（exit 0 with
ALERT log），daily run 不再 silent-skip。首次 deploy 必须配齐两 env，
配齐方法见 `.auto-memory/environment.md` "VPS env 文件当前 secrets 状态"
段表格。
