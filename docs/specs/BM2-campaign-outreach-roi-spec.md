---
name: BM2 Campaign + 联系 + CRM + ROI + AI 周报
description: MVP 业务批次 2/2 — 把 KOL 库变成真实营销工作流（新建 Campaign → 联系 KOL → 跟踪关系 → 复盘 ROI → 周报给客户看）
status: draft
created_by: johnsong (Planner)
created_at: 2026-04-23
---

# BM2 — Campaign + 联系 + CRM + ROI + AI 周报

## 1. 背景与目标

BM1 把"发现并保存 KOL"的工作流做完了（控制台 + 知识库 + Discovery + Database + 画像）。BM2 接上游下游：**把 KOL 库变成一次真实的营销活动**——创建 Campaign → 关联 Product 和 KOL → 通过邮件触达 → 用 CRM 跟踪关系演变 → 复盘 ROI → 一键生成客户可看的周报。

完成后 **MVP 4 大功能全达成**（控制台 ✅ BM1 / 筛选 KOL ✅ BM1 / **联系 KOL** ← BM2 / **ROI 追踪** ← BM2），MVP 可以上线拿种子用户。

**核心 Journey（PRD §5 Journey A + B 的 BM2 部分）：**

```
Journey A 续：/discovery 保存的 KOL
  → /campaigns/new 新建 Campaign（关联 Product）
  → /campaigns/:id 把保存的 KOL 加进 Campaign + 录 kolFee
  → /outreach 选模板 + AI 定制 + 发给有 email 的 KOL
  → CampaignKol.contactStatus='contacted' + Resend 发出

Journey B：Campaign 结束后
  → /campaigns/:id 录 revenueRecorded → 状态切 completed
  → /roi 看全局 ROI + 趋势 + AI Insights
  → /weekly-report 一键生成客户周报 + PDF 导出 + 分享链接
```

## 2. 范围

### In Scope

1. **F001** — Prisma schema 扩展：Campaign（+ productId/budget/spendTotal/revenueRecorded/status/startedAt/closedAt）+ KolCampaign（+ contactStatus 6 状态枚举；kolFee 已在 BM1 ADD）+ CampaignMetric 新表 + EmailTemplate 新表 + migration + ROLLBACK SQL
2. **F002** — EmailTemplate seed：5 套系统固定模板（初次询价 / 跟进 / 签约邀请 / 拒绝跟进 / 已合作回访）
3. **F003** — Campaigns 列表页 `/campaigns`（对齐 `campaigns-list.html`）
4. **F004** — Campaign 新建页 `/campaigns/new`（表单 + 创建后跳详情）
5. **F005** — Campaign 详情页 `/campaigns/:id`（KOL 面板 + Revenue 录入 + 状态切换 + ROI 展示；对齐 `campaign-detail.html`）
6. **F006** — 邮件触达页 `/outreach`（Resend 集成 + AI 定制 + EmailLog + contactStatus 更新；对齐 `email-center.html`）
7. **F007** — CRM 简化页 `/crm`（阶段分布 + 漏斗 + 合作总额 + relationshipStatus 切换；对齐 `crm-relationship.html`）
8. **F008** — ROI 引擎（`src/lib/roi/compute.ts` util + `GET /api/roi/summary` API，纯计算）
9. **F009** — ROI 追踪页 `/roi`（4 KPI + 趋势图 + Campaign ROI 表 + AI Insights 卡片；对齐 `roi-tracking.html`）
10. **F010** — AI 周报页 `/weekly-report`（一键生成 + PDF 导出 + 分享链接；对齐 `weekly-report.html`）
11. **F011** — Tests + Visual regression baselines（6 个新页面）

### Out of Scope（MVP 不做）

- 邮件模板编辑器（B4）
- 邮件发送队列监控页（B4）
- 退订管理自动化 + Resend webhook（B4；MVP 用邮件底自然语言 opt-out 人工处理）
- 打开率 / 回复率追踪（B4 webhook）
- 竞品分析（B10）
- GA4 / Shopify / Meta Ads 自动 ROI 追踪（MVP 手动录入）
- 客户协同筛选页（B7）
- Calendar / Gantt 视图（B3+）
- 活动甘特图

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| Resend 集成方式 | F006 真接入 Resend API（`marketer@kolquest.com`）；dev 无 RESEND_API_KEY 时 fallback 到日志 mock | 根域已 BI3-F005 verified；PRD §10.2 定义发件策略；MVP 必须真发邮件否则 Journey A 断链 |
| 发送速率 | 10 msg/min 前端排队 + 后端简单 sleep（非 BullMQ real worker）| PRD §10.2 限速；MVP Job Queue 是 stub，B2 做真 worker |
| AI 定制邮件 UI | 用户选模板后点 "AI 定制" → 弹层显示"AI 版 vs 原版"对比 → 选一个发 / 可手动编辑 | 透明 + 可干预，符合 PRD §2.2 成功指标"AI 定制邮件采纳率 ≥ 40%" |
| AI Insights 触发 | /roi 页 "Generate Insights" 按钮手动触发 + 结果缓存到 localStorage 当日有效；不每次访问都调 | 控制 aigcgateway 成本；用户有明确感知 |
| CRM KOL 状态切换 | 按钮 + select 下拉（不做拖拽）| 简单可靠，Stitch 设计里就是按钮；拖拽 edge case 多 |
| PDF 导出方式 | 浏览器 print-to-PDF + 专用 `@media print` stylesheet（无 react-pdf 服务端依赖） | MVP 零后端成本；周报页本来就优化了单页布局 |
| 周报分享链接 | 独立 `WeeklyReport` 表快照 contentMd + summaryJson + shareToken，`/shared/weekly-report/:token` 路由，7 天有效期 + no-index meta；匿名查询仅 4 列 + 不 join tenant | 客户不登录就能看；token 失效后 404；SEO 安全；匿名页零 tenant 横向越权面 |
| Revenue 录入锁定 | Campaign.status=completed 后 revenueRecorded 字段 disabled（可切回 active 修改）| 防误操作导致 ROI 看板数据抖动；可逆不强锁 |
| contactStatus 状态机 | 6 值线性 + 跳跃：pending → contacted → quoted → signed → delivered → paid（允许跳到任意靠后状态；不许回退）| 营销实际流程，允许"签约后直接 paid"跳过 delivered 展示 |
| Campaign KOL 选择范围 | 只能从 `Kol.isSaved=true`（即 BM1 /database 里的）选 | 保证用户先 discovery 保存，再 campaign，符合 Journey A |
| ROI 单位 | 所有金额统一 USD + 基础货币换算接口预留（MVP 不多币种）| 游戏出海美元结算场景 |
| 空态设计 | 所有列表/看板都有友好空态插画 + 引导"去创建"按钮 | 种子用户首次使用不会被空数据吓到 |
| aigcgateway Action 用法 | F006/F009/F010 调 Planner 预建的 3 个 Action（`kol-email-customize` / `roi-insights` / `weekly-report-for-client`）| ADR-009 已定；避免 F006 里 hardcode 提示词 |

