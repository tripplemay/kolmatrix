# YouTube KOL Sync 策略审计 — 2026-04-30

> **作者：** Planner（johnsong）
> **触发：** 用户 2026-04-30 询问 "目前的爬取策略有什么可以优化的地方"
> **观察基础：** 2026-04-28 + 2026-04-29 两次 prod cron 实跑数据（B6-kol-daily-sync done 2 days ago）

---

## TL;DR

B6 daily sync 落地时设计基线偏保守 —— **每天仅消耗 18% 配额（1,805/10,000u），dedupe rate 已攀升至 99% 且趋向 100%**（数日内 insert→0）。用户 2026-04-30 决议 P1 ~89% 利用率方案（量化数字 ×4-5），并接受用 batch 预计算替代 B5 F004 lazy-load engagement。改造归属 BIx-mvp-polish-pass F004（~1.5-2 day Generator）。

---

## 1. 当前策略快照

### Discover 阶段
- 矩阵：6 region × 3 keyword = 18 query
- Regions：CN / HK / TW / US / JP / KR
- maxResults：10（YouTube 单次最大支持 50，**当前刻意压到 10 损失 5× 信息密度**）
- 翻页：不翻页（每 query 仅取 page 1）
- Order：YouTube 默认 relevance（不变 → 命中头部固定）
- 配额：18 × 100 = **1,800u/day**

### Refresh 阶段
- 选 KOL：FIFO `orderBy: { lastSyncedAt: "asc" } take 200`
- Batch：200/50 = 4 channels.list = **4u/day**

### Filter 规则（`scripts/seed-kol-from-youtube.ts`）
- `FILTER_MIN_SUBSCRIBERS = 10_000` ⚠️ **与 PRD §10.1 "500-10K 微网红" 矛盾 + 与 quality.ts 1,000 阈值矛盾**
- `FILTER_MIN_VIDEOS = 30`
- description.length > 0
- isGamingTopic（topicCategories 空时默认 true，permissive）

### 总配额
**1,805u / 10,000u = 18% 利用率，82% 浪费**

---

## 2. 已观察的核心问题

### 2 天 cron 数据
| 日期 | discover | inserted | dedupe rate |
|---|---|---|---|
| 2026-04-28（手动）| 71 | 8 | 89% |
| 2026-04-29（首次 cron）| 73 | **1** | **98.6%** |

### 趋势诊断
- 每天发现的"新"KOL 急剧下降（8 → 1）
- 18 个固定 (region, keyword) 元组 → YouTube 返回同一批 channel
- 仅取 page 1 → page 2-5 长尾候选**永远看不到**
- 默认 order=relevance 固定 → 命中相同头部
- 关键词太窄（每 region 3 泛词，覆盖不到长尾品类如 VR / indie / horror / Vtuber 解说）
- 后果：**5-10 天后 insert 趋于 0** → B6 daily sync 的 PMF 价值（"产品在持续迭代"）失效

---

## 3. 配额成本表

| API call | 单次 cost | 单次返回 |
|---|---|---|
| `search.list` | **100u** | ≤ 50 channels |
| `channels.list` | 1u | ≤ 50 channels（按 id 批量）|
| `videos.list` | 1u | ≤ 50 videos |
| `playlistItems.list` | 1u | ≤ 50 items |
| `activities.list` | 1u | ≤ 50 |

**核心洞察：** 99% 的配额成本来自 search.list（100u/次）。最大化利用率 = 多打 search.list，但要让每次 search 尽可能返回**新数据**（避免重复命中）。

---

## 4. 优化方案（用户 2026-04-30 决议 P1 ~89%）

### 改造点
| # | 改造 | 配额 | 说明 |
|---|---|---|---|
| 1 | maxResults 10 → 50 | 不增 | 单次 search.list cost 不变（100u），返回从 10→50 → 信息密度 ×5 |
| 2 | Region 6 → 14（加 GB/DE/BR/MX/TH/ID/IN/ES）| +800u | 覆盖欧洲 / 拉美 / 东南亚 / 印度 / 西语 |
| 3 | Keyword 池 3 固定 → 12-15 池 day-of-year mod 6 轮转 | 不增 | 覆盖品类多样化 |
| 4 | Page 轮转 day 1-3=p1 / 4-5=p2 / 6=p3 | 不增 | 跨日命中长尾候选 |
| 5 | publishedAfter 4 切片轮转（last 90/180/365/730 days）| +600u | 命中"新涌现"channel |
| 6 | 分层 refresh by valueScore（Tier 1/2/3 + flagged）| 几乎不增 | 提升 refresh 数据新鲜度 ROI |
| 7 | Top 100 KOL 真 engagement batch（playlistItems + videos.list）| +114u | **替代 B5 F004 lazy-load** |
| 8 | Per-matrix observability log | 不增 | 数据驱动持续调优 |

