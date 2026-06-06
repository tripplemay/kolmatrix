# KOL 数据诊断 — 数量差异 / 旧源价值 / 抓取速率

> **类型：** 数据/基础设施调查报告（Planner 独立任务，用户 2026-06-06 指派）
> **环境：** prod `kol.guangai.ai` (`/opt/kolmatrix` + `/opt/apify-kol-service`)，DATABASE_ADMIN_URL 只读，全程无写入
> **作者：** Kimi (planner)
> **关联：** [[BL-058]] apify-kol fork 数据迭代跟踪 · [[BL-086]] / [[BL-087]] / [[BL-088]] 派生工单 · ADR-017

---

## 0. 调查链概览

用户从"apify-preview(3177) vs match(2383) 数量不一致"起问，逐层下钻，最终定位到上游爬虫 **TikHub 余额耗尽 + refresh/discovery 预算配比失衡**。本报告按调查顺序固化全部证据。

---

## 1. 数量差异：3177 vs 2383 是"不对位"的比较

| 数字 | 真实含义 | 值 |
|---|---|---|
| DB 物理总行数 | `kol` 表所有行 | 4967 |
| └ 软删除(隐藏) | `youtube-api-daily` 旧源，2026-05-08 当天全量软删 | 2584 |
| └ 活跃可见 = `/match` | apify-kol 活跃 2371 + 历史种子 12 | **2383** ✓ |
| apify-preview 显示 | 上游 apify-kol-service 整池 | 3177 |

验证：`match_visible = 4967 − 2584(软删) − 0(suspicious) = 2383`，与 UI 逐位吻合（`buildKolWhere` 默认强制 `deleted_at IS NULL` + `is_suspicious=false`，`src/lib/kol/filters.ts:422`）。

**真正的上游→本地落差 = 上游 apify-kol 3177 − 本地 apify-kol 活跃 2371 = 806**（用户算的 794 因 2383 混入 12 条无关种子而偏差 12）。806 = 导入质量门拦截（spam `<1000 粉丝` 为主，`src/lib/kol-sync/quality.ts:101`；双低分 `quality.ts:123`）。各平台入库率：youtube 716/809(88%)、tiktok 1477/1897(78%)、instagram 178/469(**38%**)。

**结论：无真实数据丢失。** 75% 入库率 + 806 拦截属预期设计。

---

## 2. 旧源价值：是"可收割的资产"，不是"该复活的管道"

旧源 `youtube-api-daily`（2584，100% youtube，5/8 全量软删）vs 现源 `apify-kol`：

- **重叠仅 49 个频道**（按 UC 频道 id 交叉匹配 + display_name 双重验证一致）。占现源 youtube 池(716) 6.8%，占旧源(2584) 1.9%。两个数据集**基本互斥**。
- **2535 个频道只在旧源**：922 个 ≥10万粉、264 个 ≥100万粉（含 Jess No Limit 5450万、AS Gaming 2080万等印度/东南亚手游超级大号 Free Fire/Mobile Legends 系）——这是现源的覆盖盲区。
- **但几乎不可触达**：2535 条里只有 **6 条有邮箱(0.24%)**，新源 youtube 是 30.6%。旧源走 YouTube Data API，**结构上拿不到邮箱**（这正是当初做 apify-kol fork 的动机）。数据冻结于 5/8。

**结论：**
- 旧源数据 = 一次性 **discovery 种子名单**（保留，别硬删）。
- 旧源管道 = 不复活（解不了邮箱瓶颈 + 重启即烧 YouTube API 钱）。
- 正解：把 2535 个 UC id 通过 `manual_seed`（`POST /admin/seeds`）喂给新源重抓 → 拿到覆盖面 + 邮箱 + 新鲜度。详见 [[BL-086]]。

---

## 3. 抓取慢：根因是 TikHub 余额耗尽 + 预算配比失衡

### 3.1 服务归属（纠正）