## 4. 功能列表（11 项，全 executor:generator）

### F001 — Prisma schema 扩展 + migration

**实现：**

`prisma/schema.prisma` 改动（在 BM1 schema 基础上）：

```prisma
// Tenant 扩展（加 logo 字段供周报品牌 header 用）
model Tenant {
  // ...existing: id / name / slug / plan / createdAt / updatedAt
  logoUrl   String?  @map("logo_url")        // 可为 CDN URL 或 data: URL（MVP 手动录入）

  // ...existing relations 加：
  // weeklyReports  WeeklyReport[]
}

// Kol 扩展（补 email — seed JSON 无 email，MVP 用户在 /outreach 或 KOL 画像页手动补）
model Kol {
  // ...existing BM1 schema
  email       String?  @db.VarChar(320)       // KOL 联系邮箱，null = 只能手动 YouTube 私信
  emailSource String?  @default("manual") @map("email_source") @db.VarChar(20)
  // email_source: manual / youtube-about / ai-extracted（MVP 仅 manual）
}

// Campaign 扩展（在现有 Campaign model 内加字段）
model Campaign {
  // ...existing B0 fields: id, tenantId, name, game, markets, status, budgetAmount,
  //                        budgetCurrency, kpiTarget, startDate, endDate, ownerUserId, openRate

  // 新增字段（BM2）：
  productId             String?    @map("product_id") @db.Uuid         // 关联 BM1 Product
  spendTotal            Decimal    @default(0) @map("spend_total") @db.Decimal(12, 2)  // Σ KolCampaign.kolFee 聚合
  revenueRecorded       Decimal?   @map("revenue_recorded") @db.Decimal(12, 2)
  startedAt             DateTime?  @map("started_at") @db.Timestamptz
  closedAt              DateTime?  @map("closed_at") @db.Timestamptz

  product               Product?   @relation(fields: [productId], references: [id])
  @@index([tenantId, productId])
  @@index([tenantId, status, closedAt(sort: Desc)])   // ROI 查询
  // 现有 @@index([tenantId, status, startDate]) 保留
}

// WeeklyReport 新表（周报快照 + 分享 token）
model WeeklyReport {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId              String    @map("tenant_id") @db.Uuid
  weekStart             DateTime  @map("week_start") @db.Date
  weekEnd               DateTime  @map("week_end") @db.Date
  locale                String    @default("en") @db.VarChar(5)
  contentMd             String    @map("content_md") @db.Text            // aigcgateway 返回的 markdown
  summaryJson           Json?     @map("summary_json") @db.JsonB          // 结构化输入快照（debug / 重渲染）
  shareToken            String?   @unique @map("share_token") @db.VarChar(32)
  shareTokenExpiresAt   DateTime? @map("share_token_expires_at") @db.Timestamptz
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  createdByUserId       String    @map("created_by_user_id") @db.Uuid

  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  createdBy             User      @relation(fields: [createdByUserId], references: [id])

  @@index([tenantId, weekEnd(sort: Desc)])
  @@map("weekly_report")
}

// KolCampaign 扩展（已 BM1 加 kolFee；BM2 加 contactStatus 规范枚举）
model KolCampaign {
  // ...existing BM1 fields
  // 现有 status String @default("candidate") 改语义 + 值域规范
  // app-layer enum: pending / contacted / quoted / signed / delivered / paid
  // contactStatus 复用现有 status 列，不新建（避免 schema 污染）
  // 改动：default 从 "candidate" 改 "pending"
}

// CampaignMetric 新表（ROI 时序数据粒度，MVP 手动 + 预留 B2 自动）
model CampaignMetric {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId          String    @map("tenant_id") @db.Uuid
  campaignId        String    @map("campaign_id") @db.Uuid
  recordedAt        DateTime  @default(now()) @map("recorded_at") @db.Timestamptz
  impressions       Int?
  clicks            Int?
  conversions       Int?
  attributedRevenue Decimal?  @map("attributed_revenue") @db.Decimal(12, 2)
  source            String    @default("manual")      // manual / youtube-api / ga4 (MVP 仅 manual)
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz

  tenant            Tenant    @relation(fields: [tenantId], references: [id])
  campaign          Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([tenantId, campaignId, recordedAt(sort: Desc)])
  @@map("campaign_metric")
}

// EmailTemplate 新表（系统模板 + 未来用户自定义预留）
model EmailTemplate {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String?   @map("tenant_id") @db.Uuid    // null = system template, 跨租户可读
  name        String
  subject     String
  body        String    @db.Text
  variables   Json      @db.JsonB                      // [{token:"{{kol.name}}", description:"KOL 名称"}]
  locale      String    @default("en") @db.VarChar(5)  // en / zh
  type        String    @default("system")              // system / user
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  tenant      Tenant?   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, type])
  @@index([type, locale])      // system template lookup
  @@map("email_template")
}

// EmailLog 扩展（B0 已有，BM2 加 templateId 关联）
model EmailLog {
  // ...existing B0 fields
  templateId  String?   @map("template_id") @db.Uuid    // 关联 EmailTemplate（AI 定制场景下为原模板 id）
  aiCustomized Boolean  @default(false) @map("ai_customized")  // 标记是否 AI 定制
  template    EmailTemplate? @relation(fields: [templateId], references: [id])
}
```

