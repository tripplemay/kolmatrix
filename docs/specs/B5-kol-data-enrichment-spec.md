---
name: B5-kol-data-enrichment
description: KOL 数据深度增强 - schema 扩字段提升 + Discovery 高级筛选 + KOL 详情页改造（最近 6 视频 + 主题词云 + 真 engagementRate） + 隐藏 audience demographics + 已并入 MVP-demo-launch 合并 sprint（用户 2026-04-27 选 B2）
status: decisions-locked + merged-sprint
created_by: Kimi (Planner)
created_at: 2026-04-27
decisions_locked_at: 2026-04-27
merged_into: MVP-demo-launch（9 features = MVP-seed-demo-prep 4 + 本批次 5），用户 2026-04-27 选 B2 合并方案
estimated_effort: 5-6 day（合并后；本批次部分仍 2-3 day）
features_count: 5（合并 sprint 内）
prerequisites:
  - MVP-kol-seed-redo done（schema metadata.youtube.* 已填）
  - YouTube API 余配额充足（B5 二次跑 channels.list 仅消耗 ~30 units）
trigger: 合并 sprint MVP-demo-launch 内执行（见 §10 时序方案 B2 已 lock）
---

## ⭐ 合并 sprint 说明（用户 2026-04-27 选 B2）

本批次与 `MVP-seed-demo-prep` 合并到单一 sprint **MVP-demo-launch**（9 features 串行）。

**合并理由：** 用户期望 "和之前规划的下一批次一起启动"，且接受邀请发出节点推迟 3 天换取首版即完整版（含 KOL banner / 6 视频 / 真 engagement）。

**Generator 顺序详见 `MVP-seed-demo-prep-spec.md` 的 "⭐ 合并 sprint 说明" 段落。**

**本批次在合并 sprint 内位置：**
- B5-F001 schema migration → 第 1 步（让 demo seed 用新字段）
- B5-F002 enrich KOL → 第 2 步
- demo-prep F001+F002 → 第 3-4 步
- B5-F003 Discovery filter → 第 5 步
- B5-F004 KOL 详情页改造 → 第 6 步（最重）
- B5-F005 i18n + 守门 → 第 7 步

# B5-kol-data-enrichment — KOL 数据深度增强

## 1. 背景与目标

### 1.1 触发

用户 2026-04-27 提问 "有了 YouTube API，KOL 信息展示和筛选能否支持更丰富的数据？"

Planner 调研发现：
- 当前 Kol schema 已有 30+ 字段，但 XLSX 数据源填充率低
- MVP-kol-seed-redo F002 扩展后能填 ~10 字段（kol-seed-redo 内 0 增量）
- **仍缺 4 个字段**（账号年龄 / 视频总数 / lifetime 观看 / banner 图）作为 schema 列
- Discovery filter 12 维已多但缺"账号年龄 / 视频频率 / 国家细分"
- KOL 详情页内容稀疏（无最近视频展示 / 无主题词云 / engagementRate 估算）
- audience demographics 区无数据（YouTube 不公开），现在显示 placeholder 误导用户

### 1.2 目标

**让 KOLMatrix 从"列表平台"进化到"KOL 深度画像平台"，支持种子用户体验"专业 KOL 营销决策"。**

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

### F002 — 二次跑 YouTube API 补字段 + metadata.youtube.* 提升为正式列

**实现：**

1. **新建 `scripts/enrich-kol-from-youtube.ts`**：
   - 读 prod / staging 当前 KOL（is_demo=true 仅 YouTube 来源）
   - 批量调 channels.list (cost 1 unit/call, 50 channels/call) 拿 brandingSettings + 完整 statistics
   - 写入 4 个新列 + `engagementRate`（基于 videos.list 平均 likeCount/viewCount）
   - 同时把 metadata.youtube.* 数据**升级**到正式列（migration 后保留 metadata 兼容）
   - quota 估算：1000 KOL / 50 = 20 calls × 1 unit = **20 units**（极少）

2. **真实 engagementRate 计算（可选 stretch）：**
   - 调 search.list 拿每 KOL 最近 10 个视频（cost 100 units/call × N KOL = 100K units）— **超 quota，本批次不做**
   - **降级方案：** engagementRate 留空 or 用 `viewCount / videoCount / subscriberCount` 公式估算

**Acceptance：**
- staging Kol 表 4 新字段填充率 ≥ 95%（除非 channel.country 真无）
- prod 同上
- tests/integration/b5-enrich-kol.test.ts 验证 enrich 流程 + 字段映射

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

### F004 — KOL 详情页改造（最近 6 视频 + 主题词云 + 真 engagementRate + 隐藏 audience demographics）

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
│ - 视频主题词云（新增，AI 提取自标题，stretch）     │
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

3. **视频主题词云（stretch goal，可推迟）：**
- 6 视频标题拼接 → 调 aigcgateway Action 提取关键词（5-10 个）
- 渲染为词云（react-wordcloud 或简单 chip 列表）
- 缓存 7 天

