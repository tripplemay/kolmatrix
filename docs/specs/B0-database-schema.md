# B0 — Database Schema 设计

> 版本：v1.0 · 日期：2026-04-18
> 涵盖：B0 批次需要的 7 个核心表 + 4 个 NextAuth 表
> 后续批次（V3+）按需追加表，本文档同步更新

## 1. 设计原则

1. **多租户共享 DB + RLS** — 所有业务表带 `tenant_id uuid not null`，RLS 策略保障隔离
2. **UUID 主键** — Prisma `@default(dbgenerated("gen_random_uuid()"))`（PG 13+）
3. **软删除** — 业务表加 `deleted_at TIMESTAMPTZ`，常用查询带 `WHERE deleted_at IS NULL`
4. **审计字段** — `created_at` / `updated_at` 自动管理；写操作记 `audit_log`
5. **JSON 字段** — 半结构化数据用 `jsonb`（如受众分布、AI 评估详情）；关键搜索字段提取为列
6. **索引** — `tenant_id` 必索引；高频筛选字段加复合索引；JSONB 字段用 GIN 索引
7. **命名** — 表名复数 snake_case，列名 snake_case，外键 `{table}_id`

## 2. ER 图（B0 范围）

```
tenant ──┬── user (NextAuth)
         │     └── account / session / verification_token
         ├── kol ──┬── kol_campaign ─── campaign
         │        └── audit_log (作为 actor)
         ├── campaign ──── kol_campaign
         ├── email_template
         └── audit_log
```

## 3. 表清单与字段

### 3.1 `tenant` — 租户主表（无 RLS，全局可见）

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() |
| `name` | text | not null |
| `slug` | text | unique, not null |
| `plan` | text | default 'free' |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

索引：`UNIQUE(slug)`

### 3.2 `user` — 用户（多租户，RLS）

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → tenant.id, not null |
| `email` | text | not null |
| `email_verified` | timestamptz | nullable（NextAuth） |
| `hashed_password` | text | nullable（OAuth 用户无） |
| `name` | text | not null |
| `role` | text | default 'marketer'（platform_admin / tenant_admin / marketer） |
| `locale` | text | default 'en' |
| `image` | text | nullable |
| `created_at` / `updated_at` | timestamptz | — |

索引：`UNIQUE(email)`、`INDEX(tenant_id)`

RLS：
```sql
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tenant_isolation ON "user"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
         OR current_setting('app.is_platform_admin', true)::bool = true);
-- NULLIF 兜底：current_setting 在 session 触达过该 GUC 后会返回 '' 而非
-- NULL，直接 ::uuid 会 raise "invalid input syntax for type uuid: \"\""。
-- NULLIF('', '') → NULL，使 `tenant_id = NULL::uuid` 为 NULL（默认拒），
-- 修复 2026-04-19 F008 marketer E2E flaky 的根因（见 BI1-f008-rls-nullif-fix.md）。
```

### 3.3 NextAuth 三个辅助表

由 `@auth/prisma-adapter` 自动管理：
- `account`（OAuth provider 关联，B0 无 OAuth 但保留 schema）
- `session`（JWT 模式不强依赖）
- `verification_token`（邮箱验证）

字段按 NextAuth 标准 schema，不展开。

### 3.4 `kol` — KOL 主表（多租户，RLS）

| 列 | 类型 | 约束 / 备注 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK, not null |
| `platform` | text | youtube / tiktok / twitch / instagram |
| `handle` | text | 平台账号 handle，如 `@gamerxia` |
| `display_name` | text | KOL 展示名 |
| `bio` | text | nullable |
| `avatar_url` | text | nullable |
| `country_code` | text | ISO 3166-1 alpha-2，如 `US` / `JP` |
| `language` | text | 主要内容语言 |
| `follower_count` | int | default 0 |
| `engagement_rate` | decimal(5,2) | nullable |
| `avg_views` | int | nullable |
| `categories` | text[] | 如 ['FPS', 'MOBA'] |
| `audience_age_dist` | jsonb | `{"18-24": 34, "25-34": 38, ...}` |
| `audience_geo_dist` | jsonb | `{"US": 42, "UK": 14, ...}` |
| `audience_gender_dist` | jsonb | `{"male": 71, "female": 27, "non_binary": 2}` |
| `ai_score` | int | 0-100, nullable |
| `ai_score_breakdown` | jsonb | `{"brand_safety": 98, "audience_quality": 91, ...}` |
| `ai_evaluated_at` | timestamptz | nullable |
| `status` | text | active / archived / blacklisted |
| `external_id` | text | 平台原始 ID（用于回拉数据） |
| `last_synced_at` | timestamptz | nullable |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | — |

索引：
- `INDEX(tenant_id, ai_score DESC)` — 排序查询
- `INDEX(tenant_id, platform, follower_count)` — 筛选
- `UNIQUE(tenant_id, platform, handle)` — 去重
- `GIN(categories)` — 数组筛选
- `GIN(audience_geo_dist)` — JSONB 查询

RLS：tenant_id = current_setting

### 3.5 `campaign` — 活动表

| 列 | 类型 | 备注 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `name` | text | not null |
| `game` | text | 关联游戏名（B1 拆 product 表） |
| `markets` | text[] | ['US', 'JP', 'KR'] |
| `status` | text | draft / active / paused / completed |
| `budget_amount` | decimal(12,2) | nullable |
| `budget_currency` | text | default 'USD' |
| `kpi_target` | jsonb | `{"reach": 5_000_000, "conversion_rate": 0.05}` |
| `start_date` | date | nullable |
| `end_date` | date | nullable |
| `owner_user_id` | uuid | FK → user.id |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | — |

索引：`INDEX(tenant_id, status, start_date)`

RLS：同 kol

### 3.6 `kol_campaign` — KOL 在活动中的关系

| 列 | 类型 | 备注 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `kol_id` | uuid | FK → kol.id |
| `campaign_id` | uuid | FK → campaign.id |
| `status` | text | candidate / contacted / replied / accepted / declined / completed |
| `match_score` | int | 0-100, nullable（针对此 campaign 的匹配分） |
| `match_reasoning` | jsonb | AI 给出的匹配理由 |
| `contacted_at` | timestamptz | nullable |
| `replied_at` | timestamptz | nullable |
| `accepted_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | — |

索引：
- `UNIQUE(tenant_id, kol_id, campaign_id)`
- `INDEX(tenant_id, campaign_id, status)`

RLS：同上

### 3.7 `email_template` — 邮件模板

| 列 | 类型 | 备注 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `name` | text | 模板名 |
| `subject` | text | 含变量 `{{kol_name}}` 等 |
| `body_html` | text | HTML 正文 |
| `body_text` | text | 纯文本 fallback |
| `variables` | jsonb | 变量定义 `[{"key": "kol_name", "type": "string"}]` |
| `locale` | text | default 'en' |
| `category` | text | outreach / followup / accept / decline |
| `created_by` | uuid | FK → user.id |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | — |

索引：`INDEX(tenant_id, locale, category)`

### 3.8 `email_log` — 邮件发送记录（B0 占位，V3 使用）

| 列 | 类型 | 备注 |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `campaign_id` | uuid | nullable, FK |
| `kol_id` | uuid | nullable, FK |
| `template_id` | uuid | nullable, FK |
| `to_address` | text | not null |
| `from_address` | text | not null |
| `subject` | text | not null |
| `body_html` | text | not null |
| `provider` | text | default 'resend' |
| `provider_message_id` | text | Resend 返回 ID |
| `status` | text | queued / sent / delivered / opened / replied / bounced / complained |
| `sent_at` / `delivered_at` / `opened_at` / `replied_at` | timestamptz | nullable |
| `bounce_reason` | text | nullable |
| `created_at` | timestamptz | — |

索引：
- `INDEX(tenant_id, campaign_id, status)`
- `INDEX(tenant_id, kol_id)`
- `INDEX(provider_message_id)` — webhook 回查

### 3.9 `audit_log` — 审计

| 列 | 类型 | 备注 |
|---|---|---|
| `id` | bigserial | PK |
| `tenant_id` | uuid | nullable（系统操作） |
| `actor_user_id` | uuid | nullable, FK → user.id |
| `action` | text | create_kol / update_campaign / send_email / ... |
| `resource_type` | text | kol / campaign / email_log / ... |
| `resource_id` | uuid | nullable |
| `payload` | jsonb | 变更前后对比 |
| `ip_address` | text | nullable |
| `user_agent` | text | nullable |
| `created_at` | timestamptz | default now() |

索引：
- `INDEX(tenant_id, created_at DESC)`
- `INDEX(tenant_id, resource_type, resource_id)`

无 RLS（platform_admin 才能读）

## 4. Prisma Schema 草稿

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  slug      String   @unique
  plan      String   @default("free")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  users     User[]
  kols      Kol[]
  campaigns Campaign[]
  templates EmailTemplate[]

  @@map("tenant")
}

model User {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId        String    @map("tenant_id") @db.Uuid
  email           String    @unique
  emailVerified   DateTime? @map("email_verified") @db.Timestamptz
  hashedPassword  String?   @map("hashed_password")
  name            String
  role            String    @default("marketer")
  locale          String    @default("en")
  image           String?
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  accounts Account[]
  sessions Session[]
  campaigns Campaign[] @relation("CampaignOwner")
  templates EmailTemplate[]

  @@index([tenantId])
  @@map("user")
}

// NextAuth Account / Session / VerificationToken — 标准 schema, 略

model Kol {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId            String    @map("tenant_id") @db.Uuid
  platform            String
  handle              String
  displayName         String    @map("display_name")
  bio                 String?
  avatarUrl           String?   @map("avatar_url")
  countryCode         String?   @map("country_code")
  language            String?
  followerCount       Int       @default(0) @map("follower_count")
  engagementRate      Decimal?  @map("engagement_rate") @db.Decimal(5, 2)
  avgViews            Int?      @map("avg_views")
  categories          String[]
  audienceAgeDist     Json?     @map("audience_age_dist") @db.JsonB
  audienceGeoDist     Json?     @map("audience_geo_dist") @db.JsonB
  audienceGenderDist  Json?     @map("audience_gender_dist") @db.JsonB
  aiScore             Int?      @map("ai_score")
  aiScoreBreakdown    Json?     @map("ai_score_breakdown") @db.JsonB
  aiEvaluatedAt       DateTime? @map("ai_evaluated_at") @db.Timestamptz
  status              String    @default("active")
  externalId          String?   @map("external_id")
  lastSyncedAt        DateTime? @map("last_synced_at") @db.Timestamptz
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt           DateTime? @map("deleted_at") @db.Timestamptz

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  kolCampaigns KolCampaign[]
  emailLogs    EmailLog[]

  @@unique([tenantId, platform, handle])
  @@index([tenantId, aiScore(sort: Desc)])
  @@index([tenantId, platform, followerCount])
  @@map("kol")
}

model Campaign {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId        String    @map("tenant_id") @db.Uuid
  name            String
  game            String?
  markets         String[]
  status          String    @default("draft")
  budgetAmount    Decimal?  @map("budget_amount") @db.Decimal(12, 2)
  budgetCurrency  String    @default("USD") @map("budget_currency")
  kpiTarget       Json?     @map("kpi_target") @db.JsonB
  startDate       DateTime? @map("start_date") @db.Date
  endDate         DateTime? @map("end_date") @db.Date
  ownerUserId     String    @map("owner_user_id") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  owner        User           @relation("CampaignOwner", fields: [ownerUserId], references: [id])
  kolCampaigns KolCampaign[]
  emailLogs    EmailLog[]

  @@index([tenantId, status, startDate])
  @@map("campaign")
}

model KolCampaign {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId        String    @map("tenant_id") @db.Uuid
  kolId           String    @map("kol_id") @db.Uuid
  campaignId      String    @map("campaign_id") @db.Uuid
  status          String    @default("candidate")
  matchScore      Int?      @map("match_score")
  matchReasoning  Json?     @map("match_reasoning") @db.JsonB
  contactedAt     DateTime? @map("contacted_at") @db.Timestamptz
  repliedAt       DateTime? @map("replied_at") @db.Timestamptz
  acceptedAt      DateTime? @map("accepted_at") @db.Timestamptz
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  kol      Kol      @relation(fields: [kolId], references: [id])
  campaign Campaign @relation(fields: [campaignId], references: [id])

  @@unique([tenantId, kolId, campaignId])
  @@index([tenantId, campaignId, status])
  @@map("kol_campaign")
}

model EmailTemplate {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String
  subject     String
  bodyHtml    String   @map("body_html")
  bodyText    String   @map("body_text")
  variables   Json?    @db.JsonB
  locale      String   @default("en")
  category    String   @default("outreach")
  createdBy   String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz

  tenant  Tenant @relation(fields: [tenantId], references: [id])
  creator User   @relation(fields: [createdBy], references: [id])

  @@index([tenantId, locale, category])
  @@map("email_template")
}

model EmailLog {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId           String    @map("tenant_id") @db.Uuid
  campaignId         String?   @map("campaign_id") @db.Uuid
  kolId              String?   @map("kol_id") @db.Uuid
  templateId         String?   @map("template_id") @db.Uuid
  toAddress          String    @map("to_address")
  fromAddress        String    @map("from_address")
  subject            String
  bodyHtml           String    @map("body_html")
  provider           String    @default("resend")
  providerMessageId  String?   @unique @map("provider_message_id")
  status             String    @default("queued")
  sentAt             DateTime? @map("sent_at") @db.Timestamptz
  deliveredAt        DateTime? @map("delivered_at") @db.Timestamptz
  openedAt           DateTime? @map("opened_at") @db.Timestamptz
  repliedAt          DateTime? @map("replied_at") @db.Timestamptz
  bounceReason       String?   @map("bounce_reason")
  createdAt          DateTime  @default(now()) @map("created_at") @db.Timestamptz

  campaign Campaign? @relation(fields: [campaignId], references: [id])
  kol      Kol?      @relation(fields: [kolId], references: [id])

  @@index([tenantId, campaignId, status])
  @@index([tenantId, kolId])
  @@map("email_log")
}

model AuditLog {
  id            BigInt   @id @default(autoincrement())
  tenantId      String?  @map("tenant_id") @db.Uuid
  actorUserId   String?  @map("actor_user_id") @db.Uuid
  action        String
  resourceType  String   @map("resource_type")
  resourceId    String?  @map("resource_id") @db.Uuid
  payload       Json?    @db.JsonB
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, resourceType, resourceId])
  @@map("audit_log")
}
```