Migration `prisma/migrations/20260504100000_bm2_schema/migration.sql`：
- ALTER TABLE tenant ADD COLUMN logo_url（nullable）
- ALTER TABLE kol ADD COLUMN email（nullable, varchar 320）+ email_source（default 'manual'）
- ALTER TABLE campaign ADD COLUMN product_id / spend_total (DEFAULT 0) / revenue_recorded / started_at / closed_at + FK to product + 2 新复合索引
- ALTER TABLE kol_campaign ALTER COLUMN status SET DEFAULT 'pending'（不改原 "candidate" 已存数据值——BM1 seed 不落 KolCampaign 行，此处无历史数据）
- CREATE TABLE campaign_metric + 索引 + RLS policy（NULLIF 兜底）
- CREATE TABLE email_template + 索引（无 RLS，tenantId null = system 跨租户可读；type='user' 记录后续靠 app 层过滤）
- CREATE TABLE weekly_report + 索引 + RLS policy（NULLIF 兜底；注意：匿名分享查询走独立 `/shared/weekly-report/:token` 路由，query 走 superuser 连接绕 RLS，按 token 查且校验过期）
- ALTER TABLE email_log ADD COLUMN template_id / ai_customized + FK
- **ROLLBACK SQL** 完整
- Migration 头部加注释说明：kol_campaign.status 列复用（不新建 contactStatus）

注意：按 `framework/harness/database-patterns.md §1`，新表 RLS 必须用 `NULLIF(..., '')::uuid` 兜底；tsvector（BI4-F005）不涉及本批次字段，无需动。

**Acceptance：**
- `npx prisma migrate dev` 本地 + `migrate deploy` Testcontainers 通过
- F011 CI ROLLBACK 校验通过
- `tests/integration/bm2-schema.test.ts` 覆盖：Campaign 新字段读写 + product FK / KolCampaign.status enum 6 值 / CampaignMetric CRUD + RLS / EmailTemplate 跨租户 system 读 + 单租户 user 写

### F002 — EmailTemplate seed 脚本

**实现：**

`scripts/seed-email-templates.ts` 新建（对齐 F001 幂等 upsert 惯例）：
- tenantId = null（system template）
- 每套模板 en / zh 两版（MVP i18n 覆盖）
- variables 字段列出可用 token：`{{kol.name}}` / `{{kol.handle}}` / `{{product.name}}` / `{{product.category}}` / `{{product.usp}}` / `{{marketer.name}}`

5 套模板清单：

| name (zh) | name (en) | 适用场景 |
|---|---|---|
| 初次询价 | Initial Outreach | 第一次接触，简短介绍产品 |
| 跟进提醒 | Follow-up | 3-5 天未回复，温和提醒 |
| 签约邀请 | Partnership Invitation | 对方表达兴趣后，发正式合作邀约 |
| 拒绝跟进 | Polite Decline | 对方不合适，留善意礼貌关门 |
| 已合作回访 | Post-Collab Check-in | 合作完成后回访，为续约铺路 |

模板正文长度：每套中英各 100-180 字，保守占位符使用，确保 AI 定制时有改写空间。

`package.json` 加 `"seed:email-templates": "tsx scripts/seed-email-templates.ts"`。

在 `prisma.config.ts` seed pipeline 接入（BI4-F001 已定义 seed 流程 slot）。

**Acceptance：**
- `npm run seed:email-templates` 跑完后 `prisma.emailTemplate.count({ where: { type: "system" } })` = 10（5 × 2 语言）
- Idempotent：再跑一次 count 仍 10
- 所有模板的 variables JSON 包含至少 3 个 token
- `tests/integration/email-template-seed.test.ts` 覆盖：count / 双语对齐 / variables 非空

### F003 — Campaigns 列表页 `/campaigns`

**实现：**

Page：`src/app/[locale]/(app)/campaigns/page.tsx` + 子组件。

**布局**（对齐 Stitch `campaigns-list.html`）：
- 顶部：页标题 + "新建 Campaign" 主按钮（跳 F004）
- Filter 栏：status (all/draft/active/completed) + search by name
- 列表卡片（每卡一个 campaign）：
  - name / product 名 / 状态 badge（颜色区分 draft=灰 / active=青 / completed=绿）
  - KPI 3 件：KOL 数 / spendTotal / ROI%（仅 completed 显示 ROI）
  - 开始日 / 结束日（若有）
  - 点卡片进 F005 详情
- 空态：插画 + "还没有 Campaign，点右上角创建一个"引导

API：`GET /api/campaigns?status=...&cursor=...&limit=20`（BI4-F004 cursor pagination util 复用）。

**Acceptance：**
- L1 integration test：cursor 分页返回正确 + filter 生效
- L2 staging 手动：新建 2 个 campaigns 显示、filter 切换
- L3 visual：对齐 `campaigns-list.png`（Playwright screenshot vs baseline）
- 空态：`tests/e2e/campaigns-empty.spec.ts` 验证

### F004 — Campaign 新建页 `/campaigns/new`

**实现：**

Page：`src/app/[locale]/(app)/campaigns/new/page.tsx`（模态 or 独立页，Stitch 未明示；选**独立页**减少状态管理复杂度）。

