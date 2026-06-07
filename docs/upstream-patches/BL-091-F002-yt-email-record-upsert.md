# BL-091-F002 · Upstream PR — yt_email_check_records 双写失效修复(Bug B)

> **状态：** ✅ **PR #7 已 merge → master `4cc9421`**（2026-06-07，用户授权直接 merge，squash）。
> ⏳ **待 `/opt/apify-kol-service` rebuild 才生效（OOM 谨慎）。** 注：F003 backfill 先建 queued 行，
> 故当前未 rebuild 的 worker 已能正确落库；本修复让所有入队路径（含 Bug A 触发）都健壮。

## 问题(Bug B)

worker 的 `markRunning/attachRun/markSucceeded/markNoEmail` 全是 `UPDATE ... WHERE kol_id`。
原假设入队侧 `upsertQueued` 已建行，但任何**未经 upsertQueued 直达 worker** 的任务
(直接 `boss.send` / 重放 / 早期手测)都没有行 → 这些 UPDATE 命中 0 行**静默无效** →
`yt_email_check_records` 始终 0 行、去重失效(`enqueueYtEmail` 闭包靠该表判已查过，
无行 → 每次重复跑 Apify 烧钱)；邮箱却照常写进 `kols.emails`(独立写)。
正是小批验证 "3 任务 completed / 2 邮箱入库但记录 0 行" 的现象。

## 改动

| 文件 | 改动 |
|---|---|
| `packages/service/src/repos/yt-email-record-repo.ts` | `markRunning(kolId, channelId)` 改 `INSERT ... ON CONFLICT (kol_id) DO UPDATE`，保证行存在 |
| `packages/service/src/jobs/yt-email-worker.ts` | 调用点透传 `channelId` |
| `packages/service/tests/unit/yt-email-worker.test.ts` | 新增 4 例(调用契约) |
| `packages/service/tests/integration/yt-email-record-repo.test.ts` | 新增 5 例(真实 PG，SQL 落库) |

## 验证

- 单测全绿：15 files / 104 tests。
- **集成测（testcontainers/colima 真实 PG）全绿 5/5**：空表 markRunning 直接建行(旧实现 0 行)、
  完整 transition 落库、NO_EMAIL、markFailed 累计、去重命中。
- tsc：仅 3 个 pre-existing `SCRAPE_MIN_INTERVAL_MS` 夹具错误(非本 PR)。

## 关系

- 与 F001(Bug A，PR #6)配套：F001 触发后必须有 F002 保证记录可靠落库，去重才生效。
- F003 backfill(PR #8)自带 upsertQueued 先建行，故 F002 未部署前也能让当前 worker 留记录。

## Sync 记录（待回填）

| 项 | 值 |
|---|---|
| 上游 merge commit | **4cc9421 (#7)** → master HEAD `f1d1bb7` |
| sync 后 HEAD | _待 rebuild 回填_ |
| 生效验证 | backfill/触发后 yt_email_check_records 行数 > 0 且状态正确（实跑已见 succeeded/failed 落库）|
