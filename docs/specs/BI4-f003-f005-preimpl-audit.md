---
发起者: johnsong (Generator)
日期: 2026-04-23
触发: BI4 F003 / F005 开工前审计，按 pre-impl 审计 → Planner 裁决工作范式
状态: 等待 Planner (Kimi) 明确回复，**未收到前不动 F003 / F005 代码**
---

# BI4 · F003 audit_log + F005 KOL tsvector · Pre-Impl 审计请求

## 1. 背景

Generator（johnsong）开工前扫描 `prisma/schema.prisma` 和 `prisma/migrations/` 现状，核对 BI4 spec（`docs/specs/BI4-architectural-guardrails-spec.md`）的 F003 / F005 实现描述，发现 **2 处严重 spec 字面冲突（§3.3 类型）**。若 Generator 按 spec 直接开工，会：
- F003：触发 Prisma `migrate dev` 冲突（`audit_log` 表已存在，CREATE TABLE 会失败）
- F005：触发 SQL 报错（`kol` 表不存在 spec 引用的列）

本文档列出事实、A/B 决议选项、Generator 建议。Planner 裁决后再动代码。

F001 / F002 / F004 审计后无冲突，Generator 同步开工，不阻塞本审计。

---

## 2. 冲突 #1 — F003 `audit_log` 表已在 B0 init 创建

### 2.1 事实

**已存在（B0 init migration + schema.prisma）：**

```prisma
// prisma/schema.prisma:259-274
model AuditLog {
  id           BigInt   @id @default(autoincrement())
  tenantId     String?  @map("tenant_id") @db.Uuid
  actorUserId  String?  @map("actor_user_id") @db.Uuid
  action       String
  resourceType String   @map("resource_type")
  resourceId   String?  @map("resource_id") @db.Uuid
  payload      Json?    @db.JsonB
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, resourceType, resourceId])
  @@map("audit_log")
}
```

对应 `prisma/migrations/20260418000000_init/migration.sql:182-195` 的 `CREATE TABLE "audit_log"`（BIGSERIAL id + resource_* 命名 + 单一 payload 字段）。

**`grep -rn 'AuditLog\|auditLog' src/` 结果：零引用**。表已创建但从未使用。

**BI4 spec F003 要求：**

```prisma
model AuditLog {
  id         String   @id @default(cuid())      // ← 与现状 BigInt 冲突
  tenantId   String?
  actorId    String   // ← 现状 actorUserId 可空；spec 必填、重命名
  action     String   @db.VarChar(64)
  targetType String   @db.VarChar(32)           // ← 现状 resourceType（命名不同）
  targetId   String   @db.VarChar(64)            // ← 现状 resourceId 可空、@db.Uuid
  before     Json?                               // ← 现状无
  after      Json?                               // ← 现状无
  ipAddress  String?  @db.VarChar(45)
  userAgent  String?  @db.Text
  createdAt  DateTime @default(now())
  @@index([tenantId, actorId, createdAt])
  @@index([targetType, targetId])
  @@map("audit_log")
}
```

冲突字段清单：

| 字段 | B0 现状 | F003 spec | 是否破坏性 |
|---|---|---|---|
| id 类型 | BigInt autoincrement | cuid() string | 是（主键类型无法 ALTER 平滑） |
| actorId | `actor_user_id` UUID nullable | `actorId` varchar 必填 | 是（列名 + 约束都变） |
| target* | `resource_type` / `resource_id` | `targetType` / `targetId` | 是（列重命名） |
| before/after | 不存在 | 新增 Json? | 非破坏（加列） |
| ipAddress 类型 | TEXT | VARCHAR(45) | 可 ALTER |
| 索引 | `(tenant,created)` / `(tenant,resource_type,resource_id)` | `(tenant,actor,created)` / `(target_type,target_id)` | 需 DROP+CREATE |

### 2.2 决议请求 #A —— 怎么处理已有 audit_log 表？

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A** DROP + CREATE（接受数据丢失） | 新 migration 先 `DROP TABLE audit_log` 再按 F003 spec 原样 CREATE | 最简单、schema 干净、完全按 spec 实现 | 丢弃 B0 表数据（当前生产/staging 应都是空表 —— 需确认）|
| **B** 保留旧表，新表改名 `audit_log_v2` | F003 spec 的表改 `@@map("audit_log_v2")`，旧表不动 | 保数据 / 无破坏迁移 | 两张表并存 + 命名难看 + spec 实现点都要改 |
| **C** ALTER 现有表到 F003 schema | 一连串 ALTER（rename column / add column / change type）把旧表改成 spec 要的样子 | 保数据 / 名字干净 | ALTER id 类型无法做（BigInt → String 主键必须重建）；等于仍是 DROP 操作 |
| **D** Spec 让步：沿用现有 B0 schema（BigInt / resource_* / payload） | F003 不建表，只建 helper `logAudit()` 包装 `prisma.auditLog.create({...})`；before/after 放入 payload Json | 零 migration 冲突、复用现有表 | F003 spec 的列结构全废 / TypeScript 强制 actorId 必填变软约束 / before-after diff 要序列化进 payload |

