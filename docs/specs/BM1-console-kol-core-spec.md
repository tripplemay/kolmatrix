# BM1 — 控制台 + KOL 核心 批次规格

> 类型：MVP Business Sprint（业务批次 1/2）
> 状态：✅ 定稿 2026-04-23，Generator 可开工
> Planner: Kimi · Generator: johnsong · Evaluator: Reviewer

---

## 1. 背景与目标

MVP 纵向路线的**第一棒业务批次**。基于完整基建（B0-BI3+BAux1+BI4）+ 完整设计稿（18 张 Stitch）+ 确定数据源（415 gaming KOLs）+ 完整产品 PRD（MVP PRD v1.0）起步。

本批次目标：**把 KOL 数据"进得来、筛得到、看得清"**，同时完成 Product 实体（游戏产品）入库 + AI 素材生成的基础能力。不涉及 Campaign / 联系 KOL / ROI —— 那些是 BM2。

**Definition of Done：**
- 访客登录后看到的 Dashboard 是真数据（KOL 总数 / 活跃活动 / 邮件触达等 KPI 从 DB 拉）
- `/discovery` 可按 15 维 filter 找到 KOL，每张卡带价值分 + 标签
- `/database` 列表展示已筛选保存的 KOL
- 每个 KOL 可进画像页（`/kols/:id`）看详情
- `/knowledge-base` 可录入游戏产品（含 AI 生成推广素材）
- i18n en + zh 全覆盖，ja/ko/es stub 回退 en
- 浏览器默认语言自动跳 locale（响应 MVP PRD §13 Q7）

**Out of Scope（留 BM2）：**
- ❌ Campaign 管理 / 新建活动
- ❌ 邮件触达（/outreach）
- ❌ CRM 关系管理
- ❌ ROI 追踪
- ❌ AI 周报
- ❌ 竞品分析 / 设置 / 订阅定价

## 2. 范围

### In Scope

1. **F001** — Prisma schema 扩展：Product 新表 + Kol 扩展（价值分 / 标签 / relationshipStatus / isSaved / 15 维 filter 字段 nullable，实际 ADD 13 列，4 维沿用 B0）+ KolCampaign.kolFee（BM2 用但 schema 一起做，matchScore 已在 B0）
2. **F002** — KOL seed 脚本：`docs/kol-seed-enriched-final.json`（415 gaming + 2109 non-gaming）入库 demo tenant
3. **F003** — Product 知识库页（`/knowledge-base`）：录入表单 + 卡片网格 + AI 生成推广素材（调 aigcgateway）
4. **F004** — KOL Discovery 筛选页（`/discovery`）：15 维 filter UI + 价值分 AI 计算 + 保存到候选
5. **F005** — KOL Database 列表（`/database`）：已保存 KOL + cursor 分页（用 BI4-F004）
6. **F006** — KOL 画像页（`/kols/:id` 或 `/kol-profile`）：详情 + 合作历史（empty BM1）+ 沟通记录（empty）
7. **F007** — 控制台真数据对接（`/`）：原 dashboard 5 区块 KPI 从 DB 查（替换掉 B0 mock）
8. **F008** — Browser locale auto-detection + en/zh i18n keys 补齐
9. **F009** — Tests + Visual regression baselines（F003/F004/F005/F006/F007 都加 baseline）

