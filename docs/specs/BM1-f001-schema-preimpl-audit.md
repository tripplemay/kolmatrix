---
发起者: johnsong (Generator)
日期: 2026-04-23
触发: BM1 F001 开工前审计，按 pre-impl 审计 → Planner 裁决工作范式
状态: 等待 Planner (Kimi) 明确回复，**未收到前不动 F001 / 下游 F002-F007 代码**
---

# BM1 · F001 Schema 扩展 · Pre-Impl 审计请求

## 1. 背景

BM1 spec 要求在 `Kol` 表加 15 维 filter 字段，在 `KolCampaign` 表加 `kolFee / matchScore` 字段。

Generator 扫 `prisma/schema.prisma` 现状后发现 **7 处 spec 与 B0 schema 已有字段的漂移**——若直接 ALTER TABLE ADD COLUMN 按 spec 字面来，Prisma migrate dev 会因重复列报错（3 处已存在）。其余 4 处是语义重叠 / 命名选择（需要 Planner 裁决）。

F001 不开工下游全停，故提前审计。

## 2. 冲突事实（逐条核对）

### 2.1 已存在，不能再加（会报错）

| spec 要求新增 | B0 schema 现状 | 结论 |
|---|---|---|
| `Kol.language String? @db.VarChar(5)` | `Kol.language String?`（line 120，无长度约束，TEXT 类型） | **已存在** —— 加会 duplicate column 报错 |
| `Kol.engagementRate Decimal? @db.Decimal(5,2)` | `Kol.engagementRate Decimal? @db.Decimal(5, 2)`（line 122，完全一致） | **已存在** —— 加会 duplicate |
| `KolCampaign.matchScore Int?` | `KolCampaign.matchScore Int?`（line 190，完全一致） | **已存在** —— 加会 duplicate |

### 2.2 语义重叠，需决策

| spec 要求新增 | B0 schema 现状 | 关系 |
|---|---|---|
| `Kol.avgViewsPerVideo Int? @map("avg_views_per_video")` | `Kol.avgViews Int? @map("avg_views")` | 同一个概念，两个名字 |
| `Kol.audienceDemographics Json?` | 3 个独立 Json 列：`audienceAgeDist` / `audienceGeoDist` / `audienceGenderDist` | aggregate vs granular |

### 2.3 命名 / 类型不一致

| spec 描述 | 实际 | 影响 |
|---|---|---|
| spec §F002 说 "`platform: "Youtube"` → Prisma enum `YOUTUBE`" | 现状 `Kol.platform String`（非 enum） | 若真要建 enum 需 ALTER COLUMN TYPE，破坏性；若保持 String 需决定归一化方式 |
| spec §F001 文字用 "`CampaignKol`" | 现状 model 名 `KolCampaign`（@@map kol_campaign） | 只是 spec 笔误，不影响实现 |

### 2.4 值域问题

spec §F002 价值分公式：

```
followerScore = min(50, log10(followers) * 15)   // 上限 50
engagementScore = 15                              // 固定
categoryScore = min(20, count * 8)                // 上限 20
total = round(followerScore + engagementScore + categoryScore)
```

**实际最大值 = 50 + 15 + 20 = 85**，非 0-100。

spec §3 写 "价值分算法 normalizedFollowers _ 0.5 + engagementPlaceholder _ 0.3 + categoryRichness _ 0.2（0-100）" —— 和 §F002 数值维度不对齐。

---

## 3. 决议请求

### 决议请求 #A —— 已存在字段如何处理？

| 方案 | 做法 |
|---|---|
| **A** skip（推荐） | migration 不 ADD COLUMN language / engagementRate / matchScore；helper 代码直接用现有字段；spec 改口径 "沿用 B0" |
| **B** DROP + 重建 | 为 spec 字面一致性 drop + 按 spec 再建（破坏性，数据丢失） |

**Generator 倾向：A**。理由：现有 3 列语义已完全覆盖 spec 需求，DROP 是纯 for-the-spec 破坏操作。

---

### 决议请求 #B —— avgViewsPerVideo vs avgViews？

| 方案 | 做法 |
|---|---|
| **A** 沿用现有 `avgViews`（推荐） | F004 filter UI 绑 `avgViews`；spec 的 `avgViewsPerVideo` 字段不加 |
| **B** 添加 `avgViewsPerVideo`、保留 `avgViews` 作废 | 两列并存，新代码写新列，老列留空 |
| **C** 重命名 `avgViews` → `avgViewsPerVideo` | ALTER RENAME COLUMN，迁 filter 代码 |

**Generator 倾向：A**。avgViews 字段名在 YouTube API 世界就是 "average views per video" 的简写，语义一致，命名已够清楚。

---

### 决议请求 #C —— audienceDemographics Json 是否加？

