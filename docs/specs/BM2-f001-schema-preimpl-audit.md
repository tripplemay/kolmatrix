# BM2 F001 · Schema 扩展 / Migration 前置审计

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **触发：** BM2 F001 开工前审计，按 `framework/harness/pre-impl-adjudication.md` 工作范式
> **状态：** 审计 + Planner 自裁决（planner 和 generator 均 johnsong），裁决见 §7

## 1. 背景与目标

BM2 F001 要求扩展 schema 支撑 Campaign + 联系 + CRM + ROI + AI 周报。spec 起草时假设多数表为新建，但扫 `prisma/schema.prisma` 发现 B0 init 已有 `EmailTemplate` / `EmailLog.template_id` / `Campaign.openRate` 等遗留对象，与 spec 表述冲突。此外 Product.id 使用 `cuid()`（TEXT）而非 UUID，影响 `campaign.product_id` FK 类型选择。

本审计列出 6 条决议点，全部须落地进 migration + schema.prisma。

## 2. 跨源核对（schema / migration / spec）

| 审计对象 | spec 假设 | 现状 (`prisma/schema.prisma` + `prisma/migrations/*`) | 结论 |
|---|---|---|---|
| `tenant.logo_url` | 新增 nullable | Tenant 无 logo_url（line 23-38） | ✓ 无冲突，直接 ADD COLUMN |
| `kol.email` + `kol.email_source` | 新增 | Kol 无 email 列（line 112-172） | ✓ 无冲突 |
| `campaign.product_id` FK | `@db.Uuid` FK product | Product.id = `cuid()` → TEXT（不是 UUID） | ⚠️ 类型不匹配 → 决议 **#D** |
| `campaign` 新 4 字段 | spend_total / revenue_recorded / started_at / closed_at | Campaign 均无此列（line 178-203），openRate 已有但不冲突 | ✓ 无冲突 |
| 2 新复合索引 | `(tenantId, productId)` + `(tenantId, status, closedAt DESC)` | 现有仅 `(tenantId, status, startDate)` | ✓ 可共存 |
| `kol_campaign.status` 默认值 | 从 `candidate` 改 `pending` | 当前 `@default("candidate")` (line 210) | ⚠️ 要改默认；无历史行（验证过）→ 决议 **#E** |
| `campaign_metric` 新表 | 新建 + RLS | 无此表 | ✓ 新建 |
| `email_template` 新表 | `tenantId?` / `body Text` / `type` / `locale VarChar(5)` | **已存在（B0 schema）**，shape 不同：`tenantId NOT NULL` / `bodyHtml + bodyText` / `category` 而非 `type` / `createdBy NOT NULL` / 无 `type` 列 | ❌ **命名冲突 + shape 冲突** → 决议 **#A** + **#B** |
| `email_template` 现有数据 | 假设空表 | staging **4 行** + prod **4 行**（B0 测试 fixture：`outreach / followup / accept / decline` × en） | ⚠️ 有数据 → 决议 **#C** |
| `weekly_report` 新表 | 新建 + RLS + shareToken unique | 无此表 | ✓ 新建 |
| `email_log.template_id` | ALTER ADD | **已存在（line 261）** 但无 FK，无 `ai_customized` | ⚠️ 部分存在 → 决议 **#F** |

### 2.1 额外发现（不构成决议但须实现时注意）

- `email_log` 未挂 `template` 关系（Prisma side），也无 PG FK constraint。spec #F 决议落地时同步补 Prisma 关系。
- `Tenant.templates EmailTemplate[]` 反向关系（line 34）—— 若 `EmailTemplate.tenantId` 变 nullable，此关系仍可保留（Prisma 支持 nullable FK 的反向集合）。
- `User.templatesAuthored EmailTemplate[]`（line 57）—— 若删除 `EmailTemplate.createdBy`，此关系必须同步删掉，否则 schema 校验失败。
- Product.id 用 cuid 是 BM1 决议（见 `prisma/migrations/20260424100000_bm1_schema/migration.sql` 第 28 行）；不能改回 UUID（迁移风险高 + BM1 已有数据）。
- RLS policy 必须 `NULLIF(current_setting('app.tenant_id', true), '')::uuid` 兜底（`database-patterns.md §1`）。
- Migration 命名 `20260504100000_bm2_schema` 与 spec 对齐，但日期是 2026-05-04（spec 原估上线日）；今天是 2026-04-24，可加快到 `20260424200000_bm2_schema` 与今日对齐，也可沿用 spec 日期。→ 决议 **不列为决议，直接用今日日期** `20260424200000_bm2_schema`（惯例：migration 时间戳记实际创建日）。