### Out of Scope
见 §1 Out of Scope。

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| KOL 价值分公式 | MVP 用**加权简单公式**，aigcgateway 只做标签生成不算价值分 | MVP 数据稀疏，AI 算价值分意义不大；公式透明可解释 |
| 价值分算法 | `raw = followerScore(log10×15, cap 50) + engagementScore(固定 15) + categoryScore(count×8, cap 20)` → `total = round(raw × 100 / 85)`（归一化 0-100，落 `value_score` 列）| log 缩放 + 固定 engagement + 多分类奖励；归一化对齐 §7.2 决议 E + 行业惯例（Modash/HypeAuditor 0-100） |
| AI 匹配分 | **不做 MVP**（保留 KolCampaign.matchScore 字段但不计算）| MVP PRD §11 已定，留 B2 embedding |
| Product 字段必填 | `uniqueSellingPoints` **强制必填**（zod required）| MVP PRD §13 Q5 决策 |
| AI 素材生成 | 用 aigcgateway `chat` API 直连（非 Action，避免前置依赖）| BM1 不等 Planner 建 Action；BM2 统一改为 Action 调用 |
| AI 生成产物 | 3 套 email template + 2 套 video script（文本）；不生成图片（远期）| Product USP 录完即可一键生成；存 `Product.aiAssets` JSON |
| KOL seed 数据范围 | 415 gaming 入库，2109 non-gaming 也入库但 `isGaming=false`（filter 默认隐藏）| 保留原始数据供未来补标签；默认不干扰 MVP demo |
| KOL 归属 tenant | demo tenant "Demo Studio"（seed 创建）| 所有 KOL 归属 demo tenant，真实 tenant MVP 后 B5 评估如何跨租户共享 KOL 库 |
| Browser locale detection | next-intl 原生 `localeDetection: true` | 配置级开启，无代码；检测 Accept-Language 匹配 en/zh，其他回退 en |
| 列表分页 | cursor（用 BI4-F004 util）| 2524 数据不大但 future-proof |
| Filter UI 布局 | 基础 filter（粉丝 / 地区 / 类目 / 搜索）平铺；11 维高级 filter 折叠在 "Advanced" 下拉 | 符合 Stitch kol-discovery 设计 + Modash/HypeAuditor 行业惯例 |
| 控制台 KPI | 5 块：KOL 总数 / 活跃 campaigns（BM1 直接显示 0）/ 邮件（0）/ Product 数 / 平均 KOL value | 无 campaigns/emails 时显示 "—" 或 0；BM2 填 |

## 4. 功能列表（9 项，全 executor:generator）

### F001 — Prisma schema 扩展 + migration

**实现：**

`prisma/schema.prisma` 改动：

```prisma
// 新增 Product 表
model Product {
  id                    String    @id @default(cuid())
  tenantId              String    @map("tenant_id") @db.Uuid
  name                  String
  category              String    // MOBA / RPG / FPS / 手游 / 二次元 / 沙盒 / ...
  targetAudience        String?   @map("target_audience") @db.Text
  uniqueSellingPoints   String    @map("unique_selling_points") @db.Text  // 必填
  downloadUrl           String?   @map("download_url")
  launchDate            DateTime? @map("launch_date") @db.Date
  aiAssets              Json?     @map("ai_assets") @db.JsonB
  // aiAssets 结构：
  //   { emailTemplates: [{subject, body}, ...3 个],
  //     videoScripts: [{title, script}, ...2 个],
  //     generatedAt, cost, traceId }
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@map("product")
}

// Kol 扩展（在现有 Kol model 内加字段）
model Kol {
  // ...existing fields: id, tenantId, platform, handle, display_name, country_code, categories, follower_count, etc.
  // 新增字段：
  valueScore            Int?       @map("value_score")           // 0-100 公式算出
  tags                  String[]   @default([])                  // AI 标签/人工标签并用
  relationshipStatus    String     @default("prospect") @map("relationship_status") @db.VarChar(20)
  // enum app-level: prospect / first_contact / negotiating / long_term / paused / terminated

  // 15 维 filter：其中 4 维沿用 B0 已有列（language / engagement_rate / avg_views /
  // audience_age_dist+geo_dist+gender_dist 三字段），本次只 ADD 11 个 nullable 预留列：
  // （Planner 裁决 #A/#B/#C：skip 已存列 + 沿用 avgViews + 沿用 3 个 audience_*_dist Json 列）
  uploadsPerMonth       Int?       @map("uploads_per_month")
  lastUploadAt          DateTime?  @map("last_upload_at")
  monetizationStatus    String?    @map("monetization_status") @db.VarChar(20)
  // enum app-level: VERIFIED / MONETIZED / NONE
  brandSafetyRating     String?    @map("brand_safety_rating") @db.VarChar(8)
  // enum: G / PG / PG13 / R
  knownBrandCollabs     String[]   @default([]) @map("known_brand_collabs")
  engagementAuthenticity Int?      @map("engagement_authenticity")
  isGaming              Boolean    @default(true) @map("is_gaming")
  isSaved               Boolean    @default(false) @map("is_saved")
  // isSaved：/discovery 勾保存 → true；/database 只显示 true 的

  // AI 打标 metadata（用于未来 B1 re-tagging）
  aiTaggedAt            DateTime?  @map("ai_tagged_at")
  aiTagConfidence       String?    @map("ai_tag_confidence") @db.VarChar(8)
  // enum: high / medium / low
}

// KolCampaign 扩展（BM1 不用但 schema 一起做，BM2 F001 不用再改表）
// 注：model 名为 KolCampaign（对齐 B0 schema，spec 旧稿笔误 "CampaignKol"）
model KolCampaign {
  // ...existing fields（含 match_score 已有，裁决 #A skip）
  kolFee                Decimal?   @map("kol_fee") @db.Decimal(10,2)
  // status 现有（pending/contacted 等），BM2 F001 按需扩
}
```

