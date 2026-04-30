---
name: B5-kol-data-enrichment
description: KOL 数据深度增强 - schema 扩字段 + Discovery 高级筛选折叠 + KOL 详情页改造（banner + 最近 6 视频 + 词云 + 真 engagementRate）+ 隐藏 audience demographics
status: decisions-locked
created_by: Kimi (Planner) + 修订 johnsong (2026-04-30)
created_at: 2026-04-27
decisions_locked_at: 2026-04-27（原合并 sprint 5 项 lock）
revised_at: 2026-04-30（用户选 A 方案：B5 单独先做，再起 MVP-internal-demo-prep；词云从 stretch P2 升级为 c 完整版；A1/A2 spec 歧义澄清）
estimated_effort: ~3-3.5 day（含词云完整版升级）
features_count: 5
prerequisites:
  - MVP-kol-seed-redo done ✅（schema metadata.youtube.* 已填）
  - YouTube API quota ≥ 5K（F002 enrich + F004 lazy load 余量）
  - aigcgateway 余额 ≥ $5（F004 词云 AI 提取关键词）
trigger: B4-email-template-library done 后立即启动（用户 2026-04-30 决议 A 方案）
---

# B5-kol-data-enrichment — KOL 数据深度增强

## 1. 背景与目标

### 1.1 触发

用户 2026-04-27 提问 "有了 YouTube API，KOL 信息展示和筛选能否支持更丰富的数据？"
用户 2026-04-30 重申 "现在觉得 KOL 详情页数据太少"，确认 B5 单独先做。

Planner 调研发现：
- 当前 Kol schema 已有 30+ 字段，但 XLSX 数据源填充率低
- MVP-kol-seed-redo F002 扩展后能填 ~10 字段（kol-seed-redo 内 0 增量）
- **仍缺 4 个字段**（账号年龄 / 视频总数 / lifetime 观看 / banner 图）作为 schema 列
- Discovery filter 12 维已多但缺"账号年龄 / 视频频率 / 国家细分"
- KOL 详情页内容稀疏（无最近视频展示 / 无主题词云 / engagementRate 估算）
- audience demographics 区无数据（YouTube 不公开），现在显示 placeholder 误导用户

### 1.2 目标

**让 KOLMatrix 从"列表平台"进化到"KOL 深度画像平台"**，提升内部团队 demo 的产品成熟度观感。

具体收益：
- KOL 详情页从 "12 字段" → "丰富画像"（含最近 6 视频缩略图 + 主题词云 + banner）
- Discovery 筛选从 12 维 → 15 维（账号年龄 / 视频频率 / 国家细分）+ 高级筛选折叠 UI
- 真实 engagementRate（基于视频 likeCount/viewCount，替换 estimate）
- audience demographics UI 隐藏（避免空白误导，B6 三方接入再显示）
- B6 爬虫团队真数据接入时，schema 已就绪不需再扩

### 1.3 非目标

- 不做 audience demographics 真接入（B6 + NoxInfluencer / SocialBlade 三方 scrape）
- 不做跨平台 KOL（仅 YouTube 一种）
- 不做 KOL 评论 / 互动数据爬取（VOC 范围 B7+）
- 不做 KOL 内容 NLP 深度分析（如品牌调性匹配，B7+）
- 不修改 KOL Discovery 主搜索算法（hotfix F002 已重写，本批次仅扩 filter）

## 2. 范围（5 features）

### F001 — Kol schema 扩 4 字段 + migration

**实现：**

```prisma
model Kol {
  // ... 现有字段
  channelCreatedAt DateTime? @map("channel_created_at") @db.Timestamptz  // 账号建立时间
  videoCount       Int?      @map("video_count")                          // 视频总数
  totalViewCount   BigInt?   @map("total_view_count")                     // lifetime 总观看（BigInt 避免溢出）
  bannerUrl        String?   @map("banner_url")                           // banner 图（KOL 详情页顶部）
}
```

