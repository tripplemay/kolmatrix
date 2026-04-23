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

## 7. Planner 裁决（johnsong · 2026-04-23）

> **Planner 身份注**：Kimi 在同日稍早交接 Planner 角色，本次裁决由 johnsong 以 Planner 身份给出（johnsong 同时兼任 BM1 Generator，但 Planner/Generator 角色重叠符合 harness 规则）。

### 7.1 短格式决议

```
#A:A  #B:A  #C:A  #D:A+C  #E:C  #F:A
```

**F001 可开工，但需按下述 spec 同步修订（§7.3）后再落 migration 文件。**

### 7.2 逐条裁决与理由

| # | 决定 | 理由 |
|---|---|---|
| A | **A（skip）** | 核对 `prisma/schema.prisma:120/122/190` 确认 3 列已 100% 等价存在；DROP 是纯 for-the-spec 破坏操作，不获得任何语义收益。migration 不 ADD 这 3 列，spec 口径改为"沿用 B0"。 |
| B | **A（沿用 avgViews）** | YouTube API 语境下 `avgViews` 即"每视频平均"，命名已够清楚；`src/` 与下游 F004 filter UI 均未引用 `avgViewsPerVideo`，改名是纯 churn。`@map("avg_views")` 列名保持。 |
| C | **A（不加 Json blob）** | 3 个粒度 Json 列支持 JSON 路径查询（`audience_age_dist->>'18-24' > 30`），比 blob 更可查。seed 时从 YouTube API 也是分维度返回，分列写入更自然。 |
| D | **A + C 组合** | DB 层保持 `platform String` 最灵活（未来加 TikTok/Instagram 零迁移）；应用层定义 `type KolPlatform = "youtube" \| "tiktok" \| ...` union + Zod enum 在 API 入口做运行时校验。seed 脚本里统一 normalize 到 lowercase（`"Youtube" → "youtube"`），保证等值查询一致。 |
| E | **C（归一化 0-100）** — 偏离 Generator 建议 | Generator 倾向 A（接受 max=85），但 spec §3 已承诺"0-100 scale"口径，§F002 公式实际 max=85，属 §3.3 Spec 字面冲突（Planner 自锅）。归一化成本仅一行（`Math.round(raw * 100 / 85)`），且与 Modash/HypeAuditor 等行业基准分口径一致，用户对比时无需心算换算。**实施要求**：`computeKolValueScore()` return 归一化 total；原 raw 分量 `{follower, engagement, category}` 供 UI hover breakdown 使用时通过同一 pure function 返回 `{total, rawBreakdown}` 结构体。`value_score` 列存归一化值（0-100）。 |
| F | **A（2 个复合索引）** | MVP 2524 条即便无索引也快，但索引 insert 成本近零；F004 Discovery "isGaming=true ORDER BY valueScore DESC" 是高频查询，F005 Database `WHERE isSaved=true` 同理。relationshipStatus 低基数不单独索引。 |

### 7.3 同步文档更新清单（Planner 本次裁决推送前完成）

以下修订 Planner 会立即执行，与本裁决同 commit 推送：