Migration `prisma/migrations/20260424100000_bm1_schema/migration.sql`：
- CREATE TABLE product + 索引 + RLS policy（NULLIF 兜底）
- ALTER TABLE kol ADD COLUMN 13 个 nullable fields + default values（11 个 15 维 filter 预留 + `valueScore/tags/relationshipStatus/isSaved`，其中 isSaved/isGaming 有默认值）
- ALTER TABLE kol_campaign ADD COLUMN `kol_fee` Decimal(10,2) NULL（`match_score` 已存，裁决 #A skip）
- CREATE INDEX `kol_tenant_gaming_value_idx` (tenant_id, is_gaming, value_score DESC) + `kol_tenant_saved_idx` (tenant_id, is_saved)（裁决 #F）
- Migration 头部加注释说明裁决 #A/#B/#C 跳过 / 沿用已有列（见 audit §7.4 #1）
- **ROLLBACK SQL** 完整（F007 CI 校验强制）
- 对 kol 的 tsvector trigger function（BI4-F005 定义）**无需改**，只涉及新增字段不影响 trigger 的 NEW.display_name/handle/categories/bio 字段（保持不变）

注意：按 `framework/harness/database-patterns.md §1` 如将来加 RLS 策略必须用 `NULLIF(..., '')::uuid` 兜底。本批次 Product 表加 RLS（多租户）：

```sql
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

**Acceptance：**
- `npx prisma migrate dev` 本地 + `migrate deploy` Testcontainers 通过
- F007 CI ROLLBACK 校验通过
- `tests/integration/bm1-schema.test.ts` 覆盖：Product CRUD + RLS 跨租户隔离 / Kol 新字段读写（核心 5 点：valueScore + isGaming + isSaved + relationshipStatus + tags[]，其他 11 维 nullable filter 字段通用循环）/ KolCampaign.kolFee 读写

### F002 — KOL seed 脚本入库 415 gaming + 2109 non-gaming

**实现：**

`scripts/seed-kol-from-enriched.ts` 新建：
- 读 `docs/kol-seed-enriched-final.json`
- 对每条 KOL 做 upsert（唯一键 `tenantId + platform + handle`）
- 字段映射：
  - `platform: "Youtube"` → normalize 到 lowercase `"youtube"` 存入 `Kol.platform String` 列（裁决 #D：DB 保持 String，应用层 `src/lib/kol/platform.ts` 定义 `KolPlatform` union + Zod enum 做静态 + 运行时校验）
  - `name` → `display_name`
  - `url` → parse 出 handle（`@xxx` 部分）
  - `region` → 中文国名 map 到 ISO 2-letter（美国→US，英国→GB，巴基斯坦→PK，加拿大→CA，德国→DE，越南→VN，台湾→TW，乌克兰→UA，日本→JP，伊拉克→IQ，多米尼加→DO）
  - `followers` → `follower_count`
  - `is_gaming` → `isGaming`
  - `categories`（gaming）→ 在 Kol.categories 数组，不是 GameCategory 关联表（MVP 简化）
  - `confidence` → `aiTagConfidence`
  - `reasoning` → 丢弃（占空间，debug 用保留在 JSON 不落库）
  - `aiTaggedAt` = 脚本运行时间
  - `valueScore` = 按决策公式算（§3）
- tenantId 固定用 demo tenant UUID（B0 seed 已建）
- 在 prisma.config.ts 注册为 `seedKolCommand`
- `package.json` 加 script：`"seed:kol": "tsx scripts/seed-kol-from-enriched.ts"`

价值分公式实现（§3 选项，裁决 #E 归一化 0-100）：

```typescript
// src/lib/kol/value-score.ts — pure function，F002 seed + 未来 UI breakdown 复用
export interface KolValueScoreResult {
  total: number;                      // 归一化 0-100，落 value_score 列
  rawBreakdown: {
    follower: number;                 // raw 0-50（UI hover tooltip 用）
    engagement: number;               // raw 15 固定
    category: number;                 // raw 0-20
  };
}