**表单字段：**
- name（required, max 80）
- productId（required，下拉 from `GET /api/products`，无 product 时提示"先去 /knowledge-base 录入产品"）
- budgetAmount（optional，Decimal 12,2 USD）
- startDate（optional，date picker）
- endDate（optional，date picker）
- ownerUserId（默认当前用户，不可改）
- 游戏/市场/KPI 目标（B0 已有字段 game / markets / kpiTarget，MVP 保留可填 optional）

Zod schema 在 `src/lib/campaigns/schema.ts`（F005/F006 复用）。

**POST /api/campaigns**：
- 创建 Campaign（status='draft' / spendTotal=0）
- 埋点 event_log（BI4-F002 helper）：`campaign.created`
- 返回 id → 前端跳 `/campaigns/:id`

**Acceptance：**
- L1：create API 测试（zod 校验 + RLS 隔离 + event_log 写入）
- L2 staging：表单 submit → 跳详情 + 列表出现新卡片
- L3 visual：form layout 对齐 campaigns-list design 里的"新建" pattern

### F005 — Campaign 详情页 `/campaigns/:id`

**实现：**

Page：`src/app/[locale]/(app)/campaigns/[id]/page.tsx` + 3 组件（KolPanel / RevenueRecorder / StatusController）。

**布局**（对齐 Stitch `campaign-detail.html`）：

**Section 1 — Header**：
- Campaign name + status badge + 编辑按钮（name / dates / budget 可改 inline）
- Product 名 + 跳 Product 详情链接
- Budget / SpendTotal / Revenue / ROI% KPI 4 件

**Section 2 — KOL 面板**：
- "添加 KOL" 按钮 → 打开 modal 选 KOL（只显示 `Kol.isSaved=true` 且未在本 campaign 的）
- 列表每行 KOL：avatar / name / handle / platform badge / contactStatus select（6 值切换）/ kolFee input / 移除按钮
- kolFee 修改 onBlur save → 后端重算 Campaign.spendTotal

**Section 3 — Revenue / Status**：
- RevenueRecorder：status=completed 前可改，>=completed 时显示只读 + "重新激活"按钮（切回 active 解锁）
- StatusController：draft → active → completed 按钮链，标记 startedAt / closedAt

**Section 4 — 邮件发送入口**：
- "给所有有 email 的 KOL 发邮件" 按钮 → 跳 `/outreach?campaignId=:id`

API：
- `GET /api/campaigns/:id` 返 Campaign + kolCampaigns + product
- `PATCH /api/campaigns/:id` 更新字段
- `POST /api/campaigns/:id/kols` 加 KOL（body: kolId + optional kolFee）
- `DELETE /api/campaigns/:id/kols/:kolId` 移除
- `PATCH /api/campaigns/:id/kols/:kolId` 改 status / kolFee
- 每次 kolFee 变更：DB trigger 重算 spendTotal OR 服务端事务内 recompute（选后者，避免隐形魔法）
- audit_log（BI4-F003 helper）：campaign.kol.status_changed / campaign.kol.fee_updated

**Acceptance：**
- L1：KOL 增删改 API 测试 + spendTotal 重算正确 + audit_log 写入
- L2 staging：手动完整 Journey 走一遍（新建 → 加 3 个 KOL → 录 fee → 切 active → 录 revenue → 切 completed → 看 ROI）
- L3 visual：对齐 `campaign-detail.png`

### F006 — 邮件触达页 `/outreach`

**实现：**

Page：`src/app/[locale]/(app)/outreach/page.tsx` + EmailComposer / AiCustomizeDialog 组件。

**核心流程**（对齐 Stitch `email-center.html`）：

1. 顶部 Campaign selector（可 `?campaignId=:id` 预选）
2. 该 Campaign 下的 KolCampaign 行，勾选要发的：
   - 启用：`Kol.email` 非空的行
   - 禁用：无 email 的标灰 + tooltip "需手动通过 YouTube 私信"
   - 无 email 行尾显示"补 email"按钮 → 行内弹输入框 → PATCH `/api/kols/:id` { email, emailSource: 'manual' } → 刷新行状态为"可发"
   （MVP demo 场景：seed KOL 无 email，marketer 手动补 3-5 个测试邮箱做 Journey A 演示）
3. EmailTemplate selector（按当前 locale 过滤 system 模板）
4. 预览：变量替换后的 subject / body（按选中的第一个 KOL）
5. **AI 定制按钮** → 弹出 AiCustomizeDialog：
   - 调 `aigcgateway` Action `kol-email-customize`（Planner 预建），输入：product / kol / original template
   - 展示左右对比（原版 vs AI 版）
   - 用户可编辑 AI 版或切回原版
   - 选一个"确认用这版"
6. "发送"按钮 → 分批调 Resend（10 msg/min 前端节流 + 后端 sleep guard）
7. 每封成功后：EmailLog 写入 + KolCampaign.status 更新到 'contacted'（若当前是 pending/quoted 之前）
8. 发送完成页：成功 N 封 / 失败 M 封（列出失败 KOL 让用户手动处理）

**AI 定制调用契约**（与 Planner 预建的 `kol-email-customize` Action 对齐）：

```typescript
// src/lib/email/customize.ts
export async function customizeEmail(input: {
  product: { name: string; category: string; usp: string };
  kol: { name: string; handle: string; region: string | null; categories: string[] };
  template: { subject: string; body: string; locale: 'en' | 'zh' };
}): Promise<{ subject: string; body: string; traceId: string }>
```

**Resend 集成**（`src/lib/email/resend.ts`）：
- 从 `process.env.RESEND_API_KEY` 读 key
- 无 key（dev 场景）→ fallback 到 structured log（`[EMAIL MOCK] To: ... Subject: ...`）+ EmailLog 写入但标记 `mockSent: true`（新字段 or 用现有 status 字段？此处用 EmailLog.status = 'mock_sent'）
- 从 `marketer@kolquest.com` 发（PRD §10.2）
- 错误 retry 1 次（429 / 5xx），超时 30s