## 3. 6 条决议请求

### #A — `email_template` 重建方式

表已存在但 shape 完全不符 BM2 需求（B0 shape vs BM2 spec shape）。

| 方案 | 描述 | 利 | 弊 |
|---|---|---|---|
| **A** DROP + CREATE | 在 migration 开头 `DROP TABLE email_template CASCADE` 再 `CREATE TABLE` | SQL 简短易读；索引、约束从零起一次对；无「残留列 / 约束漂移」风险 | 表身份丢失；CASCADE 会牵连 email_log.template_id（但该列无 FK constraint，无阻碍） |
| B ALTER IN PLACE | ALTER 现有表（drop bodyHtml/bodyText/category/createdBy；add body/type；alter tenantId nullable；alter locale VarChar(5)） | 保留表 id + 历史；理论更"保守" | ALTER 多条 SQL 冗长；若 B0 表留着 deletedAt / updatedAt trigger 之类易残留；既然无 FK 指向，"表身份"意义不大 |

**建议：A**（现有 B0 表从未投入生产使用——`/templates` 等 UI 根本没落地，4 行 fixture 是早期手工数据，丢弃成本 = 0）

### #B — `EmailTemplate` 字段定型（spec 为准）

采纳 spec §F001 shape：
```
tenantId   Uuid?       // nullable, null=system
name       Varchar     // 不限长
subject    Text
body       Text        // 单 body（非 html/text 分离）
variables  Jsonb       // [{token, description, required}]
locale     Varchar(5)  @default 'en'
type       Varchar(20) @default 'system'  // system / user
createdAt / updatedAt
```

放弃 B0 的 `bodyHtml + bodyText + category + createdBy`。无决议变体。

**建议：** 照搬 spec shape，仅补 `type` 字段的 `@db.VarChar(20)` 以对齐其他 `VarChar(*)` 风格（如 `kol.monetization_status VarChar(20)`）。

### #C — 4 行 B0 `email_template` fixture 数据处理

staging + prod 各 4 行 `(outreach / followup / accept / decline) × en`，字段 shape 与 BM2 不兼容，`createdBy` 都指向 marketer user。

| 方案 | 描述 |
|---|---|
| **A** 丢弃（DROP 带走） | 在 migration 内 DROP CASCADE；下 sprint F002 seed 补入 10 新系统模板 |
| B 迁移 | 写 DO block 尝试把 bodyHtml/bodyText 合成 body，category=type，createdBy 废弃，tenantId 保留 | **不可行**：category 值（outreach/followup/accept/decline）与 BM2 预设 5 模板名（Initial Outreach / Follow-up / Partnership Invitation / Polite Decline / Post-Collab Check-in）不对齐；双语（en+zh）也缺失 |

**建议：A**（B0 数据是孤立 fixture，现场无用户数据损失；F002 seed 会覆盖）

### #D — `campaign.product_id` FK 列类型

Product.id 是 `cuid()`（TEXT），spec 原文写 `@db.Uuid` 不对。

| 方案 | 描述 |
|---|---|
| **A** 列类型用 TEXT（无 @db.Uuid） | Prisma: `productId String? @map("product_id")`；SQL: `product_id TEXT` |
| B 迁 Product.id 到 UUID | 风险极高 + BM1 Product 已有数据 |

**建议：A**（与 Product.id 类型对齐；spec 原文是笔误，要在 spec + schema + migration 三处一致修）

### #E — `kol_campaign.status` 默认值改动

spec：从 `'candidate'` 改 `'pending'`。零历史行（`event_log + kol_campaign` 扫过无 B0 seed 行）。

| 方案 | 描述 |
|---|---|
| **A** 仅 `ALTER COLUMN ... SET DEFAULT 'pending'` | 后续 app 层写入用 zod enum 6 值 pending/contacted/quoted/signed/delivered/paid |
| B 同时 CHECK 约束 | 在 DB 层强制 status ∈ {6 值}；更严但改动 schema 多，后续扩展需 drop+recreate |

**建议：A**（与 Kol.relationshipStatus / Kol.monetizationStatus 等其他状态列 app-layer 校验惯例一致；BM2 F011 会加 integration test 覆盖 6 值）

