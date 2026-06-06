# BL-091 YouTube 商务邮箱解锁链路修复 + 344 backfill

> **Type：** Bug 修复 + 数据补抓(spec 软性,但含跨仓设计决策故记录)
> **来源：** 2026-06-06 Planner 查证 `yt_email_check_records=0` 矛盾,实测定位两 bug + 小批 backfill 验证(kol 6/9 真实解锁)
> **关联：** 诊断报告 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` §3.4 · ADR-017 · backlog BL-091 并入本批
> **批次性质：** 跨仓库 —— Bug A/B 是爬虫代码(`guang-tech/apify`)走**路径 B**(PR→merge→sync);344 backfill 是我方 ops。**不依赖 TikHub 充值**(走 Apify,SCALE 已付费)

## §1 背景

"用 Apify 抓 YouTube KOL 商务邮箱"这条链路**代码完整、但一直是死的**:`yt_email_check_records=0`,Apify YT 邮箱 actor 从没被本服务调用过。现有 YouTube 邮箱(224)大头实为 **TikHub 内联**,非 Apify。实测定位两个 bug:

- **Bug A(触发器放错路径):** YT 邮箱解锁触发器只在 discovery 路径(`hashtag-scrape`/`manual-seed-scrape` 的 `applyPostProcessing`)里;但 `hasBusinessEmail=true` 由 **refresh 路径**写入(`refresh-scrape.ts` 明写"不抽联系方式",不调 `applyPostProcessing`)。两者永不相交 → `enqueueYtEmail` 从没被调用。526 个 youtube `hasBusinessEmail=true` 中 **344 个无邮箱**积压。
- **Bug B(追踪表双写失效):** 小批验证发现 3 任务 completed、2 邮箱写进 `kols.emails`,但 `yt_email_check_records` 仍 0 行 → `markRunning/markSucceeded` 没落库 → 去重失效(每次重复跑 Apify 烧钱)+ 无审计。

价值:补抓 344 个 TikHub 标了"有商务邮箱"但没给地址的 YouTube 频道(Apify 正是补 TikHub 缺口),小批 2/3 成功率 → 预期多解锁 ~200+ 可触达邮箱。

## §2 关键约束

1. **Bug A/B 是爬虫代码,走路径 B**(PR 到 `guang-tech/apify` → 爬虫团队 review/merge → fork-sync /opt rebuild),不加本地 patch。
2. **铁律 #9**:Generator 实装,Planner 仅出方案。
3. **344 backfill 是 ops**,走 Apify(不依赖 TikHub 充值),可先做(已验证机制可用)。
4. ⚠️ **OOM 风险(BL-086 遗留)**:prod deploy build 曾 OOM 拖垮整机;本批若触发 /opt rebuild,须按恢复 runbook 谨慎,内存未根治前评估风险。

## §3 设计要点(Bug A 修法需爬虫团队确认)

`refresh-scrape.ts` 故意"不抽联系方式"很可能是**成本决策**(refresh 高频,每次触发 Apify 会爆炸)。**正确修法不是"refresh 每次都触发"**,而是:
- 在 `hasBusinessEmail` 由 false→true(或首次置 true 且当前无邮箱)时触发**一次**,配合修好的 `yt_email_check_records` 去重(Bug B)避免重复。
- 与爬虫团队对齐:触发点放哪、去重窗口(现有 `YT_EMAIL_CACHE_WINDOW_MS` 6 个月)是否沿用。

## §4 Features

### F001 — Bug A:YT 邮箱触发器接入正确路径(爬虫,路径 B)
- 让 `hasBusinessEmail` false→true 的频道能触发 `enqueueYtEmail`(refresh 路径或专门的 transition 检测),配合去重,避免每次 refresh 都触发。
- PR 到 `guang-tech/apify`;含单测;不破坏 refresh 既有行为(刷新仍不无谓抽联系方式)。
- 验证:改后新 refresh 命中 `hasBusinessEmail=true` 且无邮箱的频道 → 入队 yt-email(`yt_email_check_records` 出现 queued/running)。

### F002 — Bug B:`yt_email_check_records` 双写修复(爬虫,路径 B)
- 排查 `markRunning/attachRun/markSucceeded/markNoEmail` 为何不落库(事务/连接/异常吞掉),修复使其可靠写入。
- 修后:每个 yt-email 任务都留下记录(queued→running→succeeded/no_email),去重生效(已查过的不重复跑 Apify)。
- PR 到 `guang-tech/apify`;含单测。

### F003 — 344 backfill(我方 ops,不依赖充值)
- 脚本对 344 个 youtube(`has_business_email=true` 且 `emails` 无 `@`)入队 `yt-email`(pg-boss,schema=pgboss,batchSize=1 worker 自然消费)。
- **自带幂等**:本地记录已处理 kolId(规避 Bug B 期间去重失效导致中断重跑重复);限速,分批。
- 走 Apify(SCALE 已付费),~$0.12/次 × 344 ≈ $41。
- 验证:跑后抽样确认 `kols.emails` 新增真邮箱;统计成功/NO_EMAIL/失败数。
- 已小批验证(kol 6/9 解锁)。可在 Bug A/B merge 前先做(立即价值)。

### F004 — Codex L1+L2 + signoff（executor:codex）
- L1:F001/F002 PR 已 merge+sync;脚本单测绿;kolmatrix 侧若有改动 lint/tsc/test 绿。
- L2:Bug A 触发链路实测(新触发产出记录);Bug B 记录可靠落库 + 去重生效;F003 backfill 后 `kols.emails` 真实新增 + 量化(解锁数/成功率)。
- signoff `docs/test-reports/BL-091-signoff-2026-06-XX.md`。

## §5 风险

- 路径 B 依赖爬虫团队 merge(F001/F002),有排期。F003 可先行不阻塞。
- Bug A 修法若放 refresh 路径不当 → Apify 成本风险(故必须 transition + 去重)。
- /opt rebuild 触发 OOM(BL-086 遗留),部署谨慎。