**Migration：**
- 新建 `prisma/migrations/{date}_b5_kol_enrichment_fields/`
- ADD COLUMN nullable（不影响现有数据）
- 含完整 ROLLBACK SQL（database-patterns.md §3 硬要求）

**Acceptance：**
- migration 通过 `validate-rollback-sql.sh`
- prisma migrate deploy 在 staging + prod 跑通
- tests/integration/b5-schema.test.ts 验证 4 字段 CRUD + RLS
- staging git_sha 与本 commit 一致（curl https://staging.kol.guangai.ai/api/health | jq .git_sha 验证）

### F002 — 二次跑 YouTube API 补字段 + metadata.youtube.* 升级到列

**实现：**

1. **新建 `scripts/enrich-kol-from-youtube.ts`**：
   - 读 prod / staging 当前 KOL（来源是 YouTube）
   - 批量调 channels.list (cost 1 unit/call, 50 channels/call) 拿 brandingSettings + 完整 statistics
   - 写入 4 个新列 + `engagementRate`（公式估算）
   - 同时把 metadata.youtube.* 数据**升级**到正式列（migration 后**只写新列，metadata 字段保留旧数据但不再写**）
   - quota 估算：1000 KOL / 50 = 20 calls × 1 unit = **20 units**（极少）

**关键澄清（A1，2026-04-30 修订）：**
- 本批次 engagementRate 仅做**估算或留空**，**不调 search.list 拿视频细节**避免 quota 爆
- **engagementRate 真值由 F004 在用户点详情页时 lazy load 计算并写回 DB**（参见 F004 §4）
- DB 状态生命周期：F002 写估算值 → F004 首次 visit 后覆盖为真值

**关键澄清（A2，2026-04-30 修订）：**
- metadata.youtube.* 字段**保留旧数据但不再写**；新数据**只写 schema 列**；读取统一从 schema 列取
- **不双写**（避免数据漂移风险）
- BL-012 爬虫团队 6 月接入时按 schema 列直填

**Acceptance：**
- staging Kol 表 4 新字段填充率 ≥ 95%（除非 channel.country 真无）
- prod 同上
- tests/integration/b5-enrich-kol.test.ts 验证 enrich 流程 + 字段映射
- 任何 metadata.youtube.* 字段不再被新代码写入（守门 test）
- staging git_sha 与本 commit 一致

### F003 — Discovery filter 加 3 维 + 高级筛选折叠 UI

**实现：**

1. **新增 filter 维度（src/lib/kol/filters.ts）：**

```typescript
// channelAge: < 1 year / 1-3 years / > 3 years
type ChannelAgeFilter = "new" | "established" | "veteran";

// uploadFrequency: active (≥4/month) / semi-active (1-4/month) / inactive (< 1/month)
type UploadFrequencyFilter = "active" | "semi-active" | "inactive";

// regionGroup: asia / europe / americas / latam / oceania (基于 countryCode 推算)
type RegionGroupFilter = "asia" | "europe" | "americas" | "latam" | "oceania";
```

2. **FilterSidebar UI 改造（高级筛选折叠）：**

```
┌─ 基础筛选（默认展开，6 个常用）─┐
│ [Search]                         │
│ [Platforms]                      │
│ [Regions]                        │
│ [Categories]                     │
│ [Followers]                      │
│ [Engagement]                     │
└──────────────────────────────────┘
┌─ 高级筛选（默认折叠，9+3 个）   ▼┐
│ [Languages]                      │
│ [Tags]                           │
│ [Avg Views]                      │
│ [Uploads/month]                  │
│ [Monetization]                   │
│ [Brand Collabs]                  │
│ [Brand Safety]                   │
│ [Channel Age]      ← 新增        │
│ [Upload Frequency] ← 新增        │
│ [Region Group]     ← 新增        │
└──────────────────────────────────┘
```