### #F — `email_log.template_id` FK 补齐 + `ai_customized` 新增

现状：`template_id UUID` 列已存在但无 FK，无 ai_customized。

| 子决议 | 方案 |
|---|---|
| F1 FK constraint | **A** 补 `ALTER TABLE email_log ADD CONSTRAINT email_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES email_template(id) ON DELETE SET NULL` |
| F2 Prisma 关系 | **A** 补 `template EmailTemplate? @relation(fields: [templateId], references: [id])` + `EmailTemplate.emailLogs EmailLog[]` 反向 |
| F3 ai_customized | **A** ALTER ADD COLUMN `ai_customized BOOLEAN NOT NULL DEFAULT false` |

**建议：全 A**。ON DELETE SET NULL 语义合理——模板被删时日志保留但解除关联。

## 4. 风险登记（非决议）

| 风险 | 缓解 |
|---|---|
| DROP email_template 在 staging/prod 导致 4 行历史 fixture 数据丢失 | 4 行是测试 fixture，无用户依赖 |
| Migration `20260424200000_bm2_schema` 在 staging/prod 首次执行失败回滚 | ROLLBACK SQL 完整覆盖所有 CREATE + ALTER 逆操作；首次部署前本地 + Testcontainers 验证 |
| Prisma client 重新生成后，旧 EmailTemplate 使用点（如 import `EmailTemplate` 类型）编译失败 | 预先扫 `grep -rn "EmailTemplate" src/` 看有无代码依赖，此刻确认无业务代码引用（仅 schema 定义） |

## 5. 开工条件

收到 Planner 对 #A-#F 明确回复后，Generator 将：
1. 按决议更新 `prisma/schema.prisma`（Tenant / Kol / Campaign / KolCampaign / EmailTemplate 重建 / WeeklyReport / CampaignMetric / EmailLog）
2. 写 `prisma/migrations/20260424200000_bm2_schema/migration.sql`（DROP email_template + CREATE 新版 + ALTER 各表 + 新建 weekly_report / campaign_metric + 完整 ROLLBACK SQL + RLS NULLIF policy）
3. 写 `tests/integration/bm2-schema.test.ts` 覆盖 6 条决议点关联断言
4. 闸门：`npx prisma migrate dev`（本地）+ `npx prisma generate` + `npm test` + `npm run test:integration` 全绿 + `tsc --noEmit` + `lint`
5. Push 到 main，CI 必须 8 job 全绿

**自裁决机制：** planner=johnsong=Generator 同人。按 `pre-impl-adjudication.md §3.1-3.3` 惯例，在 §7 追加 Planner 裁决段，所有决议点必须给明确 A/B/C + 理由。

## 6. 估算开工时长

| 环节 | 预估 |
|---|---|
| 审计 + 自裁决 | 30 min（本文档） |
| schema.prisma 修订 | 20 min |
| migration SQL（含 ROLLBACK） | 40 min |
| tests/integration/bm2-schema.test.ts | 50 min |
| 本地 migrate + test + lint + typecheck | 20 min |
| CI watch + 修复（若有） | 30 min |
| **总计** | **~3 h** |

## 7. 相关文档

- Spec: `docs/specs/BM2-campaign-outreach-roi-spec.md §F001`
- Patterns: `framework/harness/database-patterns.md` §1 NULLIF + §2 命名一致性
- Audit pattern: `framework/harness/pre-impl-adjudication.md`
- BM1 前例: `prisma/migrations/20260424100000_bm1_schema/migration.sql` 头部注释风格

---

## 8. Planner 裁决（johnsong · 2026-04-24）

**短格式决议：** `#A:A #B:A #C:A #D:A #E:A #F1:A #F2:A #F3:A`

### 8.1 逐条理由

