# ADR-017: KOL 数据源策略 + 上游 apify-kol-service 抓取治理

## Status

**Accepted**

- 日期：2026-06-06
- 作者：Kimi (planner) + 用户
- 相关批次：派生自 2026-06-06 数据诊断（独立任务）；落地工单 BL-086 / BL-087 / BL-088
- 证据：`docs/reviews/kol-acquisition-diagnostic-2026-06-06.md`（prod 只读实测）

## Context（背景）

用户从"admin/apify-preview(3177) vs /match(2383) 数量不一致"起问，Planner 对 prod 做只读调查，逐层揭示三个此前未沉淀的事实：

1. **数量差异是"不对位"比较**：DB 物理 4967 行 = 软删 2584（旧源 `youtube-api-daily`，5/8 全量软删）+ 活跃 2383（apify-kol 2371 + 种子 12）。上游 apify-kol 整池 3177，本地 apify-kol 活跃 2371，真实落差 806 是质量门拦截（spam `<1000 粉丝` 为主），属预期设计。

2. **旧源 vs 现源几乎互斥**：仅 49 个频道重叠（1.9%）；2535 个频道只在旧源（922 个 ≥10万粉，集中印度/东南亚手游大号），但邮箱覆盖仅 0.24%（YouTube Data API 结构上拿不到邮箱）。

3. **抓取停滞根因 = 上游 TikHub 余额耗尽**（约 6/04 起静默空转，日志 95% 为 `Insufficient balance`）+ **预算配比失衡**（refresh 占 ~90% 抓取量却产 0 新增；发现引擎 hashtag 只分到 ~10%）。上游服务确认为**我方自有**（`/opt/apify-kol-service` docker），代码维护在 `guang-tech/apify`（爬虫团队）。

不决策的后果：这些结论散落在对话里丢失；未来 agent 会重复"复活旧源""单纯加预算"等误判；运维盲区（余额静默耗尽）会再次发生。

## Decision（决策）

1. **旧源 `youtube-api-daily` 定位为一次性 discovery 资产，不复活为 living pipeline。** 保留 2584 条软删行作种子名单；其 2535 个独有 youtube 频道通过 `manual_seed`（`POST /admin/seeds`）喂给 apify-kol 新源重抓，获取邮箱 + 新鲜度。理由：旧源无法解决邮箱可触达瓶颈，且重启即重新消耗 YouTube API 配额。

2. **上游 `apify-kol-service` 责任界定：运维（部署/余额/调度配置）在 KOLMatrix 团队，代码维护在爬虫团队（`guang-tech/apify`）。** 配置层调优（schedules 增删、manual_seed 投喂、limit）我方可直接做（与爬虫团队对齐改法）；发现策略代码改动走爬虫团队。

3. **确立"发现优先"原则 + 阶段化 refresh 策略**：refresh（刷新存量）不得挤占 discovery 预算。当前 refresh 占 ~90% 抓取量产 0 新增（根因：`apify-kol-service` `scoring/tier.ts` 的 `TIER_INTERVAL_MS` = hot 1d / warm 3d / cold 7d，hot 460 个频道每天全量重刷，占日刷新量 49%）。**积累期**采用拉长的刷新间隔（**用户 2026-06-06 确认：hot 14d / warm 30d / cold 30d**，refresh 日负载 944→~123 即 −87%，省出 ~820 KOL-刷新/天转 discovery）；**成熟/外联期**再收紧保新鲜度。`TIER_INTERVAL_MS` 等爬虫代码改动的落地路径：**用户确认走 B——上游 PR 到 `guang-tech/apify` 再 sync 下来**（不积累本地分叉）。

6. **爬虫策略阶段化配置页缓议**（BL-089，deferred）：将上述所有旋钮（refresh 间隔 / tier 阈值 / 调度 / 种子 / 质量门）统一成"按产品阶段一键切换"的平台级 admin 配置页，是正确方向但当前 ROI 偏低（阶段切换频率低、单 admin）。先手动落地积累期参数，待阶段切换变频繁再立项。架构定调：配置归爬虫（单一真相源）+ 暴露 strategy API，KOLMatrix admin 作瘦客户端，**不跨服务直写对方库**；scope 为平台级（爬虫池无 tenant 维度），非租户级。

4. **KOLMatrix 端 75% 入库率 + 806 质量门拦截属预期设计**，quantity↔quality 取舍由产品按需放宽（选择性），非 bug。

5. **运维可观测性硬性要求**：上游须有"`inserted=0` 连续 N 天静默空转告警 + 余额监控 + `apify_cost_usd` 成本记账"，杜绝余额静默耗尽（本次及 5/14 那次均靠人工感知发现）。

## Consequences（后果）

### 正面

- 明确的责任划分，避免"等爬虫团队"与"我方该做"互相推诿。
- "收割旧源"路径让历史投入（2535 大号）变现，且补上 youtube 覆盖盲区。
- 余额/成本可观测后，"apify 贡献慢"从主观感知变为可监控、可预算的工程问题。
- 沉淀后未来 agent 不会重蹈"复活旧源""单纯加预算"的误判。

### 负面

- `apify_cost_usd` 成本记账当前缺失，预算→KOL 换算暂依赖 TikHub 控制台单价。
- 抓取速率治本（refresh:discovery 配比）依赖爬虫团队代码改动，KOLMatrix 不完全可控。
- 选择性放宽质量门会引入低粉/低可触达数据，是 quantity↔quality 取舍，需谨慎按平台/粉丝段执行。

### 中性

- 旧源 2584 条软删数据是否硬删需单独评估（DB 瘦身 vs `(tenant,platform,handle)` 非 partial 唯一索引的潜在撞键风险）。

## Alternatives Considered（评估过的备选）

- **复活旧源 youtube-api-daily 管道** — 否决：拿不到邮箱（产品核心瓶颈）+ 重新烧 YouTube API 配额。
- **只给 TikHub 充值** — 不充分：余额恢复只回到 ~87/天，refresh 占 90% 预算的配比仍锁死增长上限。
- **KOLMatrix 端放宽质量门作为主要加速手段** — 否决为"主"手段：只能一次性回收 806 条低质数据，不产生持续速率；降为按需可选（BL-088）。

## References

- `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md`（完整证据）
- [[BL-058]] apify-kol fork 数据迭代跟踪（前序）
- BL-086 / BL-087 / BL-088（落地工单）
- 代码：`src/lib/kol-sync/quality.ts`（质量门）/ `src/lib/kol/filters.ts:422`（match 可见口径）/ `src/lib/kol-sync/adapters/apify-kol.ts`（discover）