3. **i18n 新增翻译 keys：**
- `discovery.filters.advanced` ("Advanced filters" / "高级筛选")
- `discovery.filters.channelAge.{new,established,veteran}`
- `discovery.filters.uploadFrequency.{active,semi-active,inactive}`
- `discovery.filters.regionGroup.{asia,europe,americas,latam,oceania}`
- 跑 i18n:translate 自动补 4 语言（与 i18n done 后流程一致）

**Acceptance：**
- Discovery filter 总维度从 12 → 15
- 高级筛选默认折叠（cookie 记住用户上次选择）
- 3 个新 filter 在 SQL where 正确过滤（integration test 覆盖）
- tests/e2e/discovery-advanced-filters.spec.ts 验证折叠 + 各 filter 工作
- staging git_sha 与本 commit 一致

### F004 — KOL 详情页改造（banner + 最近 6 视频 + 词云完整版 + 真 engagementRate + 隐藏 audience demographics）

**实现：**

1. **页面布局改造 src/app/[locale]/(app)/kols/[id]/page.tsx：**

```
┌─ Banner（新增，bannerUrl）────────────────────────┐
└────────────────────────────────────────────────────┘
┌─ Profile Header（已有）│ Stats Cards（已有，强化）─┐
│ avatar/name/handle/etc.│ followers / engagement /  │
│                        │ channelAge / videoCount   │
└────────────────────────┴───────────────────────────┘
┌─ Tab: Overview ────────────────────────────────────┐
│ - Bio (snippet.description)                        │
│ - Categories (chips)                               │
│ - 最近 6 个视频缩略图（新增，3×2 grid）            │
│ - 视频主题词云（新增，react-wordcloud 完整版）     │
└────────────────────────────────────────────────────┘
┌─ Tab: Audience ────────────────────────────────────┐
│ ⚠️ 隐藏（hidden, 不再渲染 placeholder）            │
│ B6 + NoxInfluencer 接入后再显示                    │
└────────────────────────────────────────────────────┘
┌─ Tab: Collabs / AI（已有，empty state）            │
└────────────────────────────────────────────────────┘
```

2. **最近 6 视频实现：**
- 调 search.list (channelId, order=date, maxResults=6) cost 100 units/call
- demo 阶段每 KOL 仅在用户**点开详情页时**调（lazy load + cache 24h）
- 不在 seed 阶段批量爬（避免 quota 爆）

3. **视频主题词云（C2 升级 — 必做完整版，2026-04-30 修订）：**
- 6 视频标题拼接 → 调 aigcgateway Action 提取关键词（5-10 个，附 weight 0-1）
- 渲染为完整版词云（**react-wordcloud + d3-cloud**，字号视 weight 大小映射 14-32px）
- 缓存 7 天（DB JSONB 字段 `topicCloud` 或 `aiInsights.topicCloud`）
- 无数据 / AI 失败 → 显示 "Topics being analyzed..." 友好 empty state
- 词云 click → 暂不做 filter 跳转（Post-MVP 增强）
- 包大小：react-wordcloud + d3-cloud ~30KB gzip，**lazy load**（dynamic import）避免影响其他页

4. **engagementRate 显示（2026-04-30 二次修订 — 移除 lazy-load 真值，改由 BIx-mvp-polish-pass F004 batch 预计算）：**
- 详情页**直接从 DB 读 `Kol.engagementRate`** —— 不再 lazy-load 调 YouTube API
- 显示来源：F002 的公式估算值（在 BIx-mvp-polish-pass F004 batch 真值覆盖前）
- BIx-mvp-polish-pass F004（独立批次）每天为 top 100 by valueScore KOL 用 playlistItems + videos.list batch 预计算真值（cost ~112u/day），写回 `Kol.engagementRate`
- 详情页对此完全无感：永远从 DB 读 + 不发任何 YouTube API 请求
- **理由：** 避免 100u + 1u/次 lazy-load 浪费配额；用 BIx F004 批量 1u + 0.12u/channel 替代，配额 ROI 提升 ~50×

