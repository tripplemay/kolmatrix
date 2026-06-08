# BL-092 充值后执行 + 真实速率验证

> **Type：** 充值后执行/验证(ops + verified-live),收口 BL-086/091/094 的"等 TikHub 充值"deferred 部分。spec 软性
> **触发：** 2026-06-08 TikHub `71@qq.com` 充值到账($244.71,付费端点 200,爬虫已恢复抓取)
> **关联：** BL-086 F006 充值后半段 · BL-091 F001 runtime 触发 · BL-094 F002 /opt rebuild + apify_cost_usd · ADR-017

## §1 背景

TikHub 余额耗尽期(6/04–6/08)多项验证/执行被 defer 到充值后。现已充值($244.71),爬虫恢复(11:01 scrape 66)。本批一次性收口:
- 部署 BL-094 F002 成本记账(`/opt` 现 `4d102f1` < master `8d7cff8`)。
- 投喂 2535 旧源 youtube id(BL-086 F003 真实 feed)。
- 验证所有"需真实流量"的 deferred 项(refresh 负载降 / 新增回升 / IG 恢复 / 告警 / BL-091 Bug A runtime 触发 / 成本记账非0)。

## §2 Features

### F001 — /opt rebuild 部署成本记账 + 确认爬虫恢复(generator)
- fork-sync `/opt/apify-kol-service` `4d102f1` → master `8d7cff8`(含 BL-094 F002 apify_cost_usd;tier 积累档 + 邮箱触发已在更早 commit)。**⚠️ rebuild 用 NODE_OPTIONS=4096 防 OOM**(BL-086 遗留)。
- 确认爬虫恢复抓取(TikHub $244.71,端点 200);scrape_jobs 新行 scraped>0。
- 记录 sync 后 HEAD + 本地 patch 数(期望 0)。

### F002 — 投喂 2535 旧源 youtube id(generator,ops)
- 跑 `scripts/bl086-manual-seed-harvest`(**non-dry-run**)投喂 2535 个旧源 youtube UC id(manual_seed,命中率 96%)。
- 监控:入队 scrape_jobs(kind=manual_seed)→ 消费 → 新 KOL 入库(inserted>0)。幂等/可重入。
- 注意:充值后 worker 不再消费成 succeeded-0;真实入库。

### F003 — verified-live 验收 + signoff(codex)
全部需真实流量的 deferred 项(L2 实测):
- **BL-086**:refresh 日负载实测降(TIER_INTERVAL_MS 14/30/30 → 944→~123)+ 新 KOL 入库速率较 ~87/天 回升 + discovery 占比上升。
- **BL-086 F002**:扩种子(SEA/手游)开始产出 + 砍空转 IG 后无浪费。
- **BL-091 F001**:Bug A runtime 触发链路实测(refresh 命中 hasBusinessEmail false→true → 入队 yt-email → 新 record)。
- **BL-094 F002**:`scrape_jobs.apify_cost_usd` 写入非 0(成本记账生效)。
- **BL-086 F004**:静默空转告警在正常运转时不误报。
- before/after 量化(refresh 负载 / 日新增 / discovery 占比 / 成本)。
- signoff `docs/test-reports/BL-092-signoff-2026-06-XX.md`。

## §3 风险

- ⚠️ /opt rebuild OOM(NODE_OPTIONS=4096 已验可缓解,F001 必用)。
- F002 投喂 + 真实抓取消耗 TikHub 余额($244.71,2535 manual_seed + 日常 refresh/discovery,留意消耗速率;BL-086 F004 告警 + BL-094 成本记账已上可观测)。
- F003 部分指标需运转数日才稳定(refresh 负载、日新增曲线);可分阶段验,首轮验"已生效/趋势对"即可 signoff,长期趋势留观察。