**埋点：**
- event_log: `email.sent` / `email.ai_customize_clicked` / `email.ai_customize_accepted`
- 用于 PRD §2.2 "AI 定制邮件采纳率 ≥ 40%" 指标

**Acceptance：**
- L1：customizeEmail 函数 mock aigcgateway 返回正确结构 + resend mock log + EmailLog 正确写入
- L2 staging：真发一封 test email 到 admin 邮箱 + AI 定制弹层工作
- L3 visual：对齐 `email-center.png`
- 埋点：3 个 event 类型的写入验证

### F007 — CRM 简化页 `/crm`

**实现：**

Page：`src/app/[locale]/(app)/crm/page.tsx` + StageDistribution / Funnel / CollabKpi 组件。

**布局**（对齐 Stitch `crm-relationship.html`）：

- **Section 1 — 阶段分布卡片**：6 个 Kol.relationshipStatus 值分别多少个 KOL（prospect / first_contact / negotiating / long_term / paused / terminated），点卡片跳到对应过滤的 /database 页
- **Section 2 — 漏斗图**：阶段链 prospect → first_contact → negotiating → long_term，每一步显示数量 + 上一步的转化率 %
- **Section 3 — 合作总额 KPI**：Σ KolCampaign.kolFee where status ∈ {signed, delivered, paid}（本 tenant 所有 campaigns 累加）
- **Section 4 — 最近关系变化表**：按 audit_log（BI4-F003）过滤 `actor_type=user action='kol.relationship_status_changed'` 最近 30 条，显示 KOL / 谁改 / 何时 / 从 A → B
- **操作**：每个 KOL 行有 relationshipStatus dropdown 可切换 → PATCH `/api/kols/:id/relationship-status` → 写 audit_log

API：
- `GET /api/crm/overview` 返回 { stageDistribution, funnelMetrics, collabKpi, recentChanges }
- `PATCH /api/kols/:id/relationship-status`（body: newStatus）

**Acceptance：**
- L1：overview API 返回数据结构正确 + stateDistribution count 对 / funnel 转化率公式 / audit_log 写入
- L2 staging：切换 3 个 KOL 的状态，CRM 实时更新
- L3 visual：对齐 `crm-relationship.png`

### F008 — ROI 引擎（util + API）

**实现：**

`src/lib/roi/compute.ts`：

```typescript
// Pure functions, tenant-scoped input
export function computeCampaignRoi(campaign: {
  spendTotal: Decimal;
  revenueRecorded: Decimal | null;
}): { roiPercent: number | null; netProfit: Decimal } {
  if (!campaign.revenueRecorded) return { roiPercent: null, netProfit: new Decimal(0) };
  const net = campaign.revenueRecorded.minus(campaign.spendTotal);
  if (campaign.spendTotal.eq(0)) return { roiPercent: null, netProfit: net };
  return {
    roiPercent: net.div(campaign.spendTotal).mul(100).toNumber(),
    netProfit: net,
  };
}

// 30 天趋势聚合（从 Campaign.closedAt + revenueRecorded 时序）
export async function computeRoiTrend(tenantId: string, days: number): Promise<{
  date: string;  // YYYY-MM-DD
  spendTotal: Decimal;
  revenue: Decimal;
  roiPercent: number | null;
}[]>

// 全局 summary
export async function computeRoiSummary(tenantId: string): Promise<{
  totalSpend: Decimal;
  totalRevenue: Decimal;
  avgRoiPercent: number | null;
  topCampaign: { id: string; name: string; roiPercent: number } | null;
  campaignCount: { active: number; completed: number };
}>
```

API：
- `GET /api/roi/summary` → computeRoiSummary
- `GET /api/roi/trend?days=30` → computeRoiTrend
- `GET /api/roi/campaigns` → 所有 completed campaigns 的 ROI 排序列表

**Acceptance：**
- L1 unit tests（`tests/unit/roi-compute.test.ts`）：
  - 0 spend + 非 null revenue → roiPercent null + netProfit = revenue
  - 100 spend + 150 revenue → roiPercent = 50 + netProfit = 50
  - null revenue → roiPercent null
  - trend 正确按 day bucket 聚合
  - summary 避免除以 0
- L1 integration：API 各端点 RLS 隔离

### F009 — ROI 追踪页 `/roi`

**实现：**

Page：`src/app/[locale]/(app)/roi/page.tsx` + 4 KPI / TrendChart / CampaignTable / AiInsightsCard 组件。

**布局**（对齐 Stitch `roi-tracking.html`）：

- **Section 1 — 4 KPI 卡片**：Total Spend / Total Revenue / Avg ROI % / Top Campaign ROI（from F008 summary）
- **Section 2 — 30 天趋势图**：recharts line chart（spend vs revenue 双线 + ROI % 次轴）
- **Section 3 — Campaign ROI 表**：所有 completed campaigns，按 roiPercent DESC 排序，可点跳详情
- **Section 4 — AI Insights 卡片**：
  - 默认显示 "点击生成 AI 洞察" 按钮
  - 点按钮 → 调 aigcgateway Action `roi-insights`（Planner 预建）
  - 返回 3-5 条中英双语洞察（与当前 locale 匹配）
  - 结果缓存 localStorage key=`roi-insights-{tenantId}-{YYYYMMDD}`，当日再访问直接读缓存
  - 有缓存时显示"2026-XX-XX 生成，重新生成"按钮

**AI Insights 调用契约**：

```typescript
// src/lib/roi/insights.ts
export async function generateRoiInsights(input: {
  campaigns: Array<{
    name: string; product: string; spendTotal: number;
    revenueRecorded: number | null; roiPercent: number | null;
    startedAt: string; closedAt: string | null;
  }>;
  locale: 'en' | 'zh';
}): Promise<{ insights: Array<{ title: string; body: string }>; traceId: string }>
```