**Generator 倾向：D（spec 让步，沿用现状）**

理由：
1. 现有表是 B0 foundation 定义的"平台级审计 skeleton"，ADR 级别决定；BI4 作为 infra 补丁推翻它不合理
2. `resource_type` / `resource_id` / `payload` 的命名能承载 F003 spec 的全部语义（action + targetType + targetId + before/after → payload 封装）
3. 生产/staging 数据未知是否空；即使现在空，未来 hotfix 可能已用到
4. B5 级别的 audit UI / 合规查询时再统一升级，现在换结构是 YAGNI
5. helper `logAudit({actorId, action, targetType, targetId, before, after, ...})` 在应用层保持 spec API，DB 层兜底到 `payload`，符合"接口稳定 / 实现演进"原则

如果 Planner 坚持要新 schema（A/B/C），建议优先 A（simplest），并先跑 staging DB 确认 audit_log 为空。

---

## 3. 冲突 #2 — F005 tsvector 引用 `kol` 表不存在的列

### 3.1 事实

**BI4 spec F005 migration SQL 引用：**

```sql
UPDATE "kol" SET "search_vector" = 
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||      -- ← kol 无 "name" 列
  setweight(to_tsvector('english', coalesce(handle, '')), 'B') ||    -- ✓ 存在
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C') ||                    -- ← kol 无 "tags" 列
  setweight(to_tsvector('english', coalesce(array_to_string("knownBrandCollabs", ' '), '')), 'C');        -- ← kol 无 "knownBrandCollabs" 列
```

**`kol` 表现状（`prisma/schema.prisma:111-146` + init migration）：**

| spec 引用 | 实际列 | 说明 |
|---|---|---|
| `name` | `display_name` (String NOT NULL) | 列名不同 |
| `handle` | `handle` | ✓ 一致 |
| `tags` | `categories` (String[]) | spec 应为 `categories` |
| `knownBrandCollabs` | **不存在** | B0 schema 无此字段 |

### 3.2 相关信息

- `kol` 表其他文本字段：`bio`（可选）、`country_code`、`language`、`platform`
- `audienceAgeDist` / `audienceGeoDist` 是 Json，不适合 tsvector
- spec §2.3 写 "tsvector 字段范围：KOL 表的 name + handle + tags + knownBrandCollabs"
- 本批次 Out of Scope 包含"实际业务埋点"，所以不应新增 `tags`/`knownBrandCollabs` 列（那是业务 schema）

### 3.3 决议请求 #B —— tsvector 要索引哪些字段？

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A** 按实际列映射（推荐） | 改 migration：A 权重 `display_name`，B 权重 `handle`，C 权重 `array_to_string(categories, ' ')`，D 权重 `coalesce(bio,'')` | 零 schema 变更、MVP 就绪、权重合理 | 放弃 "knownBrandCollabs" 搜索维度（其实 kol 表也没这字段） |
| **B** 先在 F005 migration 里 add column tags / knownBrandCollabs 再索引 | 既按 spec 字面又按现状 | 与 spec 最接近 | 违反 BI4 Out of Scope（"实际业务埋点"/字段 = BM1/BM2 工作）；加了没数据写的列 = 死列 |
| **C** 只索引 3 字段 name(display_name)+handle+categories，不加 bio | 按 spec 字面字段数，只做别名 | 与 spec 语义最接近 | spec 写的 `knownBrandCollabs` 干掉没补偿，搜索维度只剩 3 |

**Generator 倾向：A**

理由：
1. F005 目的是"B1+ 全文搜索基建"。MVP 期 `display_name + handle + categories + bio` 已覆盖搜索用户最可能输入的关键词（人名、handle、游戏类目、介绍关键词）
2. `knownBrandCollabs` 根本不存在 —— spec 是 Planner 错记 / 想象的字段，不应为了维持 spec 字面而加无数据的列
3. 加 `bio` 权重 D（最低）对长尾搜索有帮助，成本 0
4. B1 搜索 sprint 真需要 KOL 品牌合作搜索时，届时 schema 有 `knownBrandCollabs` 列时再 ALTER tsvector trigger 加权重

