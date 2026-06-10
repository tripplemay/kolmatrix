# BL-108 爬虫暂停开关 — 监控页手动控制(主开关 + refresh 子开关)

> **Type：** 跨 repo 功能(爬虫 apify-kol-service upstream patch + kolmatrix /admin/crawler-monitor UI)。spec 硬性。
> **决策：** ADR-019(两层开关 + DB service_settings + gate 在入队源)
> **前序：** ADR-017(爬虫治理) · BL-086(refresh -85%) · BL-096/097(监控页本体 + 入口)
> **排期：** 插队 — BL-099 done 后**立即开**(用户决策 2026-06-09)，先于 split-brain 波次(BL-100~107)
> **证据：** 源码巡检 /opt/apify-kol-service(只读 SSH 2026-06-09)

## §1 现状(源码实证)

- Tiered auto-refresh `startRefreshScheduler`(`index.ts:117` 无条件启动 / `refresh-scheduler.ts:51` 入队 kind=refresh)**无任何开关**。
- 全部 scrape 成本入队点:`refresh-scheduler.ts:51`(refresh) · `index.ts:84`(cron scrape) · `index.ts:51`(yt-email) · `index.ts:61`(aggregator) · `admin-seeds.ts:48`(manual_seed) · `admin-jobs.ts:45/57/90`(手动 admin job)。
- 消费 worker:`registerScrapeWorker`(:97)/`registerYtEmailWorker`(:100)/`registerAggregatorWorker`(:111)。
- 已有 `requireAdmin`(plugins/auth) + Fastify admin 路由 + drizzle pgTable 模式;无 settings 表。
- kolmatrix 监控页 `/admin/crawler-monitor`(BL-096)已有 client + 读 `/admin/stats`;`APIFY_KOL_BASE_URL` + admin key 已配。

## §2 Features(爬虫先行 → kolmatrix UI → Codex)

> 爬虫端(F001/F002)走 BL-086-F001 同款 upstream-patch 流程:Generator 在 guang-tech/apify 写 patch + 测试 → PR → **用户 merge + 部署 /opt/apify-kol-service**(`docker compose up -d --build`)。L1 含爬虫端 `pnpm --filter @apify-kol/service test` 绿。

### F001 — 爬虫: service_settings 表 + repo + admin crawler-state API (generator, guang-tech/apify)
- 新建 `service_settings` 表(drizzle pgTable，单行：`scraping_enabled boolean default true` / `refresh_enabled boolean default true` / `updated_at` / `updated_by text`)。migration + seed 默认行。
- `SettingsRepo`：`getState()` / `setState({scraping_enabled?, refresh_enabled?, updatedBy})`(单行 upsert)。
- admin 路由(照搬 `admin-schedules.ts` `requireAdmin` 模式)：`GET /admin/crawler-state` → `{scrapingEnabled, refreshEnabled, updatedAt, updatedBy}`；`PATCH /admin/crawler-state {scrapingEnabled?, refreshEnabled?}`(zod 校验，写 repo + updatedBy)。
- 单测(repo upsert / API GET-PATCH / 默认值 true)。

### F002 — 爬虫: 各入队点 gate 两层开关 (generator, guang-tech/apify)
- **主开关 `scraping_enabled`=false → 跳过/拒绝**所有入队：
  - 自动调度(`refresh-scheduler` tick / cron scrape `index.ts:84` / yt-email enqueue `index.ts:51` / aggregator enqueue `index.ts:61`)：tick 内读标志，false 则 `return`(不入队、不报错)。
  - 手动 admin 入口(`admin-seeds.ts` manual_seed / `admin-jobs.ts` 手动 job)：false 则 `reply.code(409).send({error:'crawler_paused'})`，回明确消息(UI 可提示"爬虫已暂停，请先恢复")。manual_seed **受主开关管**(用户决策)。
  - 可选 worker backstop：scrape/yt-email/aggregator worker 处理前再查一次主开关(防漏网入队点)。
- **子开关 `refresh_enabled`=false → 仅 refresh-scheduler tick `return`**(其它抓取不受影响)。refresh-scheduler 实际 gate = `scraping_enabled && refresh_enabled`。
- 标志每 tick 读一次(SettingsRepo.getState，≤5min 生效)；已入队 job 自然 drain(不取消)。
- 单测(主开关 off→各入队点跳过/拒绝 / 子开关 off→仅 refresh 跳过 / 都 on→正常)。

### F003 — kolmatrix: 监控页 proxy + 状态装配 (generator, kolmatrix)
- server action/route 代理爬虫 `/admin/crawler-state`(GET 读 / PATCH 写，用 `APIFY_KOL_BASE_URL` + admin key，复用现有 client 模式)；错误优雅处理(爬虫不可达 → 状态未知态，不 500)。
- 状态装配供 UI：当前主/子开关态 + `updatedAt/updatedBy` + **暂停时长**(now - updatedAt，暂停中才算) + **积压过期 refresh 数**(查爬虫 `kols where next_refresh_at<=now()` count，经 /admin/stats 或新增只读字段) + **最近一次 refresh 时间**(scrape_jobs kind=refresh max createdAt)。
- 单测(proxy 读写 / 状态装配 / 爬虫不可达降级)。

### F004 — kolmatrix: 监控页两个 toggle UI + 确认 + audit + i18n (generator, kolmatrix)
- 监控页加两个 toggle：主「暂停所有爬虫抓取」+ 子「暂停 refresh」。**主 OFF 时子置灰**(已被覆盖)。显示 F003 装配的状态(暂停中 + 已暂停 X 天 + 积压数 + 最近 refresh)。
- 翻转前**确认弹窗**(讲清代价：主=全停抓取/子=存量指标冻结)；乐观 UI + 失败回滚 + toast。
- audit log(kolmatrix 侧记录谁翻的 + 目标态)。
- i18n 5 locale(zh/en/ja/ko/es)。
- 单测(toggle 调 action / 置灰逻辑 / 确认流 / admin-gated 非 admin 不显)。

### F005 — Codex L1+L2 + signoff (codex)
- L1：kolmatrix lint 0err warn≤3 / tsc=0 / npm test；爬虫 `pnpm --filter @apify-kol/service test` 绿。
- L2(爬虫 + kolmatrix 都部署后)：① 监控页翻主开关 OFF → 各类 scrape 入队停(观察 scrape_jobs 不再新增 / 成本停涨)，手动 manual_seed 投喂被拒(409) ② 翻 refresh 子开关 OFF(主 ON) → 仅 refresh 停、hashtag 发现等仍跑 ③ 状态显示准确(暂停时长/积压/最近 refresh) ④ 恢复主开关 → 抓取恢复、无 catch-up 尖峰(无积压) ⑤ admin-only。
- signoff `docs/test-reports/BL-108-signoff-2026-06-XX.md`。

## §3 风险与部署

- **跨两 repo + 爬虫需用户 merge/部署**：F001/F002 是 guang-tech/apify upstream patch(PR)→ 用户 merge → sync /opt + `docker compose up -d --build`(按 runbook，注意 3004:3003 端口 + 本地 docker 定制 stash/pop)。kolmatrix F003/F004 推 main + 用户部署。
- **顺序**：爬虫 API(F001/F002)先于 kolmatrix UI 的 L2 实测(契约先定)；F003 可与爬虫并行开发(按接口契约 mock)。
- **生效 ≤5min**(一个 tick)；已入队自然 drain。
- **默认 true**(不改变现有行为，纯增量)。
- ⚠️ 爬虫 patch 不积累本地分叉(路径 B)；kolmatrix 部署 OOM NODE_OPTIONS=4096。