### 配额组合（P1 ~89% / ~9,131u）

```
Discover 主矩阵：14 region × 6 keyword × 100u  = 8,400u
publishedAfter 切片：6 search × 100u           =   600u
channels.list (enrich)                          =    16u
Top 100 engagement batch                        =   114u
healthcheck                                     =     1u
─────────────────────────────────────────────────────
                                          总计 = 9,131u (91%)
                                       安全余量 =   869u
```

### 备选档位
| 档位 | 配额 | 利用率 | 风险 |
|---|---|---|---|
| P0 | ~7,805u | 78% | 留 22% 安全余量 |
| **P1（用户选）** | ~9,131u | **91%** | 留 9% 安全余量，可接受 |
| P2 | ~9,500u | 95% | quota window edge 可能 403 |
| P3 | ~9,800u | 98% | **危险** — 重试触发 quotaExceeded |

---

## 5. 关键架构决策（用户 2026-04-30 lock）

### 决策 1：B5 F004 移除 lazy-load engagement
**原计划（B5 spec）：** 详情页打开时 lazy-load search.list (100u) + videos.list (1u) 拿真 engagement
**新计划：** 详情页直接读 `Kol.engagementRate`（DB），由 BIx-mvp-polish-pass F004 daily batch 写入
**ROI 提升：** lazy-load 100u/次 → batch 1.14u/channel = ~50× 配额效率提升
**用户体验：** 详情页瞬开（不依赖 API），无 lazy-load 延迟

### 决策 2：改造批次归属 BIx-mvp-polish-pass F004
**理由：**
- C 方案（合并）避免拆碎独立批次
- BIx 总工时从 ~2-2.5 day → ~3.5-4.5 day（加 ~1.5-2 day）
- 团队 demo 上线时间从 ~05-10 → ~05-12（+2 天换换更可持续的 sync 增长）

### 决策 3：FILTER_MIN_SUBSCRIBERS open question
- 当前 10K 与 PRD §10.1 "500-10K 微网红" 矛盾
- 当前 10K 与 quality.ts 1,000 矛盾
- 待 Generator 开工 BIx F004 前由用户裁决（a 改 1,000 / b 维持 10,000 / c env var 可调）

---

## 6. 数据扩张预估（与当前对比）

| 指标 | 当前 | 优化后（P1） | 倍数 |
|---|---|---|---|
| 单次 search 候选 | 10 | 50 | ×5 |
| Query 数 / day | 18 | 84 (14×6) | ×4.7 |
| 总候选 / day | 180 | 4,200 | **×23** |
| 估计 inserted / day（去重后）| 1-8 | **30-80** | ×10-15 |
| 月新增 KOL | ~120 | **~1,500** | ×12 |

按 P1 增长，单 YouTube 适配器 30 天内可补齐 PRD §10.1 目标的 ~1,000 gaming 微网红。

---

## 7. 实施细节（详见 BIx-mvp-polish-pass-spec.md §F004）

- maxResults 10 → 50（`src/lib/kol-sync/adapters/youtube.ts:DAILY_MAX_RESULTS`）
- DAILY_REGIONS 数组扩 14 个
- `DAILY_KEYWORDS_BY_REGION` → `DAILY_KEYWORD_POOL_BY_REGION` + `pickDailyKeywords(region, date)` helper
- 新表 `kol_sync_cursor`（KV 存 nextPageToken）+ migration + ROLLBACK SQL
- `Kol.metadata.latestVideos[]` 字段（top 100 KOL batch 写入，详情页读）
- `DailyLogLine` schema 加 `perMatrix` + `engagementBatchStats`
- env var `KOL_SYNC_PUBLISHED_AFTER_SLICES`（默认 6，403 fallback 降 4）

---

## 8. 引用文档

- `docs/specs/B6-kol-daily-sync-spec.md`（原 spec，本次修订溯源）
- `docs/specs/B5-kol-data-enrichment-spec.md`（F004 lazy-load engagement 移除，由本批次 batch 替代）
- `docs/specs/BIx-mvp-polish-pass-spec.md`（F004 落地点）
- `docs/dev/kol-sync-runbook.md`（runbook）
- `src/lib/kol-sync/`（dispatcher / import / quality / retry / log / adapters）

---

**审计执行 commit：** Planner（johnsong）独立任务产出。spec 修订已完成，待 BIx F004 开工前由 Generator 二次确认 MIN_SUBSCRIBERS open question。