4. **真 engagementRate（基于实际视频）：**
- 同 6 视频拿 statistics.likeCount / viewCount → 平均
- 替换 F002 估算值

5. **隐藏 audience demographics：**
- 当前 KolDetailTabs 中 Audience tab 显示 placeholder
- 本批次：**完全隐藏 Audience tab**（tab 数量从 4 → 3）
- 加注释 `// B6: re-enable when NoxInfluencer integration lands`

**Acceptance：**
- KOL 详情页含 banner / 最近 6 视频 / 真 engagementRate
- Audience tab 不渲染（visual + integration test 验证）
- 词云作为 stretch goal，可在 Acceptance 中标 P2 不阻塞

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

3. **UI polish：**
- KOL 卡片（Discovery / Database 列表）显示 banner 缩略（hover 露出）— 可选
- 详情页 banner 高度自适应（避免 banner 太长占满首屏）
- 词云无数据时友好 empty state

**Acceptance：**
- i18n 4 语言新 keys 全补
- 6 个守门 test 全绿
- L2 staging 浏览器 spot check：KOL 详情页 / Discovery 高级筛选 / Audience 隐藏

## 3. 关键设计决策

| 决策 | 选定方案 | 用户裁决（2026-04-27）|
|---|---|---|
| **schema 扩字段** | 4 个新列（channelCreatedAt / videoCount / totalViewCount / bannerUrl） | ✅ 同意 |
| **Discovery filter 折叠 UI** | 基础 6 + 高级 9+3 折叠（cookie 记忆）| ✅ 同意 |
| **KOL 详情页改造** | banner + 最近 6 视频 + 词云（stretch）+ 真 engagementRate | ✅ 同意 |
| **audience demographics** | **完全隐藏 tab**（不显示 placeholder） | ✅ 用户选"隐藏" |
| **最近 6 视频获取时机** | 用户点详情页时 lazy load + cache 24h（避免 quota 爆） | Planner 推荐 |
| **词云优先级** | stretch goal P2，可推迟 | Planner 推荐 |
| **engagementRate 真值** | 基于最近 6 视频 likeCount/viewCount 平均；F002 仅做估算 | Planner 推荐 |
| **6 月爬虫数据 import 时** | metadata.youtube.* 兼容字段保留；新爬虫数据按 schema 列填充 | 平滑过渡 |

## 4. 依赖关系

```
F001 (schema migration) ─→ F002 (enrich + 升级 metadata 到列) ─┐
                                                                 ├─→ F003 (Discovery filter 3 维 + 折叠)
                                                                 ├─→ F004 (KOL 详情页改造)
                                                                 └─→ F005 (i18n + 守门 tests + polish)
```

**强依赖：** F001 → F002 → F003/F004/F005（可并行）

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| schema migration 影响生产数据 | 中 | F001 nullable + ROLLBACK SQL 完整；先 staging 验证 |
| YouTube API quota 不够（特别是 F004 lazy load 视频）| 中 | F004 lazy load + cache 24h；监控每日 quota 消耗 |
| 词云 AI 提取效果差 | 低 | 标 stretch P2，效果不好可推迟到 Post-B5 |
| Audience tab 隐藏后用户问 "我看到原型有这个"| 低 | F005 在隐藏处加 tooltip "Available with NoxInfluencer integration (Q3 2026)" 或完全静默 |
| 新 filter 维度 SQL 性能 | 低 | F003 加 channel_age / video_count 索引（已有 isGaming + categories 索引）|
| metadata.youtube.* 字段升级到列后兼容性 | 中 | F002 保留 metadata 字段（向后兼容，6 月爬虫数据 import 时双写）|

## 6. 验收方式

### L1 自动化
- F001 schema migration 通过 + integration test
- F002 enrich script + integration test
- F003 filter combinations integration + e2e test
- F004 detail page test（含 hidden Audience tab）
- F005 i18n + 守门 tests
- typecheck / lint / 现有套件不退化

### L2 staging
- KOL 详情页打开 demo-kol-001（或任意 youtube-seeded KOL） → 含 banner / 最近 6 视频 / 真 engagementRate / 无 Audience tab
- Discovery 高级筛选展开 → 3 新 filter 组合查询
- 4 语言（en/zh/ja/ko/es）KOL 详情页 + Discovery 切换正常

### L3 prod（用户手动）
- 用户 ssh prod + `npm run enrich:kol-from-youtube` 跑一次
- 浏览器访问 KOL 详情页验证

## 7. 引用文档

- `docs/specs/MVP-kol-seed-redo-spec.md`（前置批次，schema metadata.youtube.* 已填）
- `docs/product/KOLMatrix-MVP-PRD.md` §11（产品决策）+ §12（B6 爬虫团队接入边界）
- `docs/product/kol-crawler-team-handoff-v1.md`（6 月爬虫团队，本批次 schema 与之兼容）
- `prisma/schema.prisma` model Kol（扩字段）
- `framework/harness/database-patterns.md`（migration 规则）

