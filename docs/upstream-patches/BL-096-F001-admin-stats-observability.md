# BL-096-F001 · Upstream PR — /admin/stats 扩展只读观测指标

> **状态：** ✅ **PR 已开 → https://github.com/guang-tech/apify/pull/11**（2026-06-08，
> 分支 `bl096-f001-admin-stats-observability` base `master@8d7cff8`）。
> ⏳ **路径 B：待爬虫团队 review/merge → fork-sync `/opt/apify-kol-service` + rebuild（NODE_OPTIONS=4096 防 OOM）。**

## 目的

给 KOLMatrix `/admin/crawler-monitor`（F002）供数据（ADR-017 瘦客户端：数据归爬虫）。

## 改动（`packages/service/src/routes/admin-stats.ts`）

`/admin/stats`（platform-admin gate 不变）新增只读聚合字段：

| 字段 | 内容 |
|---|---|
| `drain` | scrape pg-boss 队列 by state + manual_seed 7d by status + 今日入库 |
| `ingestRateByDay` | kols 按天新增（14d）|
| `scrapeCompositionToday` | 今日 by kind（jobs/scraped/inserted/cost）|
| `ytEmailByStatus` | yt_email_check_records by status |
| `igToday` | 今日 instagram scraped/inserted（盯 BL-095）|
| `refreshBacklog` | kols total + due_now |
| `costTodayUsd` | 今日 apify_cost_usd 合计 |

既有字段全保留（向后兼容）。抽离 `computeAdminStats`（与 fastify/鉴权解耦）便于单测。

## 验证

- 单测 `admin-stats.test.ts`（2）；service 套件 122 绿；tsc 0。
- prod 实查（read-only）pgboss/scrape_jobs 查询有效。

## 配套 / Sync 记录（待回填）

| 项 | 值 |
|---|---|
| 上游 merge commit | _待回填_ |
| sync 后 HEAD + rebuild | _待回填_ |
| KOLMatrix env `APIFY_KOL_ADMIN_API_KEY` 落地（F002 需，调 /admin/stats）| _待回填(ops)_ |
| 部署后 /admin/crawler-monitor 渲染真实数据 | _待 F001 sync + F002 部署后联调_ |