**Acceptance：**
- L1：insights mock 验证 + localStorage 读写
- L2 staging：真调 aigcgateway 一次 + 洞察渲染正确 + 次日再访问读缓存
- L3 visual：对齐 `roi-tracking.png`

### F010 — AI 周报页 `/weekly-report`

**实现：**

Page：`src/app/[locale]/(app)/weekly-report/page.tsx` + WeeklyReportGenerator / ReportRenderer / PdfExportButton / ShareLinkButton 组件。

**核心流程**（对齐 Stitch `weekly-report.html`）：

1. 顶部 date picker（默认"过去 7 天"）+ locale selector（en/zh）
2. "生成周报" 按钮 → 调 aigcgateway Action `weekly-report-for-client`（Planner 预建），输入：
   - tenant（name / logo URL）
   - 本期 KOL 活动（新增合作 / 切换状态 / 新增邮件发送等）
   - 本期 ROI 数据（spend / revenue / top campaigns / 趋势）
   - 上期对比（如果有）
3. 返回 markdown → 前端用 `react-markdown` 渲染
4. 渲染结果布局（PRD §2.1 DoD #7）：
   - **Branded header**：tenant logo + 周报标题 + 日期范围
   - **Executive Summary**：2-3 段
   - **Top Performers**：Top 3 KOL / Campaign
   - **Key Insights**：3-5 bullet points
   - **Looking Ahead**：下周建议 2-3 条
5. **PDF 导出**：
   - 按钮 → `window.print()` 触发浏览器打印对话
   - 页面用 `@media print` stylesheet：A4 / 隐藏 nav/sidebar / 强制分页
   - 用户在打印对话选 "Save as PDF"
6. **分享链接**（按钮）：
   - 生成周报时自动写入 `WeeklyReport` 表（contentMd + summaryJson 快照，保证 aigcgateway 不可达时匿名页仍能渲染）
   - POST `/api/weekly-reports/:id/share-token` → 生成 32 字符 token + 7 天过期 → 写回同一 WeeklyReport 行的 shareToken / shareTokenExpiresAt
   - 返回 URL `https://kol.guangai.ai/shared/weekly-report/:token`
   - 客户访问 `/shared/weekly-report/:token` 匿名渲染 WeeklyReport.contentMd，no-index meta
   - 历史周报可通过 `/weekly-report?id=:id` 切换查看（MVP 至少支持最近 10 份）

**Share 路由**：`src/app/shared/weekly-report/[token]/page.tsx` — 不走 `[locale]/(app)` auth layout，中间件跳过 auth；服务端按 token 查 WeeklyReport + 过期校验（走 superuser 连接绕 RLS，仅 SELECT content_md / summary_json / created_at / share_token_expires_at 4 列，品牌 header（tenant.name + logoUrl）已在生成时快照进 summary_json，匿名页不再 join tenant 表，杜绝横向越权）；设置 `<meta name="robots" content="noindex" />`。

**Acceptance：**
- L1：generateWeeklyReport mock + PDF print stylesheet 手动校验 + share token 生成/失效逻辑
- L2 staging：真调一次 + PDF 导出 1 页 + 分享链接匿名访问渲染正确
- L3 visual：对齐 `weekly-report.png`（登录态 + 分享匿名态 2 份截图对齐）

### F011 — Tests + Visual regression baselines

**实现：**

1. **Integration tests**（覆盖 F001-F010 API 层）：
   - `tests/integration/bm2-schema.test.ts`
   - `tests/integration/email-template-seed.test.ts`
   - `tests/integration/campaigns-api.test.ts`
   - `tests/integration/outreach-api.test.ts`（mock Resend + aigcgateway）
   - `tests/integration/crm-api.test.ts`
   - `tests/integration/roi-api.test.ts`
2. **Unit tests**：
   - `tests/unit/roi-compute.test.ts`（F008 pure functions 全 branch）
   - `tests/unit/email-customize.test.ts`（template 变量替换逻辑）
3. **E2E（Playwright）**：
   - `tests/e2e/journey-a.spec.ts`：完整 Journey A（/discovery 保存 → /campaigns/new → 加 KOL → /outreach → AI 定制 → 发 mock 邮件）
   - `tests/e2e/journey-b.spec.ts`：Journey B（录 revenue → /roi → /weekly-report → PDF 导出 → 分享链接匿名访问）
4. **Visual regression**（Playwright screenshot）：
   - 6 个新页面各一张 baseline：campaigns-list / campaign-detail / outreach / crm / roi / weekly-report
   - 容差 0.1（与 BM1 F009 baseline 一致）
5. **AI 定制采纳率埋点验证**：E2E 里触发一次 AI 定制 → 验证 event_log 3 种 event 都正确写入（clicked / accepted / sent with ai_customized=true）

**Acceptance：**
- 全部 L1 tests 绿（run in Testcontainers via BI1-F002 helper）
- 全部 L2 E2E spec 绿（staging 环境）
- 6 张 visual baseline 入库 `tests/visual-baselines/bm2/`
- CI `integration-tests` + `e2e-tests` + `visual-regression` 三个 job 全绿

## 5. 依赖关系

```
F001 (schema + migration)
  │
  ├── F002 (email template seed)
  │      └── F006 (outreach uses templates)
  │
  ├── F003 (campaigns list) ────┐
  ├── F004 (campaign new) ──────┤
  │      └── F005 (campaign detail) ──┬── F006 (outreach reads campaign)
  │                                    └── F007 (CRM reads KolCampaign state)
  │
  ├── F008 (ROI compute util) ──── F009 (ROI page) ── F010 (weekly-report reads ROI)
  │
  └── F011 (tests, last)
```

**并行机会：**
- F001 完成后：F002 + F003 + F004 + F008 四者可并行（Generator 单线程下按次序推进亦可）
- F005 完成后：F006 + F007 可并行

