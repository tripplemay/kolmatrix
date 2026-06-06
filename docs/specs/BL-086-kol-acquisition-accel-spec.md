# BL-086 KOL 抓取加速批次（accumulation mode）

> **Type：** Data infra / 上游抓取治理（提升新 KOL 入库速率）
> **来源：** 2026-06-06 Planner prod 只读诊断 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` + 用户产品决策
> **关联：** ADR-017（源策略 + 上游抓取治理）· backlog BL-086/BL-087 并入本批次 · BL-088/BL-089 留 backlog
> **批次性质：** 跨仓库（kolmatrix + `guang-tech/apify`）+ 部分 ops/config；多数代码走**路径 B（上游 PR → merge → sync）**

## §1 背景与目标

诊断结论:apify 新 KOL 贡献慢的根因是 **(a) TikHub 余额耗尽(约 6/04 起静默空转)** + **(b) refresh:discovery 预算配比失衡**——`TIER_INTERVAL_MS`(hot 1d/warm 3d/cold 7d)使 refresh 占 ~90% 抓取量却产 0 新增,discovery 只分到 ~10%。上游 `apify-kol-service` 是我方自有(docker，`guang-tech/apify`)。

**目标:把"积累模式"的抓取策略部署到位,确保 TikHub 充值的那一刻新 KOL 入库立即加速。** 即:refresh 预算砍掉大头转给 discovery + discovery 拉满(扩种子 + 收割旧源)+ 加余额可观测,杜绝再次静默空转。

**部署不依赖余额**(余额 $0 时部署无害),只是不"生效"——所以本批次**先 building+部署到位,充值后立即起效**。

## §2 关键约束(实装必读)

1. **落地路径 B**(用户 2026-06-06 拍板):`scoring/tier.ts` 等爬虫代码改动**走上游 PR 到 `guang-tech/apify`,merge 后 sync 到 `/opt/apify-kol-service`**(按 `docs/dev/kol-sync-runbook.md` fork-sync 流程),不积累本地分叉。BL-061 已有 4 处本地 hot-fix,本批次不得再加本地 patch。
2. **铁律 #9**:Generator 实装、Evaluator 验收;本 spec 仅出方案。
3. **验收双段(因余额门)**:F006 Codex 验收分**充值前**(部署就绪 / 配置已应用 / refresh 负载下降可见于 `next_refresh_at` 重算 / dry-run)与**充值后**(真实入库速率、manual_seed 命中、IG 发现恢复)。充值前能 PASS 的不等真实流量。
4. **manual_seed 通道** = `POST /admin/seeds`(`ADMIN_API_KEY`,BL-061 F001 已实证)。
5. **scope = 平台级**(爬虫 `kols` 池无 tenant 维度)。

## §3 Features

### F001 — refresh 配比积累档:`TIER_INTERVAL_MS` → hot 14d / warm 30d / cold 30d
- 改 `packages/service/src/scoring/tier.ts` 的 `TIER_INTERVAL_MS`(当前 hot 1d/warm 3d/cold 7d)。
- 当前分布 hot 460 / warm 502 / cold 2215 → refresh 日负载 ~944 → ~123(−87%),省出 ~820 KOL-刷新/天转 discovery。
- 走路径 B：PR 到 `guang-tech/apify` → merge → sync `/opt/apify-kol-service` → rebuild。
- 可选配套 env:`REFRESH_SCHEDULER_INTERVAL_MS` / `SCRAPE_CONCURRENCY`(`.env.production`,纯配置)。
- 生效:worker 下次 upsert 时按新间隔重算 `next_refresh_at`;充值后 refresh 不再霸占预算。

### F002 — discovery 种子扩充 + 砍空转(schedules 表 config)
- 加 SEA/手游关键词(free fire / mobile legends / pubg mobile / garena / minecraft / roblox + 印地/葡/印尼语变体),覆盖诊断 §2 的印度/东南亚手游盲区。
- **砍/替换空转种子**:instagram valorant/esports/dota2/fortnite/pcgaming/streamer(全期 0 产出)、youtube mobile gaming/dota2(0)。
- 调高高产 tiktok 种子的 `limit`(lol/valorant/gaming/fortnite)。
- 配置级(schedules 表 / 爬虫 admin),与爬虫团队对齐改法。

### F003 — manual_seed 收割旧源(脚本 + `POST /admin/seeds`)
- 从 kolmatrix prod DB 只读取 `metadata->>'source'='youtube-api-daily'` 的 `external_id`(=UC id),排除已在 apify-kol `platform_user_id` 的 49 个 → ~2535 个 UC id。
- 分批投喂 `POST /admin/seeds`(幂等、限速、可重入),log 投喂量;manual_seed 历史命中 96%。
- 验证 id 进入 scrape 队列(真实抓取充值后才发生)。

### F004 — 余额 / inserted=0 静默空转告警 + `apify_cost_usd` 成本记账
- 告警:`scrape_jobs` 连续 N 天 `inserted_count=0` 或检测到 `Insufficient balance` → 告警(渠道:kol-sync-daily 报告 / webhook,实装定)。
- `apify_cost_usd` 回填(当前全 0):每次 apify run 记成本,供预算→KOL 换算。
- 爬虫代码部分走路径 B;监控/告警侧可放 kolmatrix 或爬虫,实装择优。

### F005 — Instagram hashtag 发现 0 产出 排查修复
- 排查 IG hashtag schedules 为何全期 0 新增(IG actor / hashtag 搜索逻辑),tiktok 同词高产。
- 根因 + 修复走路径 B PR;充值后验证 IG 发现能产出新 profile。
- 若根因超出本批次(需大改 IG actor)→ 记录 + 拆出独立 backlog,不阻塞 F001-F004。

### F006 — Codex L1+L2 + signoff（executor:codex）
- **L1**:F001/F004/F005 的 PR 在 `guang-tech/apify` CI / 本地 build+test 绿;F002/F003 配置/脚本 dry-run 校验;若触及 kolmatrix 代码则 kolmatrix lint/tsc/test 绿(本批次预计极少或无 kolmatrix 产品代码)。
- **L2 充值前(部署就绪)**:tier.ts 已 sync 部署(`TIER_INTERVAL_MS` 新值生效于 `next_refresh_at` 重算);schedules 已更新;2535 id 已入 seed 队列;告警链路 dry-run 触发;成本记账开始写入。
- **L2 充值后(真实速率)**:refresh 日负载实测下降;新 KOL 入库速率较 ~87/天 提升;manual_seed 命中;IG 发现恢复产出;告警在 inserted=0 时正确触发。出 before/after 量化。
- **signoff** `docs/test-reports/BL-086-signoff-2026-06-XX.md`(注明充值前/后两段验收状态)。

## §4 风险

- **路径 B 依赖爬虫团队 merge 上游 PR**——有对方排期,建议提前知会。
- **充值前无法完成全量 L2**——批次可能停在"部署就绪、待充值验真"状态;F006 须明确标注哪些待充值后补验。
- F005 IG 排查带不确定性,允许拆出。
- 改 `TIER_INTERVAL_MS` 后,充值瞬间会先清 ~900 条过期 refresh 欠账(catch-up 尖峰),拉长间隔已部分削平。
