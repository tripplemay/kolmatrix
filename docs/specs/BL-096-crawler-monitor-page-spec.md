# BL-096 爬虫抓取监控页(只读观测 dashboard)

> **Type：** 新功能(只读可观测面板)。spec 硬性。跨仓:爬虫 `/admin/stats` 扩展(路径 B)+ KOLMatrix admin 页(瘦客户端)
> **来源：** 2026-06-08 用户 — 把人肉拉快照的抓取行为做成常驻页面
> **关联：** BL-086 F004(`/admin/stats` 已暴露 tikhubBalanceUsd)· BL-089(配置页,deferred — 本页是只读监控半边, 将来可合 console)· BL-095(IG 0产出)· ADR-017

## §1 背景与动机

爬虫已发生两次**静默故障**(TikHub 余额耗尽空转 6/04、aigcgateway 额度耗尽),均靠人肉发现。**持续可观测页面比事后告警更早暴露问题**。把 Planner 手动拉的抓取快照(drain/速率/邮箱/IG/余额/成本)做成 platform-admin 常驻面板。

**与 BL-089 区分:** 本页 = **只读观测**;BL-089 = 写/控制(改策略)。先做只读监控(高价值低风险),将来可合成 admin console(监控 tab + 配置 tab)。

## §2 架构(沿用 /admin/apify-preview 模式 + ADR-017 瘦客户端原则)

- **数据归爬虫**:扩 `/admin/stats`(已存在,BL-086 F004)返回观测指标。**KOLMatrix 不直读爬虫库**,只调 API 渲染。
- **页面在 KOLMatrix**:新页 `/[locale]/admin/crawler-monitor`,platform-admin gate(`isAdminRole`),仿 `/admin/apify-preview`(server component fetch + 卡片 + recharts 曲线 + i18n)。
- scope = **平台级**(爬虫池无 tenant 维度),非租户级。

## §3 Features

### F001 — 爬虫 `/admin/stats` 扩展观测指标(generator,路径 B)
扩 `packages/service/src/routes/admin-stats.ts` 返回(只读聚合,apify_kol DB):
- **drain**:manual_seed pgboss job state(queued/active/completed)+ 今日 manual_seed inserted。
- **入库速率**:kols 按天新增(最近 7-14 天数组)。
- **抓取构成**:今日 scrape_jobs by kind(jobs/scraped/inserted/cost)。
- **YT 邮箱**:yt_email_check_records by status(succeeded/queued/failed/no_email)。
- **IG 产出**:今日 instagram scraped/inserted(盯 BL-095)。
- **refresh 欠账**:kols total + due_now。
- **成本/余额**:今日 apify_cost_usd 合计 + tikhubBalanceUsd(已有)。
- 走路径 B(PR → guang-tech/apify → merge → fork-sync /opt rebuild,NODE_OPTIONS=4096 防 OOM);含单测。

### F002 — KOLMatrix `/admin/crawler-monitor` 只读监控页(generator,kolmatrix)
- server component:`isAdminRole` gate(非 admin redirect);fetch 爬虫 `/admin/stats`(server-only client,仿 `src/lib/admin/apify-preview-client.ts`,超时/错误处理)。
- 渲染:入库速率曲线(recharts)+ 抓取构成卡 + YT 邮箱状态卡 + drain 进度条 + refresh 欠账 + 双余额(TikHub/Apify)。
- **健康灯**:inserted=0 连续/余额低/IG 0 → 红/黄灯(把告警可视化)。
- i18n:`admin.crawlerMonitor` 5 locale keys。fetch 失败优雅降级(error banner)。
- L1 全绿。

### F003 — Codex L1+L2 + signoff(codex)
- L1:F001 PR merge+sync + 单测;F002 lint/tsc/test + i18n 5 locale 一致。
- L2:部署后 `/admin/crawler-monitor` prod 渲染真实数据(drain/速率/邮箱/IG/余额/成本)+ 健康灯逻辑正确 + admin gate 生效(非 admin 拒)。
- signoff `docs/test-reports/BL-096-signoff-2026-06-XX.md`。

## §4 风险

- F002 依赖 F001 部署(/admin/stats 扩展后才有新字段)→ F002 可先按契约开发 + 对缺字段优雅降级,F001 sync 后联调。
- 路径 B 依赖爬虫团队 merge F001。⚠️ /opt + kolmatrix 部署 OOM(NODE_OPTIONS=4096)。
- 只读页,无写风险;但 `/admin/stats` 暴露余额/成本 = 敏感运营数据,确认仅 platform-admin 可见。