**强依赖：**
- F001 → all（DB 基础）
- F005 → F006（/outreach 必须有 campaign 选）
- F008 → F009（UI 调用计算）
- F009 / BM1-F003 / F005 / F007 → F010（周报输入来自各处）

**Planner 侧并行准备（不阻塞 Generator）：**
- BM1 building 期间已完成 / 正在做：建 aigcgateway 3 个 Action（`kol-email-customize` / `roi-insights` / `weekly-report-for-client`），BM2 F006/F009/F010 开工前 Action 必须 active

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| Resend API 在 VPS 未配 key 时开工 F006 | 高 | F006 实现 mock fallback；Reviewer L2 staging 验证前用户必须 `ssh + vi .env.production` 设 RESEND_API_KEY + `pm2 reload` |
| aigcgateway Action 的 prompt 质量不达"客户可看"标准 | 高 | F010 Action prompt 多轮调优（Planner 并行工作）；spec 在 Action created 后按用户反馈 iterate |
| AI 定制邮件的"对比体验"用户不买账 | 中 | PRD §2.2 指标"≥ 40% 采纳率"作为硬反馈信号；低于 20% 迭代 UI |
| PDF 导出各浏览器样式不一 | 中 | 用专用 `@media print` + 固定 A4 页面 + Chrome/Safari/Firefox 各测一次 |
| Campaign KOL 列表数据膨胀（某 campaign 加 50+ KOL）性能 | 低 | MVP 期望 ≤20 KOL/campaign；若接近 50，前端加分页；spec 不做 |
| 分享链接被搜索引擎索引泄露客户数据 | 中 | `<meta name="robots" content="noindex">` + robots.txt + 7 天过期；no auth required on purpose |
| Resend 速率限制（100 email/sec default）触达限额 | 低 | MVP 量级几十封/天；前端 10/min 节流已超保守 |
| status=completed → active 切回时 revenueRecorded 清零？ | 低 | 切回 active 保留 revenue 值，只是 UI 解锁；完全 reset 用户自己改 |
| CRM 拖拽需求回潮 | 低 | 按 §3 决策用按钮；拖拽放 Post-MVP B4 或 B7 |
| 周报生成调 aigcgateway 超时 | 中 | 前端显示 loading + 30s 超时提示 + 重试按钮；aigcgateway Action dry_run 预检能力预调 |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化（Codex 跑 Testcontainers）
- Vitest integration tests 全绿（6 files per F011 §1）
- Vitest unit tests 全绿（2 files per F011 §2）
- Prisma migration: `migrate dev` + `migrate deploy` 双绿
- ROLLBACK SQL 校验通过（`scripts/verify-rollback.sh` BI1-F010 既有）

### L2 功能验证（staging）

按 **Journey A + B 各跑一遍**：

**Journey A（KOL 筛选 + 触达）：**
1. `/discovery` 筛选 3 个 KOL → 保存（BM1 F004 流程）
2. `/knowledge-base` 录入 1 个 Product（BM1 F003 流程）
3. `/campaigns/new` 新建 Campaign，绑定 Product
4. `/campaigns/:id` 加入 3 个保存的 KOL，录 kolFee 分别 $100/$200/$150
5. 点"给所有有 email 的 KOL 发邮件" → `/outreach` 预选 Campaign
6. 选 "初次询价"模板，预览变量替换
7. 点"AI 定制" → 弹层对比 → 选 AI 版
8. 发送 → 成功 N 封 / 失败 M 封
9. 回 `/campaigns/:id`，3 个 KolCampaign status 变为 'contacted'
10. EmailLog 表有对应记录，`ai_customized=true`

**Journey B（复盘 ROI + 周报）：**
1. `/campaigns/:id` 切到 active → 录 revenueRecorded = 1000 → 切 completed
2. 自动计算 ROI%（(1000 - 450) / 450 × 100 ≈ 122%）
3. `/roi` 看全局 + 4 KPI + 趋势图 + Campaign ROI 表
4. 点"Generate Insights" → AI 洞察 3-5 条
5. 刷新页面 → insights 从 localStorage 读缓存
6. `/weekly-report` 选过去 7 天 → 生成周报 → 渲染 markdown
7. 点 PDF 导出 → Chrome 打印对话 → Save as PDF
8. 点分享 → 获取 `/shared/weekly-report/:token` URL
9. 匿名浏览器打开 → 同样内容渲染 + 无 nav/sidebar
10. 改系统时间 +8 天 → 刷新 → 404（token 过期）

### L3 视觉（Playwright baseline）

6 张新页面 screenshot 对齐 Stitch PNG，容差 0.1：
- campaigns-list / campaign-detail / outreach / crm / roi / weekly-report

### L4 埋点校验

- `event_log` 查询：`campaign.created` / `email.sent` / `email.ai_customize_clicked` / `email.ai_customize_accepted` / `kol.relationship_status_changed` / `roi.insights_generated` / `weekly_report.generated` 等 event 都能查到
- `audit_log` 查询：KOL 关系状态变更 / Campaign 状态变更 / EmailTemplate 变更 全部记录

## 8. 引用文档

- `docs/product/KOLMatrix-MVP-PRD.md` §4 / §5 / §6 / §7 / §10
- `docs/specs/BM1-console-kol-core-spec.md`（BM1 前置，同期 schema）
- `docs/specs/BI4-architectural-guardrails-spec.md`（cursor pagination / event_log / audit_log helper）
- `docs/kol-seed-enriched-final.json`（BM1 已 seed，BM2 直接用）
- `design-draft/stitch-references/campaigns-list.html` / `campaign-detail.html`
- `design-draft/stitch-references/email-center.html`
- `design-draft/stitch-references/crm-relationship.html`
- `design-draft/stitch-references/roi-tracking.html`
- `design-draft/stitch-references/weekly-report.html`
- `framework/harness/database-patterns.md` §1 RLS NULLIF / §2 migration 命名
- `framework/harness/deploy-patterns.md` §2 VPS artifact in-git
- `framework/harness/pre-impl-adjudication.md`（开工前审计工作范式）
- `docs/adr/ADR-007-multi-tenant-rls-strategy.md`
- `docs/adr/ADR-009-aigcgateway-integration.md`