## 5. RLS 策略 SQL（migration 中追加）

```sql
-- 启用 RLS
ALTER TABLE "user"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kol"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kol_campaign"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_log"     ENABLE ROW LEVEL SECURITY;

-- 通用 tenant_id 隔离 policy（应用于所有多租户表）
-- NULLIF 兜底：current_setting 在 session 触达过该 GUC 后会返回 '' 而非 NULL，
-- 直接 ::uuid 会 raise "invalid input syntax"。NULLIF('', '') → NULL，
-- 使 `tenant_id = NULL` 为 NULL（默认拒）。修复 F008 flaky 根因。
CREATE POLICY tenant_isolation ON "kol"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "campaign"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "kol_campaign"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "email_template"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON "email_log"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- user 表特殊：platform_admin 全可见
CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_platform_admin', true)::bool = true
  );

-- 创建 BYPASS 用户用于 migration / seed（生产环境需 GRANT BYPASSRLS）
-- ALTER ROLE kolmatrix_app NOBYPASSRLS;
-- ALTER ROLE kolmatrix_admin BYPASSRLS;
```

## 6. Seed 数据（B0 用 Stitch Mock）

```typescript
// prisma/seed.ts
const tenant = await prisma.tenant.create({
  data: { name: 'Demo Studio', slug: 'demo' }
});

const adminUser = await prisma.user.create({
  data: {
    tenantId: tenant.id,
    email: 'admin@kolmatrix.local',
    hashedPassword: await bcrypt.hash('KOLM@2026!', 12),
    name: 'Admin',
    role: 'tenant_admin',
  }
});

const marketer = await prisma.user.create({
  data: {
    tenantId: tenant.id,
    email: 'marketer@kolmatrix.local',
    hashedPassword: await bcrypt.hash('KOLM@2026!', 12),
    name: 'Sarah Chen',
    role: 'marketer',
  }
});

// 12 KOLs（Stitch mock 数据）
const kols = [
  { handle: 'gamerxia', displayName: 'GamerXia', platform: 'youtube', followerCount: 2_300_000, aiScore: 96, ... },
  { handle: 'sakurayt', displayName: 'SakuraYT', platform: 'youtube', followerCount: 847_000, aiScore: 93, ... },
  // ... 完整 12 项见 Stitch Discovery 页面
];
await prisma.kol.createMany({ data: kols.map(k => ({ ...k, tenantId: tenant.id })) });

// 3 campaigns
await prisma.campaign.create({ data: { tenantId: tenant.id, name: 'Honor of Kings — Global Launch', game: 'Honor of Kings', markets: ['US', 'JP', 'KR'], status: 'active', ownerUserId: marketer.id } });
await prisma.campaign.create({ data: { tenantId: tenant.id, name: 'Genshin Impact — Winter Event', game: 'Genshin Impact', markets: ['GLOBAL'], status: 'active', ownerUserId: marketer.id } });
await prisma.campaign.create({ data: { tenantId: tenant.id, name: 'PUBG Mobile — Season 30', game: 'PUBG Mobile', markets: ['SEA'], status: 'completed', ownerUserId: marketer.id } });

// 4 outreach templates
// ...
```

## 7. Migration 注意事项

1. **第一个 migration `init`** 包含全部表创建 + RLS 启用 + policies + index
2. 后续 migration 单独提交：`add_xxx_table`、`alter_xxx_column`
3. **每个 migration 头部注释 rollback SQL**：
   ```sql
   -- ROLLBACK:
   -- DROP TABLE IF EXISTS xxx CASCADE;
   ```
4. 大表加索引必须 `CREATE INDEX CONCURRENTLY`
5. 改 column 类型走"加新列 → backfill → 切换 → 删旧列"四步

## 8. 后续表（V3+ 添加）

| 表 | 说明 | 批次 |
|---|---|---|
| `product` | 游戏产品资料 + AI 知识库 | V3 |
| `client` | 客户（甲方）账号 | V3 |
| `candidate_list` | 客户协同筛选清单 + share_token | V3 |
| `kol_external_data` | YouTube/TikTok 原始缓存 | V?? |
| `ai_call_log` | aigcgateway 调用记录 | V?? |
| `webhook_event` | 收到的 webhook 原始数据 | V?? |
| `notification` | 站内通知 | V?? |