1. **BM1 spec `docs/specs/BM1-console-kol-core-spec.md`** 修订：
   - **§3 "价值分算法"行** 改为："`raw = followerScore + engagementScore + categoryScore`（max 85）→ `total = round(raw * 100 / 85)`（归一化 0-100）"
   - **§F001 Kol 扩展字段**：
     - 删除 `language String? @db.VarChar(5)`（已存在）
     - 删除 `engagementRate Decimal? @db.Decimal(5,2)`（已存在）
     - 删除 `avgViewsPerVideo Int? @map("avg_views_per_video")` → 替换为注释 "沿用 B0 `avgViews`"
     - 删除 `audienceDemographics Json? @db.JsonB` → 替换为注释 "沿用 B0 `audienceAgeDist/audienceGeoDist/audienceGenderDist` 3 字段"
   - **§F001 CampaignKol 扩展字段**：
     - 删除 `matchScore Int? @map("match_score")`（已存在）
     - model 名从 `CampaignKol` 改为 `KolCampaign`（修正笔误，与 schema 对齐）
   - **§F001 migration 描述**：`ALTER TABLE kol ADD COLUMN 15 个 nullable fields` → 改为"11 个 nullable fields（language/engagementRate 沿用 B0）"；`campaign_kol ADD kol_fee, match_score` → 改为"`kol_campaign ADD kol_fee`（match_score 沿用 B0）"
   - **§F001 新增索引描述**：在 migration 描述段明确"CREATE INDEX `kol_tenant_gaming_value_idx` + `kol_tenant_saved_idx`"
   - **§F002 价值分公式实现 TypeScript 块**：最后一行 `return Math.round(followerScore + engagementScore + categoryScore);` 改为：
     ```typescript
     const raw = followerScore + engagementScore + categoryScore; // max 85
     return {
       total: Math.round(raw * 100 / 85),             // 归一化 0-100，落 value_score 列
       rawBreakdown: { follower: Math.round(followerScore), engagement: engagementScore, category: categoryScore },
     };
     ```
     下游调用端（seed 脚本）写库时用 `result.total`；UI breakdown hover 时函数 re-compute 即可。
   - **§F002 platform 映射**：`platform: "Youtube" → Prisma enum YOUTUBE` 改为 `platform: "Youtube" → normalize 为 lowercase "youtube" 存入 Kol.platform String 列`
2. **Evaluator 通知**：Reviewer 验收 F001/F002 时按修订后 spec 为准。本裁决 commit message 会明确标注 spec 有修订，Reviewer 签收前须重新读 spec。
3. **features.json** 无需改（BM1 的 features 清单内嵌在 spec 而非 features.json，现状 `"features": []` 是 Planner 后续补充事项，不影响本裁决）。

### 7.4 额外叮嘱（Generator 实施时注意，非阻塞）

1. **migration 头部加注释**（便于日后 review 理解 skip 了哪些列）：
   ```sql
   -- BM1 F001 schema 扩展
   -- 说明：以下 B0 已有列不再新增（Planner 裁决 #A skip）：
   --   kol.language / kol.engagement_rate / kol_campaign.match_score
   -- 以下 B0 已有列替代了 spec 最初命名（Planner 裁决 #B/#C）：
   --   avgViews 替代 avgViewsPerVideo
   --   audienceAgeDist/GeoDist/GenderDist 替代 audienceDemographics
   ```
2. **Product 表 RLS policy** 写法与 B0 `NULLIF(..., '')::uuid` 兜底保持一致（spec 已给出正确模板，直接沿用）。
3. **tsvector trigger**（BI4-F005）确认只依赖 `display_name/handle/categories/bio` 四列，本次 ALTER TABLE 新增列不触碰 trigger 字段——无需改 trigger function。spec §F001 已有此注释，F001 实现时保留。
4. **F001 test case `tests/integration/bm1-schema.test.ts`**：验 Kol 新字段读写时，建议用 `valueScore` + `isGaming` + `isSaved` + `relationshipStatus` + `tags[]` 5 个 coverage 点（其他 11 维 nullable filter 字段写个通用循环即可），避免写 15 个近似重复 case。
5. **决议 D 的 app-layer union type** 建议放在 `src/lib/kol/platform.ts`：
   ```typescript
   export const KOL_PLATFORMS = ["youtube", "tiktok", "instagram", "twitch", "twitter"] as const;
   export type KolPlatform = (typeof KOL_PLATFORMS)[number];
   export const KolPlatformSchema = z.enum(KOL_PLATFORMS);
   ```
   Discovery/Database filter UI 下拉选项也从此 const 派生。MVP 期间 seed 只产 `"youtube"`，但 schema 就绪以便 B6 扩展。

### 7.5 开工条件确认

Planner 已修订 spec + 本裁决与 spec commit 一起推送后，Generator **可立即开工 F001**，无需再次 pre-impl 审计。

F001 完成 push 后，Generator 可按 spec §F001 → §F002 顺序推进；F002 seed 实施时注意决议 D 的 platform normalize + 决议 E 的 valueScore 归一化。F003/F004/F008 可并行。