## 9. 启动检查清单（Generator 开工前）

Generator 在 BM2 开工前确认：

- [ ] BM1 所有 11 features 已 done（或至少 F001-F007 done，F008/F009 并行可接受）
- [ ] Planner 的 aigcgateway 3 Action 已 active（`list_actions` 能看到 + `run_action dry_run` 测试通过）
- [ ] VPS `.env.production` 的 `RESEND_API_KEY` 和 `AIGCGATEWAY_API_KEY` 真 key 已配置（pm2 reload 后生效）
- [ ] 本 spec §3 所有决策点已读，尤其 Resend mock fallback / AI 定制 UI / PDF 导出方式 / 分享链接过期策略
- [ ] `framework/harness/deploy-patterns.md` §2 VPS artifact in-git 规则已读
- [ ] F001 schema 起草前按 `database-patterns.md §2` 扫现有 schema（`prisma/schema.prisma` 相关 models）避免重蹈 BM1 F001 审计事故

## 10. 完成后效果

BM2 full done 后：

1. **MVP 4 大功能全达成**（✅ 控制台 / ✅ 筛选 KOL / ✅ 联系 KOL / ✅ ROI 追踪）
2. 用户在 `kol.guangai.ai` 可完成 PRD §2.1 DoD 全 7 步（1 session 端到端）
3. 种子用户可以试用，收集反馈驱动 Post-MVP 迭代（B4 完整邮件 / B6 YT Data API / B7 客户协同 等）
4. `/weekly-report` 的 PDF + 分享链接能直接给客户看，不需要手动做 PPT
5. 代码覆盖率从 BM1 后的 ~60% 提升到 ≥70%（F011 补全 unit + integration + E2E）
6. Prod 部署后配合 PRD §10.3 邀请制 Auth 流程开放种子客户注册

**MVP 上线目标日期：** 约 2026-05-15（按 PRD §9 时间线反推，BM1 done → BM2 done → launch）

---

## 11. Planner 并行工作进度记录

本 spec 由 johnsong（Planner 身份）起草于 2026-04-23，BM1 building 阶段。

**aigcgateway 3 Action 进度**（BM2 F006/F009/F010 前置）：
- [x] `kol-email-customize` — ✅ **action_id: `cmob2z6j00001bnole7i8lg9h`**（model: `claude-haiku-4.5`，2026-04-23 created + dry_run + real call 通过；测试 token usage 549+287，~$0.002/call）
- [x] `roi-insights` — ✅ **action_id: `cmob2zgae000jbnnuue2i7uaf`**（model: `gemini-3-flash`，2026-04-23 created + dry_run + real call 通过；测试 token usage 641+625，~$0.002/call）
- [x] `weekly-report-for-client` — ✅ **action_id: `cmob2zqkp0001bnnvel4vjapu`**（model: `gemini-3-flash`，2026-04-23 created + dry_run + real call 通过；测试 token usage 586+636，~$0.002/call，产出 450 词 5 段式 markdown）

### 11.1 Generator 集成要点（实测产出沉淀）

**claude-haiku-4.5 输出 JSON 时习惯加 code fence 包裹**（即便 system prompt 禁止也会偶发），Generator 在 `src/lib/email/customize.ts` 解析响应时必须先 strip 可能的 ```json / ``` 围栏再 JSON.parse：

```typescript
function stripCodeFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
}
const parsed = JSON.parse(stripCodeFence(response.output));
```

`gemini-3-flash` 两个 Action 实测无此习惯（roi-insights / weekly-report-for-client 都干净），但 Generator 解析 `roi-insights` 响应时仍建议套上 stripCodeFence 作为防御性编程（future-proof）。`weekly-report-for-client` 是 raw markdown 直接渲染，无需 JSON parse。

**调用参考实现（F006 / F009 / F010 三处）：**

```typescript
// F006 src/lib/email/customize.ts
const result = await aigcGatewayClient.runAction({
  actionId: 'cmob2z6j00001bnole7i8lg9h',
  variables: {
    product_name, product_category, product_usp,
    kol_name, kol_handle, kol_region: kol_region ?? 'Unknown',
    kol_categories: JSON.stringify(kol.categories),
    original_subject, original_body, locale,
  },
});

// F009 src/lib/roi/insights.ts  
const result = await aigcGatewayClient.runAction({
  actionId: 'cmob2zgae000jbnnuue2i7uaf',
  variables: {
    tenant_context: tenant.description ?? 'Gaming studio',
    campaigns_json: JSON.stringify(campaigns),
    locale,
  },
});

// F010 src/lib/weekly-report/generate.ts
const result = await aigcGatewayClient.runAction({
  actionId: 'cmob2zqkp0001bnnvel4vjapu',
  variables: {
    tenant_name: tenant.name, report_week_start, report_week_end, locale,
    kol_activity_json: JSON.stringify(kolActivity),
    roi_data_json: JSON.stringify(roiData),
    prev_week_comparison_json: prevWeekComparison ? JSON.stringify(prevWeekComparison) : '',
  },
});
```

**Action ID 环境变量化建议：** 生产/staging 各自可能需要独立 Action（若未来要 A/B test prompt），建议 Generator 把 3 个 action_id 放 `.env.production` / `.env.staging`：
```
AIGC_ACTION_KOL_EMAIL_CUSTOMIZE=cmob2z6j00001bnole7i8lg9h
AIGC_ACTION_ROI_INSIGHTS=cmob2zgae000jbnnuue2i7uaf
AIGC_ACTION_WEEKLY_REPORT=cmob2zqkp0001bnnvel4vjapu
```

---

**Spec 状态：** draft（待用户 review + BM1 done 时切 planning）
