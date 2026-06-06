# BL-091-F001 · Upstream PR — YT email 触发器接入 refresh 路径(Bug A)

> **状态：** ✅ **PR 已开 → https://github.com/guang-tech/apify/pull/6**（2026-06-07，
> `tripplemay` write 权限，分支 `bl091-f001-yt-email-trigger` base `master@8f9320a`）。
> **待爬虫团队 review + merge → sync `/opt/apify-kol-service` + `docker compose up -d --build`。**

## 问题(Bug A)

`enqueueYtEmail` 触发器只挂在 discovery 路径(hashtag/manual-seed 的 `applyPostProcessing`)；
但 `hasBusinessEmail=true` 信号由 **refresh 路径**写入(`refresh-scrape.ts` 故意不调
`applyPostProcessing` — 不抽联系方式，成本决策)。两者永不相交 → `enqueueYtEmail`
**从没被调用过**，`yt_email_check_records=0`，约 344 个 youtube 无邮箱积压。

## 改动

| 文件 | 改动 |
|---|---|
| `packages/service/src/pipeline/refresh-scrape.ts` | `RefreshScrapeDeps` 加可选 `enqueueYtEmail`；youtube 分支 upsert 前读旧 `hasBusinessEmail`，仅 false/null→true 跃迁触发一次 |
| `packages/service/tests/unit/refresh-scrape-yt-email.test.ts` | 新增 6 例回归 |

- 不改 refresh "不抽联系方式" 的成本决策；只在信号跃迁时触发一次解锁。
- 入队后去重(6 月窗口 / 无 email)由 `enqueueYtEmail` 闭包配合 `yt_email_check_records`(Bug B)负责。
- `scrape-worker` refresh 调用已透传完整 deps，自动获得 `enqueueYtEmail`，无改动。

## 验证

- service 单测全绿：15 files / 106 tests（base `8f9320a`）。
- tsc：仅 3 个 **pre-existing** `SCRAPE_MIN_INTERVAL_MS` 测试夹具错误(BL-086-F005 遗留，非本 PR 引入)。

## Sync 记录（待回填）

| 项 | 值 |
|---|---|
| 上游 merge commit | _待爬虫团队回填_ |
| `/opt/apify-kol-service` sync 后 HEAD | _待回填_ |
| 生效验证 | refresh 命中 hasBusinessEmail 跃迁 → yt_email_check_records 出现 queued/running |