| 方案 | 做法 |
|---|---|
| **A** 不加，复用 3 个现有字段（推荐） | `audienceAgeDist` / `audienceGeoDist` / `audienceGenderDist` 覆盖年龄/地域/性别三维度，未来 B6 YouTube API 集成时填 |
| **B** 加 `audienceDemographics` 作为 aggregate Json，旧 3 字段废弃 | 需额外 migration 做数据迁移 |
| **C** 新旧并存 | 4 个 Json 列，冗余 |

**Generator 倾向：A**。3 个粒度字段更可查询（`WHERE audience_age_dist->>'18-24' > 30` 等），比 blob 更好。

---

### 决议请求 #D —— Kol.platform 类型？

| 方案 | 做法 |
|---|---|
| **A** 保持 String，归一化 "Youtube" → "youtube"（推荐） | seed 脚本里 normalize；未来需要更多平台时加 Zod enum 约束在 app 层 |
| **B** 改为 Prisma enum `KolPlatform` | 需要 migration `ALTER COLUMN TYPE`，且后续加新平台要写 migration，灵活性变差 |
| **C** String + 应用层 const union type | Generator 加 `type KolPlatform = "youtube" | "tiktok" | ...` 供 TS 使用，但 DB 层还是 String |

**Generator 倾向：A + C 组合**（DB 保持 String，应用层定义 union type 供静态约束）。

---

### 决议请求 #E —— 价值分公式上限？

| 方案 | 做法 |
|---|---|
| **A** 保留 spec §F002 公式，接受 max=85（推荐） | 继续写 "0-100 scale" 宽泛口径；log10 缩放本身就不可能摸到 100 |
| **B** 改公式让 max=100 | 例如 follower 缩放系数从 ×15 改 ×17（log10(6.67)=0.82 → 50），engagement 从 15→25，categoryScore 25 —— 重新调 |
| **C** 归一化输出（raw 0-85 → scaled 0-100） | `Math.round(raw * 100 / 85)` |

**Generator 倾向：A**。公式是简单启发式，85 vs 100 对用户不可感知（他们看到 52 vs 78 的相对排序）；复杂化公式反而引入争议。UI hover breakdown 显示各项 raw 分量。

---

### 决议请求 #F —— 新增字段是否需要索引？

spec 未明示但合理：

| 新列 | 建议索引 |
|---|---|
| `value_score` | `@@index([tenantId, isGaming, valueScore(sort: Desc)])` — F004 Discovery 排序常用 |
| `is_saved` | `@@index([tenantId, isSaved])` — F005 Database 筛选必用 |
| `relationship_status` | 不单独索引（低基数 6 值，filter 效率差异不大） |
| `is_gaming` | 融入 `(tenantId, isGaming, valueScore)` 复合索引 |

| 方案 | 做法 |
|---|---|
| **A** 按 Generator 建议建 2 个复合索引（推荐） | `(tenantId, isGaming, valueScore DESC)` + `(tenantId, isSaved)` |
| **B** 不建新索引，生产上看热点再补 | MVP 数据量 2524 条，无索引也快；future 加 |

**Generator 倾向：A**。MVP 虽小但 F004 多 filter 组合查询，`isGaming + valueScore` 排序很常用；索引成本低。

---

## 4. 汇总决议（请 Planner 短格式回复）

| # | 主题 | Generator 建议 |
|---|---|---|
| A | 已存在列处理 | **A**（skip） |
| B | avgViews vs avgViewsPerVideo | **A**（沿用 avgViews） |
| C | audienceDemographics Json | **A**（不加，用现有 3 字段） |
| D | Kol.platform 类型 | **A**（保持 String + app-layer union） |
| E | 价值分公式 | **A**（保留，接受 max=85） |
| F | 新增索引 | **A**（2 个复合索引） |

**回复格式：** `#A:A #B:A #C:A #D:A #E:A #F:A`（偏离建议请附一句理由）

---

## 5. 开工条件

收到 Planner 对以上 6 条裁决后，Generator 将：

1. 按决议写 migration `20260424100000_bm1_schema/migration.sql`
2. 按决议改 `prisma/schema.prisma`
3. 走 F007 ROLLBACK SQL 校验 + CI 闸门
4. Push main

F002-F007 全部 F001 下游，无法并行推进；F008 (locale detection) 独立可以并行开，但通常会和 F003/F004 一起出 i18n key 更省事。

**未收到明确回复前，F001 及下游不动代码。**

---

## 6. 相关文档

- `docs/specs/BM1-console-kol-core-spec.md`（本次审计对象）
- `prisma/schema.prisma`（现状 Kol / KolCampaign）
- `prisma/migrations/20260418000000_init/migration.sql`（init 表结构）
- `framework/harness/pre-impl-adjudication.md`（本审计所依据的工作范式）
- `framework/harness/database-patterns.md`（§2 migration 命名 / §1 RLS NULLIF）

---

## 7. Planner 裁决区（Kimi 请在此追加）

_（等待 Planner 填写）_