对应重写的 trigger function（请 Planner 核对）：

```sql
CREATE OR REPLACE FUNCTION kol_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW.display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.handle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.categories, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3.4 附带决议 #C —— helper API 签名字段对齐

spec §4 F005 写：

```typescript
export async function searchKols(tenantId: string, query: string, limit?: number): Promise<Kol[]>
```

实现 OK，无冲突。但 spec 最后引用：

```typescript
// BM1 F004 / B1 未来全文搜索
const results = await searchKols(tenantId, 'dota streaming brasil');
```

说明用户期望能搜 `'dota'`（categories）、`'streaming'`（categories 或 bio）、`'brasil'`（bio 或 country_code）。方案 A 已覆盖前两项，brasil 靠 bio 命中。建议 Planner 确认：是否需要把 `country_code` 也并入索引（权重 E）？

| 方案 | 做法 |
|---|---|
| **A** 不加 country_code | 用户大多用 `countryCode` 做 filter（ILIKE 'BR'），不需 tsvector |
| **B** 加 country_code 权重 D | 支持输入 'brasil' 模糊搜到 BR 籍 KOL（但英文 'english' dict 对 'BR' 不生效，得额外加国家名字典映射 —— 过度设计） |

**Generator 倾向：A（不加）**。country_code 是 2 字母 ISO code，tsvector 无意义。

---

## 4. 其他次要澄清请求

### 4.1 决议请求 #D —— F002/F003 表无 RLS 是否正确？

spec §3 明确："event_log / audit_log 无 RLS（平台级记录）"。但 kol / user / campaign 等业务表都有 RLS。确认：新表 `event_log` 不写 `ENABLE ROW LEVEL SECURITY` 即可（现有 B0 audit_log migration 也未 ENABLE RLS）？

| 方案 | 做法 |
|---|---|
| **A** 不 ENABLE RLS，app 层控制读 | spec 原意 |
| **B** ENABLE RLS + 只给 platform_admin role 放行 | 更安全但管理复杂 |

**Generator 倾向：A（按 spec）**

### 4.2 决议请求 #E —— F003 sanitizeBefore 机制

spec §6 风险 5 提到 "可加字段级 mask 机制如 sanitizeBefore(userFields, ['password'])"。BI4 是否在 helper 里实现？

| 方案 | 做法 |
|---|---|
| **A** 不实现，留给 BM2 | spec 说"BM2 用户管理场景埋点时评估" |
| **B** 实现一个最小 masking util | 防备 BM2 忘了 sanitize 把 hashedPassword 写进 audit |

**Generator 倾向：A**（按 spec 字面）

---

## 5. 汇总决议请求（请 Planner 短格式回复）

| # | 主题 | 决议 | 选项 |
|---|---|---|---|
| A | F003 audit_log 表冲突 | 沿用 B0 schema / 重建 / 新表名 / 改列 | **A / B / C / D**（Generator 建议 D） |
| B | F005 tsvector 字段范围 | 实际列 / add column / 只 3 字段 | **A / B / C**（Generator 建议 A） |
| C | F005 加 country_code？ | 加 / 不加 | **A / B**（Generator 建议 A） |
| D | F002/F003 RLS | 不开 / 开 | **A / B**（Generator 建议 A） |
| E | F003 sanitize util | 不做 / 做 | **A / B**（Generator 建议 A） |

**回复格式：** `#A:D #B:A #C:A #D:A #E:A`（偏离 Generator 建议请附一句理由）

---

## 6. 开工条件

收到 Planner Kimi 对以上 5 条的明确回复后，Generator 将：

1. 按决议更新 F003 实现（schema + migration + helper）
2. 按决议更新 F005 migration + trigger SQL
3. 走 F007 ROLLBACK SQL 校验 + CI 闸门
4. Push 到 main

**未收到明确回复前，F003 / F005 不动代码。**

F001 / F002 / F004 审计无冲突，Generator 同步开工（独立推进）。

---

## 7. 相关文档

- `docs/specs/BI4-architectural-guardrails-spec.md`（本次审计对象）
- `prisma/schema.prisma`（现状 AuditLog / Kol 模型）
- `prisma/migrations/20260418000000_init/migration.sql`（audit_log 已创建处）
- `framework/harness/pre-impl-adjudication.md`（本审计所依据的工作范式）
- `framework/harness/database-patterns.md`（§2 migration 命名一致性）

---

## 8. Planner 裁决区（Kimi 请在此追加）

*（等待 Planner 填写）*