上游 `apify-kol-service` **是我方自有服务**：`/opt/apify-kol-service`，docker compose（API 3004→3003 + 自带 postgres 15432），属主 tripplezhou，与 kolmatrix 同 VM。代码仓库 `guang-tech/apify`（爬虫团队维护）。→ **运维责任在我方，代码维护在爬虫团队。**

### 3.2 余额耗尽时间线

`scrape_jobs` 表"抓取努力 vs 实际产出"背离：

| 日期 | 任务数 | 抓取成功 | 新增 | 状态 |
|---|---|---|---|---|
| 5/27–6/02 | ~894/天 | ~20–25k/天 | 122/103/38/59/70/218 | ✅ 正常 |
| 6/03 | 894 | 14837 | 0 | ⚠️ 仅刷新，无新增 |
| 6/04–6/06 | ~894/天 | **0** | **0** | ❌ 余额断供，静默空转 |

容器日志最近 25h 内 31837 行有 **30156 行(95%) 是 `Insufficient balance`**（YouTube + TikTok 全失败）。最后一个新频道入池 6/02，余额在 6/03→6/04 之间见底，**已空转 3 天**。另有更早一段 5/14–5/26 干涸期 → **重复发生的运维盲区**。

### 3.3 真实日增基线

上游 `kols.created_at`：稳态(5/27–6/02) **~87 个新 KOL/天**（范围 38–218）；初始播种(5/08–5/13) 2567/6 天（一次性，不可复现）。

### 3.4 比"没钱"更深：90% 预算花在刷新存量，产 0 新增

`scrape_jobs.kind` 三类全期汇总：

| 类型 | 任务数 | 抓取量 | 新增 | 新增率 | 占抓取量 |
|---|---|---|---|---|---|
| **refresh** | 14768 | 237,980 | **0** | 0%(设计如此) | **~89%** |
| **hashtag**(发现) | 518 | 29,051 | 3140 | **~11%** | ~10% |
| **manual_seed**(投喂) | 41 | 38 | 37 | **~96%** | ~0% |

- refresh 吃 ~90% 抓取预算却天然产 0 新增（职责是更新存量）。
- 发现引擎(hashtag)其实好用(~11%)，但只分到 ~10% 预算。
- manual_seed 命中率 96%，几乎没用过 → 喂旧源 id 的现成通道。
- **空转的发现种子**：instagram 的 valorant/esports/dota2/fortnite/pcgaming/streamer 全 0 产出，youtube mobile gaming/dota2 也 0；tiktok 关键词最高产(lol 260 / valorant 239 / gaming 233)。

> 备注：`scrape_jobs.apify_cost_usd` 全为 0（成本记账未接），$ 金额需查 TikHub 控制台。

---

## 4. 行动清单（按优先级 + 归属）

| P | 动作 | 性质 | 归属 | 工单 |
|---|---|---|---|---|
| **P0** | TikHub 充值（恢复 ~87/天，已空转 3 天） | 运营 | 用户/账户管理员 | — |
| **P0** | `inserted=0` 静默空转告警 + 余额监控 + `apify_cost_usd` 成本记账回填 | 运维/config | 我方 | [[BL-086]] |
| **P1** | manual_seed 喂 2535 旧源 youtube id（`POST /admin/seeds`）+ hashtag 关键词扩充(印/东南亚手游)+ 砍空转 IG 种子 + 调 limit | config | 我方 | [[BL-086]] |
| **P1** | refresh:discovery 预算配比重构（降刷新频次/分级，把预算让给发现）+ 修 Instagram hashtag 发现 0 产出 | **代码** | **爬虫团队** | [[BL-087]] |
| P2 | KOLMatrix 质量门选择性放宽回收 806（量换质，优先 IG/中粉段）+ 旧源 2584 软删数据硬删清理评估 | 代码/DB | 我方 | [[BL-088]] |

**核心判断：** 单纯充值只恢复 ~87/天；真正加速需爬虫团队改 refresh:discovery 配比（治本）+ 我方扩种子（治标）。KOLMatrix 主体无需改——"无新增"完全是上游发现策略问题。