5. **Audience tab 防退化守门 + 未来扩展锚点（2026-04-30 audit 修订）：**
- 现状：KolTabsNav.tsx 含 4 tabs（overview / collabs / contacts / ai），**没有 audience tab**（历史上未实现，spec 原作者 Kimi 与修订者 johnsong 均未核对现实）
- 本批次：保持现状 4 tabs，加注释 `// B6: re-enable Audience tab when NoxInfluencer integration lands` 作为未来 NoxInfluencer 接入时的扩展锚点
- 未来：B6+ NoxInfluencer / SocialBlade 三方接入后再扩展 audience demographics，tabs 数量 4 → 5
- F005 守门 test：`tests/unit/b5-kol-detail-no-audience-tab.test.ts` 静态断言 `KolTabKey` union 不含 "audience"（防 LLM 误新增 audience tab 留空白 placeholder）
- 完整审计 + 决议见 `docs/specs/B5-f004-audience-tab-clarification.md`

**Acceptance：**
- KOL 详情页含 banner / 最近 6 视频 / engagementRate（DB 读，不调 API）/ 完整版词云（如 aigcgateway Action 就位；否则推迟）
- KolTabsNav 保持 4 tabs（overview / collabs / contacts / ai），未新增 audience tab；含未来扩展锚点注释
- 词云 react-wordcloud + d3-cloud 集成完成（条件性：依赖 `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` env var 就位），weight 0-1 映射字号 14-32px
- 词云 lazy load（不在首屏 JS bundle）
- engagementRate 显示路径**永远从 Kol.engagementRate DB 字段读**（不再 lazy-load 真值）；由 BIx-mvp-polish-pass F004 batch 后端填充
- 最近 6 视频 lazy 实现用 `channels.list contentDetails` + `playlistItems.list`（cost 2u/channel/24h）— **不要用 `search.list`（100u 高浪费）**
- staging git_sha 与本 commit 一致

### F005 — i18n 补新 keys + 守门 tests + UI polish

**实现：**

1. **i18n keys：**
- F003 新增的 advanced filters keys
- F004 新增的 KOL 详情页 keys（banner / latest videos / topic cloud / hidden audience tooltip）
- 跑 `npm run i18n:translate -- --target zh,ja,ko,es` 自动补
- 用户 review 关键 keys

2. **守门 tests：**
- tests/unit/b5-kol-detail-no-audience-tab.test.ts：静态源码守 KolDetailTabs 不再渲染 Audience tab
- tests/integration/b5-discovery-filter-combinations.test.ts：3 新 filter 与原 12 filter 任意组合查询正确
- tests/unit/b5-no-double-write-metadata.test.ts：守 enrich script 不再写 metadata.youtube.* 字段（A2 强化）

3. **UI polish：**
- KOL 卡片（Discovery / Database 列表）显示 banner 缩略（hover 露出）— 可选
- 详情页 banner 高度自适应（max-height 240px，避免占满首屏）
- 词云无数据时友好 empty state

**Acceptance：**
- i18n 4 语言新 keys 全补
- 6+ 守门 test 全绿（含 A2 不双写守门）
- L2 staging 浏览器 spot check：KOL 详情页 / Discovery 高级筛选 / Audience 隐藏 / 词云渲染
- staging git_sha 与本 commit 一致

## 3. 关键设计决策