export function computeKolValueScore(kol: {
  followerCount: number;
  categories: string[];
}): KolValueScoreResult {
  // followerCount log 缩放到 0-50 分
  const followerScore = Math.min(50, Math.log10(Math.max(kol.followerCount, 100)) * 15);
  // engagement 固定占位（真实数据从 YouTube API 来，MVP nullable）
  const engagementScore = 15;
  // categories 多样性奖励（1 类 8，2 类 16，3+ 类封顶 20）
  const categoryScore = Math.min(20, kol.categories.length * 8);
  const raw = followerScore + engagementScore + categoryScore; // max 85
  return {
    total: Math.round((raw * 100) / 85),                        // 归一化 0-100
    rawBreakdown: {
      follower: Math.round(followerScore),
      engagement: engagementScore,
      category: categoryScore,
    },
  };
}
```

F002 seed 写库调用：`const { total } = computeKolValueScore({ followerCount, categories }); row.valueScore = total;`

**Acceptance：**
- `npm run seed:kol` 跑完后 `prisma.kol.count()` = 2524
- 415 条 `is_gaming=true`
- gaming KOL 的 `value_score` 分布合理（spot-check 粉丝大的高于小的）
- 非 gaming KOL 的 `value_score` 也算但 `is_gaming=false`
- Idempotent：再跑一次 count 仍 2524（upsert by unique 键）
- `tests/integration/kol-seed.test.ts` 覆盖：count / is_gaming 分布 / value_score 非 null

### F003 — Product 知识库页（`/knowledge-base`）

**实现：**

Page：`src/app/[locale]/(app)/knowledge-base/page.tsx` + 子组件。

**布局（对齐 Stitch `knowledge-base.html`）：**
- Canonical App Shell（sidebar 8 项，active=Knowledge Base）
- Page header：H1 "产品知识库 / Product Knowledge Base" + 副标 + "+ Add new product" 主按钮
- SECTION A：3-col 产品卡片网格 + 1 empty-state "Add new" 卡
  - 每张卡：名字 + category pill + audience + USP（2 行截断）+ 3 个 status chips（email templates / video scripts / image prompts）+ Last updated + Edit/Regen icons
- SECTION B：Recent AI activity timeline（5 个 mini event 横向 scroll）
- SECTION C（在 click Add 或 Edit 时弹出）：Create/Edit product modal
  - 8 字段表单（name required * / category required * / targetAudience optional / **uniqueSellingPoints required *（cyan 星号）** / downloadUrl optional / launchDate optional / platforms multi-select / "Generate assets immediately after save" checkbox）
  - Actions: Cancel ghost / "Save & Generate" primary cyan

**Server Action `createProduct(formData)`:**
1. Zod 校验（uniqueSellingPoints 强制 required）
2. Prisma create
3. 如 "Generate assets" checkbox 勾：
   - 异步调 aigcgateway `chat` API 生成 emailTemplates + videoScripts
   - 存到 `Product.aiAssets` JSON
   - Fire-and-forget + 更新 status（完成时 UI 轮询或 revalidatePath）
4. 返回新产品 id + redirect 到详情或 list

**AI 生成 prompt 草案（内嵌在 Server Action，BM2 改为 aigcgateway Action）：**

```
System: You are a marketing copywriter for gaming KOL outreach. Generate promotional assets for a game product.
User: Product name: {name}
      Category: {category}
      Target audience: {targetAudience}
      Unique selling points: {uniqueSellingPoints}
      Download URL: {downloadUrl}

      Generate exactly:
      - 3 email templates (for initial KOL outreach / follow-up / signing invitation): each with {subject, body} in markdown
      - 2 video scripts (for 60-second YouTube promo / 15-second TikTok short): each with {title, script}

      Output strict JSON: { emailTemplates: [{subject, body}, ...], videoScripts: [{title, script}, ...] }