| # | 决定 | 理由 |
|---|---|---|
| #A | DROP + CREATE | 表 identity 无业务价值（无 FK 指向、无现存 app 代码依赖、无用户数据）。SQL 更简短且避免"遗留 bodyHtml 等列没删干净"的风险。生产/staging 4 行 fixture 同意丢弃（§8.2）。 |
| #B | 照搬 spec shape + `type @db.VarChar(20)` | spec §F001 已详细定型；为状态列统一风格，`type` 加 VarChar(20) 与 `kol.monetization_status` 一致。 |
| #C | 丢弃 B0 fixture | 4 行 `(outreach/followup/accept/decline) × en` 是早期手工数据 + `category` 值与 BM2 `type` 概念不兼容 + 无双语覆盖。F002 seed 会补 10 行系统模板。 |
| #D | `product_id TEXT`（无 @db.Uuid） | Product.id = cuid (TEXT)，FK 类型必须匹配。Spec 原文 `@db.Uuid` 是笔误，裁决同步修 spec §F001 文字。 |
| #E | 仅 SET DEFAULT `'pending'` | 与现有状态列风格一致（app-layer zod + F011 integration test 双重保险）。DB CHECK 约束后续扩展成本高。 |
| #F1 | 补 FK with `ON DELETE SET NULL` | 模板删除不应级联删除历史日志，SET NULL 保留 audit trail。 |
| #F2 | 补 Prisma 关系 | schema.prisma 双向声明；`EmailTemplate.emailLogs` 反向集合便于管理页统计模板使用情况（F011 或未来）。 |
| #F3 | 新增 `ai_customized NOT NULL DEFAULT false` | PRD §2.2 AI 定制采纳率 ≥40% 指标源，必填（无历史 email_log 行目前 —— `SELECT COUNT(*) FROM email_log` 为 0，DEFAULT false 对存量行无副作用即使未来有）。 |

### 8.2 同步文档更新清单

1. **本 PR**：
   - `prisma/schema.prisma` — 按裁决改
   - `prisma/migrations/20260424200000_bm2_schema/migration.sql` — 新建
   - `tests/integration/bm2-schema.test.ts` — 新建
2. **spec 修订**（本 PR 同 commit 带上）：
   - `docs/specs/BM2-campaign-outreach-roi-spec.md` §F001：`campaign.product_id @db.Uuid` → `product_id String` (TEXT) + 加一段 "#D 裁决结果" 引用本文件
   - 同文件 §F002 acceptance 不变（F002 seed 仍按 tenantId=null / type='system' / 10 行）
3. **features.json**：F001 acceptance 文本不需改（列的 `product_id Uuid FK` 语义明确，实际类型 TEXT 已由 spec + schema 同步修正；后续 Reviewer 若质疑以本 audit 为准）
4. **无需通知 Reviewer**：F001 尚在 building，未进 verifying；审计文档即 Reviewer 的参考源。

### 8.3 额外叮嘱（实现期容易踩的坑）

1. **DROP email_template 必须 `CASCADE`** 否则如果 `email_log.template_id` 暂存任何行会阻塞。实测目前 `email_log` 为 0 行（`SELECT COUNT(*) FROM email_log` 刚验证），但 migration 应防御性加 CASCADE。
2. **Prisma 客户端重生成**：`schema.prisma` 改后 `npx prisma generate` 不会自动跑，本地必须手动 + push 前 `git status` 确认没漏 `node_modules` 外的变更。
3. **RLS policy 必须 `NULLIF(current_setting('app.tenant_id', true), '')::uuid`**（database-patterns.md §1）。新表 `campaign_metric` / `weekly_report` / `email_template`（重建）三表都要补。EmailTemplate 的 `tenantId IS NULL` 系统模板查询走 superuser 或显式 `USING (... OR tenant_id IS NULL)` —— 选后者，因为外层 app 代码统一走 withTenant，允许 system 模板跨租户可读。
4. **WeeklyReport 分享 token 匿名查询**：spec §F001 "匿名分享查询走独立 `/shared/weekly-report/:token` 路由，走 superuser 连接绕 RLS"。本 F001 只建表 + RLS，查询路径是 F010 的事，不在 F001 scope。RLS policy 本期保守写 `USING (tenant_id = NULLIF(...))` 即可，F010 实施时需确认 superuser 路径可正确绕过。
5. **ROLLBACK SQL 完整性**：DROP TABLE 时要 DROP RLS POLICY 先（按 PG 语义 DROP TABLE 级联会带走 policy，但显式 DROP 更稳）。
6. **`kol_campaign.status` SET DEFAULT** 不改历史行值（PG ALTER DEFAULT 只影响后续 INSERT）—— 本期无历史行，零影响。
7. **Integration test setup** 必须走 `tests/helpers/db.ts` (Testcontainers)，与 BM1 F001 pattern 一致。

**裁决推送 main 后，Generator（我自己）立即开工实现（§5 清单）。**