| 决策 | 选定方案 | 用户裁决 |
|---|---|---|
| schema 扩字段 | 4 个新列（channelCreatedAt / videoCount / totalViewCount / bannerUrl） | ✅ 2026-04-27 |
| Discovery filter 折叠 UI | 基础 6 + 高级 9+3 折叠（cookie 记忆） | ✅ 2026-04-27 |
| KOL 详情页改造 | banner + 最近 6 视频 + 词云 + 真 engagementRate | ✅ 2026-04-27 |
| audience demographics | **保持现状 4 tabs（无 audience tab）+ 加锚点注释**（2026-04-30 audit 修订：现状已满足"不渲染" → C 方案 no-op 防退化）| ✅ 2026-04-30 audit |
| 最近 6 视频获取时机 | lazy load + cache 24h | Planner 推荐 |
| **词云方案** | **C 完整版（react-wordcloud + AI 提取关键词 + weight 视觉化）** | ✅ **2026-04-30** |
| **engagementRate 真值（A1 + 2026-04-30 二次修订）** | F002 估算（B5 期间永久使用）→ BIx-mvp-polish-pass F004 batch 预计算覆盖（top 100 KOL/day）。**B5 F004 移除 lazy-load 设计** —— 详情页直接从 DB 读 | ✅ **2026-04-30 二次** |
| **6 月爬虫数据 import（A2）** | metadata 字段保留旧数据；新数据**只写 schema 列**；**不双写** | ✅ **2026-04-30** |
| 启动模式 | **B5 单独批次先做，B5 done 后再起 MVP-internal-demo-prep**（A 方案，原 merged-sprint 废弃） | ✅ **2026-04-30** |

## 4. 依赖关系

```
F001 (schema migration) ─→ F002 (enrich + 升级 metadata 到列) ─┐
                                                                 ├─→ F003 (Discovery filter 3 维 + 折叠)
                                                                 ├─→ F004 (KOL 详情页改造 + 词云)
                                                                 └─→ F005 (i18n + 守门 tests + polish)
```

**强依赖：** F001 → F002 → F003/F004/F005（可并行）

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| schema migration 影响生产数据 | 中 | F001 nullable + ROLLBACK SQL 完整；先 staging 验证 |
| YouTube API quota 不够（F004 lazy load 视频）| 中 | F004 lazy load + cache 24h；监控每日 quota 消耗 |
| 词云 AI 提取效果差 | 低 | F004 加 fallback empty state；如果 AI 提取关键词全无意义可手动 fallback 到分类标签 |
| Audience tab 隐藏后用户问 | 低 | F005 在 KOL 详情页加 footer 备注 "Audience demographics coming with NoxInfluencer integration" 或完全静默 |
| 新 filter 维度 SQL 性能 | 低 | F003 加 channel_age / video_count 索引（已有 isGaming + categories 索引）|
| metadata.youtube.* 升级到列后兼容（A2）| 中 | **不双写**；保留旧 metadata 数据但读写都走新列；BL-012 爬虫接入时按新列 schema 直填；F005 加守门 test |
| 词云包大小影响首屏 | 低 | react-wordcloud + d3-cloud ~30KB gzip，KOL 详情页 lazy load（dynamic import）避免影响其他页 |

## 6. 验收方式

### L1 自动化
- F001 schema migration 通过 + integration test
- F002 enrich script + integration test
- F003 filter combinations integration + e2e test
- F004 detail page test（含 hidden Audience tab + 词云渲染）
- F005 i18n + 守门 tests（含 no-double-write）
- typecheck / lint / 现有套件不退化

### L2 staging
- KOL 详情页打开任意 youtube-seeded KOL → 含 banner / 最近 6 视频 / 真 engagementRate / 完整版词云 / 无 Audience tab
- Discovery 高级筛选展开 → 3 新 filter 组合查询
- 4 语言（en/zh/ja/ko/es）KOL 详情页 + Discovery 切换正常

### L3 prod（用户手动）
- 用户 ssh prod + `npm run enrich:kol-from-youtube` 跑一次
- 浏览器访问 KOL 详情页验证

## 7. 引用文档

- `docs/specs/MVP-kol-seed-redo-spec.md`（前置批次，schema metadata.youtube.* 已填）
- `docs/product/KOLMatrix-MVP-PRD.md` §11（产品决策）+ §12（B6 爬虫团队接入边界）
- `docs/product/kol-crawler-team-handoff-v1.md`（6 月爬虫团队，本批次 schema 与之兼容）
- `docs/product/MVP-gap-audit-2026-04-30.md`（B5 启动决策溯源）
- `prisma/schema.prisma` model Kol（扩字段）
- `framework/harness/database-patterns.md`（migration 规则）

