# BL-094-F002 · Upstream PR — apify_cost_usd 每请求成本估算

> **状态：** ✅ **PR 已开 → https://github.com/guang-tech/apify/pull/10**（2026-06-08，
> 分支 `bl094-f002-apify-cost-accounting` base `master@4d102f1`）。
> ⏳ **路径 B：待爬虫团队 review/merge → fork-sync `/opt/apify-kol-service` + rebuild（OOM NODE_OPTIONS=4096）。**
> ⚠️ **价格值是估算，建议爬虫团队用真实 TikHub 账单校准 `ENDPOINT_PRICES` 后再 merge。**

## 问题

`scrape_jobs.apify_cost_usd` 一直全 0（成本记账未接）→「预算→KOL」换算无数据支撑。

## 改动

| 文件 | 改动 |
|---|---|
| `packages/sdk/src/core/cost.ts`（新） | `ENDPOINT_PRICES` 每端点估算 + `priceForPath` + `recordRequestCost` + `runWithCostTracking`（AsyncLocalStorage scope）+ `currentCostUsd` |
| `packages/sdk/src/core/tikhub-client.ts` | `handleResponse` 成功分支调 `recordRequestCost(path)`（仅成功=计费）|
| `packages/sdk/src/index.ts` | 导出上述 cost API |
| `packages/service/src/jobs/scrape-worker.ts` | dispatch 包进 `runWithCostTracking`，各成功 update 写 `apifyCostUsd: currentCostUsd()` |
| `packages/sdk/tests/unit/cost.test.ts`（新） | 5 例：价格查表 / 累加 / scope 外 no-op / **并发隔离** |

**并发安全：** AsyncLocalStorage 按 job 归集，concurrent scrape job 各自计数不串。

## ⚠️ 价格是估算（关键）

价格首版由 `docs/runbooks/cost-estimation.md`（Apify-actor 期 per-operation，自带 ±30% 免责）
÷ ~100 item/batch 折算到每请求。**非真实 TikHub 每端点账单。** `ENDPOINT_PRICES` 是**唯一校准点**；
默认单价可 `TIKHUB_PRICE_DEFAULT_USD` env 覆盖。`apify_cost_usd` 定位=预算可视化，非会计级。

## 验证

- sdk 套件 54 绿 / service 套件 120 绿 / tsc 0（仅 client.test.ts 2 个 pre-existing 夹具错，非本 PR）。
- 部署后：新 scrape_jobs 行 `apify_cost_usd` 写入非 0。

## Sync 记录（待回填）

| 项 | 值 |
|---|---|
| 价格校准（真实 TikHub 单价） | _待爬虫团队/用户回填_ |
| 上游 merge commit | _待回填_ |
| sync 后 HEAD + rebuild | _待回填_ |
| 部署后 apify_cost_usd 抽样非 0 | _待回填_ |