## 8. 启动检查清单（Generator 开工前）

- [ ] MVP-kol-seed-redo done + signoff（schema metadata.youtube.* 已填）
- [ ] YouTube API quota ≥ 5K（B5 仅消耗 ~30，但 F004 lazy load 需余量）
- [ ] aigcgateway 余额 ≥ $5（F004 词云 AI 提取，可选）
- [ ] 用户确认启动时机（与 demo-prep + prod-launch-smoke 协调，详见 §10）

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 schema + migration + tests | ~3-4h |
| F002 enrich script + tests | ~2-3h |
| F003 Discovery 3 filter + 折叠 UI + tests | ~4-5h |
| F004 KOL 详情页改造（banner + 6 视频 + 真 engagement + 隐藏 audience）| ~5-6h |
| F005 i18n + 守门 tests + polish | ~2-3h |
| 缓冲 | ~3h |
| **总计** | **~19-24h ≈ 2.5-3 day** |

## 10. 时间线 + 启动时序（与之前规划批次协调）

### 用户期望（2026-04-27）

> "在本批次（kol-seed-redo）完成后，和之前规划的下一批次一起启动"

**"之前规划的下一批次"** = MVP-prod-launch-smoke + MVP-seed-demo-prep（kol-seed-redo done 后启动的两批）

### Generator 单线限制

按 harness-rules.md 铁律 6，Generator 一次只做一批：
- B5 5 features 全 Generator 工作
- demo-prep F001+F002 也是 Generator 工作
- prod-launch-smoke F002 是 Reviewer 工作（Codex），不占 Generator

### 时序方案对比

**方案 A（Planner 推荐）：错峰但都启动**

```
~04-30  i18n done
~04-30  kol-seed-redo 启动（与 prod redeploy 平行）
~05-01  kol-seed-redo done + 用户 prod redeploy
~05-01  ⭐ 三批同时进入"启动状态"：
          - MVP-prod-launch-smoke building（Reviewer 主体，半天 done）
          - MVP-seed-demo-prep building（Generator 主体，~2-2.5 day）
          - B5-kol-data-enrichment planning（Planner 起草 + 等 Generator 接手）
~05-01-04 demo-prep 推进（Generator）+ prod-launch-smoke 推进（Reviewer）
~05-04  邀请发出 ⭐
~05-04  B5 building 启动（Generator 接力 demo-prep 之后）
~05-07  B5 done + 用户 prod redeploy（B5 schema + 字段升级）
```

**方案 B（用户字面理解：严格平行）**

```
~05-01  三批 Generator 全部尝试启动 → 实际无法（Generator 单线）
        必须串行 demo-prep 和 B5
        实际等价于方案 A
```

**方案 C（B5 schema-only 先做，剩余 demo 后做）**

```
~05-01  kol-seed-redo done + prod redeploy
~05-01  B5 F001 + F002 启动（schema migration + enrich，~半天，Generator 间隙）
~05-01  prod-launch-smoke + demo-prep 启动（demo-prep 用 B5 已升级 schema）
~05-04  邀请发出
~05-04  B5 F003-F005 启动（剩余功能）
~05-07  B5 完整 done
```

**Planner 推荐：方案 C** — 理由：
- B5 schema 部分（F001+F002）轻量（~半天），不阻塞 demo-prep
- F003-F005 是 UI 改造，留到邀请发出后做（种子用户首周用 demo-prep 简化版，第二周看到 B5 增强版，**形成"产品在迭代"印象**）
- demo-prep F001 demo seed 脚本可基于 B5 升级后的 schema 写（一次到位）

## 11. 用户决策（2026-04-27 ✅ 5/5 全 lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | 是否起草 B5 spec | ✅ 同意 |
| 2 | 启动时机 | ✅ 本批次（kol-seed-redo）完成后，和之前规划的下一批次一起启动 |
| 3 | filter UI 折叠改进 | ✅ 同意（含在 F003）|
| 4 | audience demographics UI | ✅ 隐藏（含在 F004）|
| 5 | §10 时序方案 | ✅ **B2 合并 sprint**（接受邀请发出推迟到 ~05-07，换取首版即完整版） |

---

**Spec 状态：** decisions-locked + merged-sprint（2026-04-27 Planner 起草 + 用户裁决 5/5 全 lock）

**与其他批次关系：**
- 依赖 MVP-kol-seed-redo（schema metadata.youtube.* 已填）
- **合并 sprint：** MVP-demo-launch = MVP-seed-demo-prep (4) + 本批次 (5) = 9 features
- prod-launch-smoke 平行执行（Reviewer，~半天）
- 不与 BIx-staging-automation / B4-extended-email-system 冲突
- 与 BL-012 爬虫团队 6 月接入兼容（schema 列已就绪）