## 8. 启动检查清单（Generator 开工前）

- [x] MVP-kol-seed-redo done + signoff（schema metadata.youtube.* 已填）
- [ ] YouTube API quota ≥ 5K（B5 enrich 仅消耗 ~30，但 F004 lazy load 需余量）
- [ ] aigcgateway 余额 ≥ $5（F004 词云 AI 提取）
- [x] 用户确认启动时机（2026-04-30 A 方案 lock）

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 schema + migration + tests | ~3-4h |
| F002 enrich script + tests | ~2-3h |
| F003 Discovery 3 filter + 折叠 UI + tests | ~4-5h |
| F004 KOL 详情页改造（banner + 6 视频 + 真 engagement + 隐藏 audience + **词云完整版**）| ~6-8h（含 react-wordcloud 集成 +1-2h vs 原 stretch）|
| F005 i18n + 守门 tests + polish | ~2-3h |
| 缓冲 | ~3h |
| **总计** | **~20-26h ≈ 2.5-3.5 day** |

## 10. 时间线 + 启动时序

### 用户决策（2026-04-30）

> 用户选 A 方案：B5 单独先做，B5 done 后再起 MVP-internal-demo-prep。
> 理由："KOL 详情页数据太少"，需要 B5 先做提升详情页画像质量。
> 同时锁定 MVP-internal-demo-prep 全部决策（详见 `docs/specs/MVP-internal-demo-prep-spec.md`）。

### 启动时序

```
~04-30  B4-email-template-library done ✅
~04-30  done 收尾 + MVP gap audit + B5 重新 planning（本会话 johnsong）
~04-30  ⭐ B5 building 启动（Generator 接手）
~05-01  F001 + F002 完成（schema + enrich，半天）
~05-02  F003 完成（Discovery filter + 折叠 UI）
~05-03  F004 完成（KOL 详情页 + 词云完整版）
~05-03  F005 完成（i18n + 守门）
~05-04  B5 verifying（Reviewer L1/L2）
~05-05  B5 done + 用户 prod redeploy（schema migration 落地）
~05-05  ⭐ MVP-internal-demo-prep planning + building（5 features，~1.5-2 day）
~05-07  MVP-internal-demo-prep done + prod L2 烟测 PASS
~05-07  团队内部 demo 准备就绪
```

## 11. 用户决策（已 lock）

### 2026-04-27（原合并 sprint）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | 是否起草 B5 spec | ✅ 同意 |
| 2 | 启动时机 | ✅ 本批次（kol-seed-redo）完成后启动（已 done） |
| 3 | filter UI 折叠改进 | ✅ 同意（含在 F003） |
| 4 | audience demographics UI | ✅ 隐藏（含在 F004） |
| 5 | 时序方案 | ⚠️ 原 B2 合并 sprint，已被 2026-04-30 A 方案替代 |

### 2026-04-30（修订）

| # | 问题 | 用户答复 |
|---|---|---|
| 6 | 启动模式（A/B/C 方案）| ✅ A 方案：B5 单独先做，再起 MVP-internal-demo-prep |
| 7 | C1 — A1（engagementRate）+ A2（不双写）解读 | ✅ 同意 |
| 8 | C2 — 词云方案 | ✅ c 完整版（react-wordcloud + d3-cloud） |
| 9 | C3 — MVP-internal-demo-prep 决策保存 | ✅ a 起草独立 spec 文件 |

---

**Spec 状态：** decisions-locked（2026-04-30 修订完成，等 Generator 开工）

**与其他批次关系：**
- 依赖 MVP-kol-seed-redo done ✅（schema metadata.youtube.* 已填）
- B5 done 后立即启动 MVP-internal-demo-prep（5 features）
- 不与 B4-extended-email-system 冲突
- 与 BL-012 爬虫团队 6 月接入兼容（schema 列已就绪，A2 修订后明确不双写）
