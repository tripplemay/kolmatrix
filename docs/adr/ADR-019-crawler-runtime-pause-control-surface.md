# ADR-019: 爬虫运行时暂停控制面 — 两层开关(主开关 + refresh 子开关)

## Status

**Accepted**

- 日期：2026-06-09
- 作者：Kimi (planner) + 用户
- 相关批次：BL-108（落地工单，本 ADR 同期产出）
- 前序：ADR-017（KOL 源策略 + 上游 apify-kol-service 抓取治理）· BL-086（refresh -85% via TIER_INTERVAL_MS）
- 证据：源码巡检 /opt/apify-kol-service（2026-06-09 只读 SSH）

## Context（背景）

用户在 /admin/crawler-monitor 观察到 refresh 持续消耗 TikHub/Apify 成本但 0 新增 KOL（refresh 职责是刷新存量指标，本就不产新 KOL）。希望能**手工暂停 refresh**，进而**手工暂停所有爬虫抓取**。

**源码实证：** 爬虫有两套调度，且 tiered auto-refresh 无任何开关：

| 机制 | 入队 | 现状 |
|---|---|---|
| Tiered auto-refresh（`startRefreshScheduler`，扫 `kols.next_refresh_at`） | `refresh-scheduler.ts:51` kind=refresh | **`index.ts:117` 无条件启动，无开关** |
| Cron schedules（`schedules` 表 + admin-schedules API） | `index.ts:84` | 已有 per-schedule `enabled` 标志 |

全部 scrape 成本入队点：refresh-scheduler（refresh）· cron scrape（index.ts:84）· yt-email（index.ts:51）· aggregator（index.ts:61）· manual_seed（admin-seeds.ts:48）· 手动 admin job（admin-jobs.ts:45/57/90）。消费 worker 3 个：scrape / yt-email / aggregator。

爬虫已有成熟 `requireAdmin` 鉴权 + Fastify admin 路由 + DB（drizzle pgTable）模式可照搬。无现成 settings/config 表。

## Decision（决策）

给爬虫加一个**运行时可控、UI 手动操作、无需重启/重部署**的暂停控制面，**两层开关**：

### D1 — 两层语义
- **主开关 `scraping_enabled`**（默认 true）：OFF = 暂停**所有**抓取入队（refresh + cron 发现 + yt-email + aggregator + manual_seed + 手动 admin job）。**含 manual_seed**（用户决策 2026-06-09：真·全停，投喂前须先恢复）。
- **子开关 `refresh_enabled`**（默认 true）：仅控 tiered auto-refresh。
- **层级：** 主 OFF ⊇ refresh OFF。UI 主开关关闭时 refresh 子开关置灰（已被覆盖）。

### D2 — 状态存储 = 爬虫 DB 单行 `service_settings`
新建 `service_settings`(单行 key-value 或定列：`scraping_enabled` / `refresh_enabled` / `updated_at` / `updated_by`)。理由：持久（重启不丢）、单一真相源、各调度器每 tick 读一次 → 翻转 **≤5min 生效**（用户接受）。**不用 env**（env 改要重启，违背 UI 手控初衷）。

### D3 — Gate 在「入队源」而非 worker（关键）
各调度器/入队点在 `boss.send` 前读标志、命中则跳过（自动调度）或拒绝并回明确消息（手动 admin 入口）。**暂停期间不产生新 job → 无积压 → 恢复无 catch-up 尖峰**（对比 gate 在 worker：job 堆积，恢复瞬间爆发）。已入队的 ≤1 batch **自然 drain**（用户决策 D3）。可选 worker 侧 backstop（防漏网入队点真跑 scrape）。

### D4 — 控制链路跨两 repo
```
监控页 UI 两 toggle ──► kolmatrix server action（proxy, APIFY_KOL_BASE_URL + admin key）
                              └──► 爬虫 admin API GET/PATCH /admin/crawler-state
                                        └──► service_settings ←每 tick 读── 各调度器 gate
```

### D5 — 边界
主开关只停**抓取写入**；爬虫**读 API 照常**（KOL 详情页拉数据、监控页自身、admin API 本身）。`docker` 不停 → 随时能从 UI 恢复。

### D6 — 陈旧权衡 = 转为可控可视
暂停 = 存量 KOL 指标（粉丝/互动/tier）冻结。开关把这变成**用户可控、可逆、可视**的选择：监控页显示「暂停中 + 已暂停 X 天 + 积压过期 refresh 数」，避免遗忘。用户选**全停**（不保 hot 档）。

## 被否方案

- **env 开关**：要重启生效，不能 UI 手控 → 否。
- **docker compose stop 整服务**：连读 API + admin API 一起停 → 无法 UI 恢复（鸡生蛋）、KOL 详情页断 → 否。
- **gate 在 worker（消费侧）**：触点少（3 worker）但 job 堆积、恢复尖峰 → 否（选 D3 入队侧）。
- **调 TIER_INTERVAL_MS 到无穷**：是代码改 + 不可逆 UI 控 + 仍有启动 tick → 否。

## Consequences（影响）

**正面：** 成本可一键止血；陈旧变可控可逆可视；爬虫获得通用运行时控制面（未来可扩 per-tier / per-platform 粒度 v2）。
**代价：** 跨两 repo（爬虫 upstream patch + kolmatrix UI）；爬虫 patch 需用户 merge + 部署；新增 DB 表 + 6 处入队 gate。
**可逆：** 开关本身即为可逆设计；service_settings 表与 gate 是纯增量，不删既有逻辑。