```

模型选 `claude-haiku-4.5`（质量 + 成本平衡）。预估单次 $0.02-0.05。

**i18n keys：** `knowledge-base.*` 全齐（title / subtitle / addButton / categoryOptions / formLabels / errors / generatingStatus...）。

**Acceptance：**
- `/en/knowledge-base` + `/zh/knowledge-base` 渲染 + 对齐 Stitch 设计 ±2px
- 空状态 "Add new" 卡点击弹 modal
- 录入 Honor of Kings 范例产品（USP 留空 → 报红字 "required"）
- USP 填完 → Save & Generate → 进度 chip 显示 "⏳ Generating..." → 完成后变 "✓ 3 email templates"
- Product.aiAssets JSON 结构正确（3 emails + 2 scripts + meta）
- 生成失败（aigcgateway 挂）UI 显示 "Generation failed - retry" + 产品本身已保存
- RLS 生效：另一 tenant 看不到本 tenant 的 product

### F004 — KOL Discovery 筛选页（`/discovery`）

**实现：**

Page：`src/app/[locale]/(app)/discovery/page.tsx`。

**布局（对齐 Stitch `kol-discovery.html`）：**
- Canonical App Shell，active=KOL Discovery
- Header：H1 "KOL 发现 / Discover KOLs" + 副标 "AI 智能搜索并匹配适合您游戏的全球 KOL/KOC"
- Filter 侧栏（左 260px）：
  - 基础 filter 平铺：粉丝数 range slider / 地区 multi-select / 类目 multi-select / 搜索 input
  - **"Advanced filters"** 折叠面板含 11 维剩余：语言 / 互动率 / 平均播放 / 上传频率 / 最近活跃 / 变现状态 / Brand safety / 历史合作 / 标签 / 平台 / is_gaming toggle
  - MVP 默认 `is_gaming=true` filter 激活
- Content 区（右）：
  - 结果卡片网格 2-3 col（响应式）
  - 每张卡：头像（placeholder 渐变 + 首字母）/ 名字 / 平台·粉丝·地区·互动率（若有）/ **价值: 92 分**（cyan）/ 标签 chips / 保存按钮
  - Cursor pagination（用 BI4-F004 util），限 20/页
  - Empty state: "未找到符合的 KOL。提示：互动率 / 变现状态 等维度数据将在 YouTube API 集成后（B6 批次）填充。"
- Header 右边：排序 dropdown（粉丝数 / 价值分 / 最近添加）+ "保存所有结果为新候选组" ghost button

**Server Action `searchKols(filters, cursor)`:**
- 15 维 filter 组合查询
- 用 Prisma where + BI4-F004 cursor paginator
- 返回 `{ items, nextCursor, hasMore, total }`

**i18n keys：** `discovery.*` 齐全。

**Acceptance：**
- `/en/discovery` 渲染 + 15 维 filter UI 全显示（基础 4 平铺 + 11 高级折叠）
- 默认 filter `isGaming=true` → 415 条 gaming 结果
- 选 "美国" + 粉丝 1K-5K → 结果减少到 ~100 条左右
- 选 "MOBA" → 结果稀疏（~9 条，空态正常显示）
- 选 "engagementRate >= 5%" → 0 结果 + empty-state 友好提示
- 搜索 "Nintendo" → fuzzy 匹配 display_name/handle 命中
- 分页 next/prev 正常
- 保存 → 写 `is_saved=true` 字段（在 Kol 表加 `@map("is_saved")` boolean default false）

**⚠️ Schema 小补：F001 加 Kol.isSaved（本批次用，用户勾保存才出现在 `/database` 列表）**

### F005 — KOL Database 列表（`/database`）

**实现：**

Page：`src/app/[locale]/(app)/database/page.tsx`。

**布局（对齐 Stitch `kol-database.html`）：**
- Canonical App Shell，active=KOL Database
- Header：H1 "KOL 数据库" + 副标 "已保存的 KOL 候选"
- 右上：批量操作 dropdown（标签 / 状态流转 / 删除 —— MVP 只做 UI skeleton，批量实际功能 BM2）
- Filter 简化版（4 维：类目 / 地区 / 状态 / 搜索），不含 Advanced
- 表格：| 头像名字 | 平台 | 粉丝 | 类目 | 地区 | 价值 | 关系状态 | 添加时间 | actions |
- 行点击跳 `/kols/:id`
- Cursor pagination

**Server Action `listSavedKols(filters, cursor)`:**
- `where: { tenantId, isSaved: true, ...filters }`

**Acceptance：**
- `/en/database` 渲染
- 只列 `isSaved=true` 的 KOL
- `/discovery` 保存一个 KOL → 出现在 `/database`
- 行点击跳 `/kols/:id`
- MVP 批量操作按钮可见但点击显示 "Coming soon" tooltip（F006+ 不做深功能）

### F006 — KOL 画像页（`/kols/:id`）

**实现：**

Page：`src/app/[locale]/(app)/kols/[id]/page.tsx`。

**布局（对齐 Stitch `kol-detail.html`）：**
- Canonical App Shell，active=KOL Database 或 Discovery
- 顶部：返回按钮 + 头像 + 名字 + 平台 + 粉丝 + 地区
- Tab bar: "Overview / 合作历史（empty BM1）/ 沟通记录（empty）/ AI 价值分析（BM2）"
- Overview tab：
  - 基础信息卡（platform / handle / country / language / followerCount / engagementRate / 最近活跃 / 标签 / 简介 bio）
  - AI 价值分大块：`valueScore` cyan 大字 + 简单解释（"Based on follower size + engagement + content diversity"）
  - 合作状态：`relationshipStatus` 6 个枚举可下拉手动调整（MVP 只改 status 不记录事件，BM2 加 CRM 事件）
  - "保存到候选" / "取消保存" toggle（isSaved 字段）

**其他 tabs 显示 empty-state：** "合作历史 / 沟通记录将在创建 Campaign 后展示（BM2）"。

**Acceptance：**
- `/en/kols/{id}` 渲染有效 KOL id → 显示 Overview
- 空 id → 404
- 关系状态下拉可更改 + 持久化到 DB
- 保存/取消保存 toggle 正常
- 设计稿对齐 ±2px

### F007 — 控制台真数据对接

**实现：**

Page：`src/app/[locale]/(app)/page.tsx`（B0 F007 已建）修改：

- 5 块 KPI：
  1. KOL 总数（所有 tenant 的 Kol count where isGaming=true）
  2. 活跃 campaigns（MVP = 0，写 `—` 或 "Coming in BM2"）
  3. 邮件触达（MVP = 0）
  4. Product 数（`product` 表 count by tenant）
  5. 平均 KOL 价值分（gaming KOL `valueScore` AVG）
- TOP KOL 合作概览列表（MVP 显示 top-5 by valueScore，实际"合作次数"是 0）
- 快捷操作 4 按钮保持（跳对应页）
- "平台工作流" 6 步图保持（产品叙事展示用，不改）
- 核心能力 6 条保持

**Acceptance：**
- Dashboard 显示真 KPI（KOL count = 415 / Products = 0 → N/A）
- TOP KOL 按 valueScore 倒序 top 5
- 快捷操作点击跳转正确

### F008 — Browser locale auto-detection + i18n 键补齐

**实现：**

1. `next-intl/config.ts` or routing：设置 `localeDetection: true`（检测 Accept-Language）
2. 根路由 `/` 未命中 locale 时自动 302 到匹配的 `/en/` 或 `/zh/`
3. 其他 locale (`ja/ko/es`) 回退 en
4. `messages/en.json` + `messages/zh.json` 本批次所有新页面 keys 全齐
5. `messages/{ja,ko,es}.json` 加 key stub（值 = en 原文 + TODO 标记）

**Acceptance：**
- Chrome 语言设中文 → 访问 https://... / → 跳 /zh/dashboard
- 语言设日语 → 回退 /en/dashboard（因为 ja 未翻译）
- manual 切换语言后 cookie 记住（next-intl 原生支持）
- zh.json 所有 keys 译 professional

### F009 — Tests + Visual regression baselines

**实现：**

Unit tests：
- `src/app/[locale]/(app)/knowledge-base/__tests__/*.tsx`（Product form / modal / list）
- `src/app/[locale]/(app)/discovery/__tests__/*.tsx`（Filter / card / pagination）
- `src/app/[locale]/(app)/database/__tests__/*.tsx`
- `src/app/[locale]/(app)/kols/__tests__/*.tsx`
- `src/lib/kol/__tests__/valueScore.test.ts`（公式单测）
- `src/lib/products/__tests__/generateAiAssets.test.ts`（aigcgateway mock）

Integration tests：
- `tests/integration/product-flow.test.ts`（create product → AI assets 写入）
- `tests/integration/kol-discovery.test.ts`（15 维 filter 组合查询）
- `tests/integration/kol-database.test.ts`（isSaved 保存流）
- `tests/integration/dashboard-kpi.test.ts`（Dashboard 数据正确）

E2E tests：
- `tests/e2e/bm1-flow.spec.ts`：登录 → 录入 Product → 发现 KOL → 保存 → 看 Database → 点 KOL → 看画像

Visual regression baselines（F009 机制 BI1 已定）：
- `/en/dashboard` baseline 更新（已有）
- `/en/knowledge-base` 新 baseline
- `/en/discovery` 新 baseline
- `/en/database` 新 baseline
- `/en/kols/{known-id}` 新 baseline

**Acceptance：**
- test:unit 新增 ≥ 25 cases 全绿
- test:integration 新增 ≥ 8 cases 全绿
- test:e2e 新增 1 文件 1 flow（8-10 steps）全绿
- coverage lines ≥ 80% 维持
- CI 8 jobs 全绿
- Visual regression 5 张新 baseline 入库

## 5. 依赖关系

```
F001 Schema ─────────┐
                     ├─► F002 Seed (依赖 F001)
                     │
                     ├─► F003 Knowledge Base UI (依赖 F001 Product 表)
                     │
                     ├─► F004 Discovery (依赖 F001 + F002)
                     │   │
                     │   └─► F005 Database (依赖 F004 isSaved)
                     │       │
                     │       └─► F006 Profile (依赖 F004/F005)
                     │
                     └─► F007 Dashboard (依赖 F001/F002)

F008 Locale detection 独立（基础设施级），可任意顺序
F009 Tests 最后聚合所有
```

**强制执行顺序：** F001 → F002 (seed) → F003 / F004 并行 → F005 → F006 → F007 → F008 → F009

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| aigcgateway 生成慢/失败 | AI 素材生成 async + fallback 空结构（显示 "Generation failed, retry"）；用户可手动重试 |
| Product.aiAssets JSON 结构随产品演进 | MVP 定 schema；future 改字段时迁 B2 评估 |
| 415 条 gaming KOL 对 MVP 演示类目稀疏（MOBA/二次元/沙盒 < 10）| demo 策略集中推 Casual + FPS 类目；团队异步补数据（见 MVP PRD §14 风险）|
| browser locale detection 和 BAux1 登录流程冲突 | BAux1 已处理 `/login` middleware 跳转；F008 只改未登录根路径行为 |
| KOL valueScore 公式透明度差 | 卡片 hover 显示 breakdown（followers 50 + engagement 15 + categories 16 = 81），FAQ 加一段 |
| Testcontainers 容器内 tsvector trigger 测试慢 | 继续用 BI1 的 colima-detect helper，trigger 执行本来就 fast |
| BM1 spec 9 features 过大一轮做不完 | 如 Reviewer 报 fix rounds 超 3 轮，Planner 拆 BM1.5 hotfix 批次；bar 现阶段不过于保守 |

## 7. 验收方式（Evaluator 阶段）

Reviewer 执行：

### L1 自动化
- `npm run test:coverage` + `test:integration` + `test:e2e` 全绿
- `npm run lint` + `npx tsc --noEmit` 无错
- `bash scripts/validate-rollback-sql.sh` 通过
- CI 8 jobs 全绿
- Visual regression 5 张新 baseline 对齐

### L2 功能验证（staging）
- `/en/knowledge-base` 录入 test Product "Honor of Kings" → AI 素材生成成功
- `/en/discovery` 15 维 filter 各走一遍
- `/en/database` 保存流 + 批量按钮 disabled
- `/en/kols/{id}` 画像页
- `/en/dashboard` 真 KPI
- 浏览器中文切 → 自动跳 /zh/
- **VPS artifact in-git check（framework v0.9.3 新要求）**：`git ls-files scripts/seed-kol-from-enriched.ts` 非空

### L3 视觉
- 5 张新 page 对照 Stitch 设计 ±5px
- 中英文 layout 不错位

## 8. 引用文档

- `docs/product/KOLMatrix-MVP-PRD.md`（MVP 决策源头）
- `docs/specs/BI4-architectural-guardrails-spec.md`（复用 Job Queue / cursor / tsvector / event_log / audit_log）
- `framework/harness/database-patterns.md`（§1 RLS NULLIF, §2 migration 命名）
- `framework/harness/deploy-patterns.md`（§1 PM2 zero-downtime, §2 VPS artifact in-git 签收）
- `docs/kol-seed-enriched-final.json`（seed 数据源）
- Stitch 参考：`design-draft/stitch-references/{dashboard,kol-discovery,kol-database,kol-detail,knowledge-base}.html + .png`

## 9. 启动检查清单（Generator 开工前）

- [x] BI4 status=done（已签收 2026-04-23）+ framework v0.9.3 归档 ✅
- [x] 本 spec 用户确认范围 ✅ 2026-04-23
- [x] role_assignments 设置（Planner: Kimi / Generator: johnsong / Evaluator: Reviewer）
- [x] KOL seed 数据已入库 `docs/kol-seed-enriched-final.json`
- [x] Stitch 设计稿 5 张就绪（dashboard / kol-discovery / kol-database / kol-detail / knowledge-base）
- [x] BI4 基建 helper 可用（cursor pagination / event_log / audit_log / Job Queue / tsvector）

## 10. 完成后效果

BM1 上线后：
- Marketer 登录 → 看 dashboard（真数据）→ 进知识库录入自家游戏 Product → 进 Discovery 筛 KOL → 保存到 Database → 点进画像页看详情

**完整 MVP 4 功能中 2 个（控制台 + 筛选 KOL）达成**。另 2 个（联系 + ROI）留 BM2。

Planner 并行动作：BM1 building 期间起草 BM2 spec + 创建 aigcgateway 3 个 Action（kol-email-customize / roi-insights / weekly-report-for-client），BM2 启动时零前置阻塞。
