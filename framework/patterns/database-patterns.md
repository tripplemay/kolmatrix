# Database Patterns（框架沉淀）

> 跨批次通用的数据库设计 / schema 写作坑。Planner 在写涉及 DB schema、migration、RLS 的 spec 时必读本文件核对。

---

## 1. PostgreSQL RLS 策略：`current_setting` 必须 NULLIF 兜底

### 1.1 坑

`current_setting('app.xxx', true)::uuid` 直接强 cast，在 session 生命周期内会遇到 3 种返回状态：

| session 状态 | `current_setting(...)` 返回 | 直接 `::uuid` 行为 |
|---|---|---|
| 从未触达过该 GUC | `NULL` | `NULL::uuid = NULL`（安全） |
| SET LOCAL 触达过后 tx 结束 | `''`（空串，非 NULL） | **THROW** `invalid input syntax for type uuid: ""` |
| 当前 tx 内 SET LOCAL | 具体值 | 正常 cast |

**关键陷阱：** `current_setting(key, true)` 的 `true` 参数只是"missing 时不报错"，但只要 session 对某个 GUC 触达过（SET 或 SET LOCAL），该 key 在 session 剩余生命周期内值会变成 `''`——**不会**恢复到 missing 状态。

### 1.2 后果

- RLS USING 谓词直接 raise → 整个查询失败
- Postgres OR 不短路异常：即使 `OR is_platform_admin = true` 右侧应该成立，左侧的 cast 异常在执行期已抛
- 连接池复用场景（Prisma、node-pg Pool）：**flaky** —— 随机命中受污染连接时 throw，没被污染时 pass
- 典型症状：E2E 测试 workers=1 也会偶发失败，"有时 PASS 有时 FAIL"，调试期生产 fixtures 的超级管理员绕过路径不稳

### 1.3 正确模板

```sql
-- ✅ 正确：所有 RLS 策略统一用 NULLIF(..., '')::uuid 兜底
CREATE POLICY tenant_isolation ON "kol"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_platform_admin', true)::bool = true
  );
```

`NULLIF('', '')` → `NULL`，使 `tenant_id = NULL::uuid` 为 NULL（默认拒，符合 RLS 语义）。三态都稳定：

| session 状态 | `NULLIF(current_setting(...), '')::uuid` | RLS 判定 |
|---|---|---|
| 从未 SET | NULL | `tenant_id = NULL` = NULL → 过滤（默认拒） |
| SET 后 tx 结束 | NULL（NULLIF 把空串转 NULL） | 过滤（默认拒） |
| 当前 tx 内 SET | 具体 uuid | 匹配或过滤 |

### 1.4 反面案例（不推荐的替代方案）

| 方案 | 评价 |
|---|---|
| 在 `withTenant` 每次 tx 开头 `RESET app.tenant_id` | 治标：RESET 不会抹除"touched"状态，GUC 值仍可能是 `''`；还会遮蔽真实 bug |
| `SET LOCAL app.tenant_id = '00000000-...-0000'` 哨兵值 | 引入魔数，业务代码读 GUC 要处处特判 all-zero uuid |
| `ALTER DATABASE SET app.tenant_id = 'NULL'` | 依赖超级用户权限；仍可能与 SET LOCAL 交互出新坑 |

`NULLIF` 是最小面积、最直接语义的方案。

### 1.5 Planner 检查清单

新批次涉及以下场景时，Planner 审核期必须逐条核对：

- [ ] 任何新增 RLS 策略的 USING / WITH CHECK 谓词是否都用 `NULLIF(current_setting(...), '')::uuid`？
- [ ] 任何引用自定义 GUC 的 SQL（不限 RLS）是否考虑了空串返回？
- [ ] 相关 Prisma migration 是否有 rollback 段？
- [ ] 集成测试 `tests/integration/rls-*.test.ts` 是否稳定断言"不带上下文 → 0 rows"而非 try/catch 接受 throw？

---

## 2. 数据库命名 / 角色 / Grant 对象必须与 migration 硬编码一致（Planner spec 起草期必扫）

### 2.1 坑

init migration 常含硬编码的 DB 名 / 角色名 / 权限对象名，例如：

```sql
-- prisma/migrations/20260418010000_app_role/migration.sql
CREATE ROLE kolmatrix_app NOLOGIN;
GRANT CONNECT ON DATABASE kolmatrix TO kolmatrix_app;
--                     ↑ 这里硬编码了 DB 名
```

一旦 migration 被执行，该命名就成了**事实**：
- 生产 DB 必须叫 `kolmatrix`（否则 `GRANT CONNECT ON DATABASE kolmatrix` 失败）
- spec / architecture.md / environment.md 里写 `kolmatrix_prod` 就是漂移

### 2.2 后果

Planner spec 文档里假设一个 DB 名（如 "kolmatrix_prod"），但 init migration 写的是另一个（如 "kolmatrix"），导致：
- 首次 bootstrap 生产被迫按 migration 命名（硬编码无法绕过），与 spec 不符
- 所有引用 DB 名的下游文档（runbook / infrastructure.md / backup 脚本 / env file / deploy script）都要做一次对齐
- Generator 要反复 SSH 修文件、Planner 要出裁决、多一次 round-trip

KOLMatrix BI2 案例：prod bootstrap 时发现 migration 硬编码 `kolmatrix`，spec 和 5 份 docs 都写 `kolmatrix_prod`，最终 Planner 裁决方案 A（统一 follow migration 固定名 `kolmatrix`）全文档追随。

### 2.3 Planner spec 起草期检查清单

写涉及 database / role / grant 的 spec 前，**必须**先扫一遍：

```bash
# 查 migration 里所有硬编码的 DB 名、角色名、权限对象名
grep -rE 'DATABASE|CREATE ROLE|GRANT|REVOKE|ALTER ROLE' prisma/migrations/*/migration.sql
```

- [ ] spec / architecture / environment / runbook / backup-script 里出现的 DB 名，与 migration 硬编码**完全一致**？
- [ ] spec / role 相关段落里出现的 PG 角色名，与 migration `CREATE ROLE` 完全一致？
- [ ] spec 里写的 "XXX user has Y privilege" 与 migration `GRANT/REVOKE` 一致？
- [ ] 如果 spec 和 migration 冲突，**以 migration 为准**（已执行的事实）；不一致时 Planner 改 spec，不改 migration

### 2.4 更深一层：为什么不能"改 migration"

Prisma migration 一旦 `migrate deploy` 成功，记录进 `_prisma_migrations` 表，不能再改原文件（会 hash 不匹配）。修正名字需要新 migration `ALTER DATABASE ... RENAME` + `REVOKE / REGRANT`，生产执行风险远高于"文档追随 migration"。所以 Planner **主动对齐到 migration** 是正确方向。

---

## 来源

- KOLMatrix BI1-F008 marketer E2E flaky 根因（§1，2026-04-19）
- KOLMatrix BI2 DB 命名 spec 漂移（§2，2026-04-20）
- 相关文档：`docs/specs/BI1-f008-rls-nullif-fix.md` / `docs/specs/BI2-deployment-automation-spec.md`

---

## 3. Prisma 7+ JSON 列写入需 `as Prisma.InputJsonValue` cast（或函数返回类型收紧）

### 3.1 坑

KOLMatrix B5 F004 / F006 同坑（commits 3349a9a + 类似）：

```typescript
// recent-videos.ts:140
await tx.kol.update({
  where: { id: opts.kolId },
  data: { metadata: mergeMetadata(opts.metadata, next) },
  //              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //              TS2322: Type 'Record<string, unknown>' is not assignable
  //              to type 'InputJsonValue | NullableJsonNullValueInput | undefined'
});
```

`mergeMetadata()` 返回 `Record<string, unknown>`，Prisma 7 的 `Json` 列输入是 `InputJsonValue` 联合类型（不接受 `unknown` 类内的任意 shape）。

### 3.2 正解

**优先：函数返回类型收紧到 `Prisma.InputJsonValue`** —— 一处改、调用点全部受益：

```typescript
import type { Prisma } from "@prisma/client";

export function mergeMetadata(
  existing: Prisma.JsonValue | null,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  // ... merge logic
  return merged as Prisma.InputJsonValue;
}
```

**次选：调用点 cast** —— 如果 `mergeMetadata` 是公共 util 不能改返回类型：

```typescript
data: { metadata: mergeMetadata(opts.metadata, next) as Prisma.InputJsonValue }
```

### 3.3 Spec / Generator checklist

任何 lib 函数返回 → Prisma JSON 列写入 → spec § acceptance 必含：

- [ ] 返回类型是 `Prisma.InputJsonValue` 或显式 cast
- [ ] CI typecheck 全绿（不能依赖 `// @ts-ignore` 抑制）

CI 容易漏掉这一条因为 `chore(state)` paths-ignore 跳过 typecheck。Generator 推 product code commit 时**必须验证 typecheck 实跑通**（不要靠后续 chore commit 推时再 retrigger）。

来源：KOLMatrix B5-F004 (commit 0dd1697 latent / 3349a9a fix) + B5-F006 (commit 3349a9a)。

---

## 4. RLS 旁路矩阵 + cross-tenant ops 决策树

### 4.1 坑

`withPlatformAdmin` 名字让人以为它是"通用 RLS 旁路"，实际只对 `user` 表的 `user_isolation` 策略生效（policy 显式判 `app.is_platform_admin = true`）。其它带 RLS 的表（`product` / `asset` / `kol` / `campaign` / `email_template` / `email_log` / `kol_campaign` / `campaign_metric` / `weekly_report`）只认 `app.tenant_id`，没看到匹配 tenant 就**静默返 0 行**——不会抛错，看上去查询正常但结果是空。

KOLMatrix BL-030-F003 backfill 脚本就踩了这个坑：用 `withPlatformAdmin` 跨 tenant 扫 `product` 表，prod 跑出来 0 行，到 BL-031 才暴露。生产 5 个 product 的 ai_assets 内容延迟一天进 Asset 表。

### 4.2 旁路矩阵

| 表 | RLS 状态 | 旁路条件 |
|---|---|---|
| `tenant` | **未启用 RLS** | 任何 connection 都可读（credentials auth 流的 lookup 表） |
| `user` | RLS on | `app.tenant_id` = uuid **OR** `app.is_platform_admin` = true |
| `product` / `asset` / `kol` / `campaign` / `email_template` / `email_log` / `kol_campaign` / `campaign_metric` / `weekly_report` | RLS on | 仅 `app.tenant_id` = uuid（platform_admin 不解） |

### 4.3 cross-tenant ops 决策树

应用层（Prisma client 走 `kolmatrix_app` role）想跨 tenant 操作时：

1. **是否能枚举 tenant 列表？** `prisma.tenant.findMany` 直接读（tenant 表无 RLS）
2. **每个 tenant 的业务读写 →** `withTenant(tenantId, tx => ...)` 串行循环，policy 自动生效
3. **绕不过 RLS（跨 tenant 直接 SELECT 业务表）→** ops 层走 sudo postgres `psql` 直跑（superuser 绕 RLS）；migration / backfill / 一次性 admin 任务专用，不进应用代码路径

应用代码**不应**出现 `SET LOCAL row_security = off`、`SET ROLE postgres` 等 superuser 切换——这把 RLS 完全卸了，是 audit 灾难。需要这种力度的操作 = 该任务属于 ops 层而非 app 层。

### 4.4 BL-030 案例的正解

`scripts/migrate-product-aiassets-to-asset.ts` 的 `scanProducts`：

```typescript
// ❌ 错的：withPlatformAdmin 对 product 表无效，silently 返 0 rows
return withPlatformAdmin((tx) => tx.$queryRaw`SELECT ... FROM product`);

// ✅ 对的：tenant.findMany 直读 + per-tenant withTenant 累加
const tenants = await prisma.tenant.findMany({ select: { id: true } });
const rows: ProductScanRow[] = [];
for (const { id: tenantId } of tenants) {
  const slice = await withTenant(tenantId, (tx) => tx.$queryRaw`SELECT ... FROM product`);
  rows.push(...slice);
}
return rows;
```

### 4.5 Generator / Planner 检查清单

- [ ] 任何用 `withPlatformAdmin` 的代码点：被读的表是否真的是 `user` 或无 RLS 表？读 `product` / `asset` / `kol` 等业务表时它**不生效**
- [ ] 跨 tenant 扫描需求 = 要么 `tenant.findMany` + `withTenant` 循环，要么标注为 ops 层任务走 sudo postgres
- [ ] 应用代码内出现 `SET LOCAL row_security = off` / `SET ROLE postgres` = 立即换 ops 层路径
- [ ] backfill / migration 脚本：fixture 必须含 ≥2 tenant，验证扫到所有 tenant 而非首 tenant 或 0

### 4.6 跨 tenant 平台级聚合 — withPlatformAdmin vs 循环 tenant set_config（v0.9.24 #13 / BL-075 #13）

**坑（BL-075-F006 prod regression）：** `/api/health` `kol_coverage` deploy 后显示 0 行（应 1397）。根因：`kol` 表 RLS policy 仅 `tenant_id = NULLIF(current_setting('app.tenant_id'), '')::uuid`（详 §4.2 矩阵），对 `app.is_platform_admin` 视而不见 → withPlatformAdmin 设的 `is_platform_admin=true` 在 kol 表无效 → `app.tenant_id` 仍 NULL → RLS 拒绝返 0 行。**Build / lint / type-check 全过**，prod 部署后才 surface（kol_coverage 数字 = 0 是 UI 显示 bug，没异常 throw）。

#### 4.6.1 Generator self-check（写 withPlatformAdmin 调用前必跑）

**第一步必须先 grep `pg_policies` 查目标表 `qual`**，确认 RLS policy 是否含 `is_platform_admin` 旁路：

```sql
-- prod 或 staging DB sample
SELECT polname, qual FROM pg_policy WHERE polrelid = '<table>'::regclass;
```

| qual 含 `is_platform_admin = true` | withPlatformAdmin 是否生效 | 适用 |
|---|---|---|
| ✅ 含 platform_admin 旁路（如 `user` 表 `user_isolation` policy） | ✅ 生效 — 单 query 走 withPlatformAdmin | platform 级查询不需循环 tenant |
| ❌ 仅 tenant_id 比较（如 `kol` / `campaign` / `product` 等业务表） | ❌ **不生效** — 必须循环 tenant + per-tenant `set_config` | 业务表跨 tenant 聚合的唯一正确路径 |

#### 4.6.2 两模式选用矩阵

| 场景 | 模式 | 代码模板 |
|---|---|---|
| **目标表 RLS policy 含 platform_admin 旁路**（如 `user` 表查所有 user） | 单 query withPlatformAdmin | `await withPlatformAdmin((tx) => tx.user.findMany({ select: { id: true } }))` |
| **目标表 RLS policy 仅 tenant_id 比较**（如 `kol` / `campaign` / `asset` 业务表跨 tenant 聚合） | 循环 tenant + per-tenant `set_config` | 见下方代码块 |

**循环 tenant + per-tenant set_config 模板（业务表跨 tenant 聚合）：**

```typescript
// ❌ 反例（BL-075-F006 prod 0 行）
const kolCount = await withPlatformAdmin((tx) =>
  tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM kol`
); // app.tenant_id NULL + kol policy 不旁路 → 0 行

// ✅ 正解（循环 tenant + per-tenant set_config）
const tenants = await prisma.tenant.findMany({ select: { id: true } });
let totalCount = 0;
let totalCountryFilled = 0;

for (const { id: tenantId } of tenants) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`, tenantId,
    );
    const slice = await tx.$queryRaw<
      { total: bigint; country_filled: bigint }[]
    >`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE country IS NOT NULL) AS country_filled
      FROM kol
      WHERE is_active = true
    `;
    totalCount += Number(slice[0].total);
    totalCountryFilled += Number(slice[0].country_filled);
  });
}

return { totalCount, totalCountryFilled };
```

#### 4.6.3 验证方式（deploy 前必跑）

deploy 后 curl prod `/api/health` 等聚合 endpoint 实测 vs `sudo psql` 直查 count(*) 比对：

```bash
# prod 实测应用层 (走 RLS)
curl https://kol.guangai.ai/api/health | jq .kol_coverage.total_active_kols

# DB 直查 (sudo psql 绕 RLS 用 superuser role)
sudo -u postgres psql -d kolmatrix -c "SELECT count(*) FROM kol WHERE is_active = true"

# 两数差异 → 即暴露 withPlatformAdmin 失效
```

#### 4.6.4 与 §4 旁路矩阵 + §4.3 决策树关系

本段是 §4 旁路矩阵 + §4.3 cross-tenant ops 决策树在 **「应用层 platform 级聚合」** 场景的细化：

- §4.2 旁路矩阵告诉你「policy 是否含 platform_admin 旁路」
- §4.3 决策树告诉你「跨 tenant ops 选 withTenant 循环 vs ops 层 sudo postgres」
- §4.6 本段告诉你**应用层** platform 级聚合（如 /api/health 跨 tenant 统计）的具体两模式选用 + Generator self-check + 验证手段

**为什么不能走 §4.3 第 3 项 ops 层 sudo postgres？** /api/health 等应用 endpoint 必须走 Prisma client（kolmatrix_app role），不能切 superuser；所以唯一可行是「循环 tenant + per-tenant set_config」。

**来源：** BL-075-F006 prod regression (`/api/health` kol_coverage 0 行 应 1397) + v0.9.24 #13 用户 2026-05-26 ack。

---

## 5. 跨表 id 类型一致性（v0.9.9 — BL-031 沉淀）

**坑：** Prisma schema 中 `Product.id` 是 `cuid` 字符串（DB 列实际为 `text`）；`Asset.product_id` 也是 text 实际存 cuid，但 raw SQL 中如果误用 `${productId}::uuid` cast → `42883 operator does not exist text=uuid`。Mock-only 单测无法抓出此 schema-DB 漂移类 bug。

**Generator/Planner 检查清单（跨表 id 引用 raw SQL 时）：**

```bash
# 验证 Prisma schema 类型注解 vs DB 列实际类型
grep -A1 "model Asset" prisma/schema.prisma | grep "productId"     # schema 声明
psql -c "\d asset" | grep product_id                               # DB 实际列类型
# raw SQL ${value}::TYPE cast 必须匹配 DB 实际列类型，不要按 schema 注解假设
```

**修订规则：**

- raw SQL `tx.$queryRaw\`... WHERE x = ${value}::TYPE\`` 中**不要假设 cast 类型**，必须先 `\d <table>` 实测
- Prisma 生成的 query（非 raw）按 schema 类型自动处理，无此坑
- mock-only 单测验证不到 schema-DB 漂移；必须 staging 端到端跑 `.ts` 脚本（见 §7）

**来源：** BL-031-F003 c1405c7 hotfix（drop ::uuid cast）。BL-030 prod 没暴露因为 scanProducts 当时 RLS 阻塞返 0 跳过此路径；BL-031 修 scanProducts 后才显形。

---

## 6. Silent updateMany 模式 + dualWrite 返回 void（v0.9.9 — BL-032 S3 沉淀）

**模式：** `mutations.ts` 中 `dualWriteEmailTemplateOnUpdate` 用 `tx.emailTemplate.updateMany({ where: { id }, data })`，updateMany 在 0 行命中时**静默返回 count=0**（mutations.ts:148 已注释 "updateMany 返回 count=0 silently — acceptable"）。

**坑（BL-032 S3）：** Asset 端写成功，但 dualWrite 镜像因前批次 SQL ops 漏跑导致 mirror 缺失 → updateMany 静默返 0 → 上层无感知 → 持续漂移。

**修订规则：**

- 任何 `updateMany` 在 dual-write / mirror / cleanup 路径上的应用，**必须显式 stats 日志**：

```ts
const r = await tx.emailTemplate.updateMany({ where, data });
console.log(`[dualWrite] mirror updated count=${r.count} expected=1 for asset=${assetId}`);
if (r.count === 0) console.warn(`[dualWrite] silent miss — mirror may be missing`);
```

- backfill / migration 脚本必须把 dualWrite 行为纳入 stats 输出（BL-032-F002 脚本以 `mirrorsAttempted` (= updated assets) 替代，因 dualWriteOnUpdate 不返 count；当前最佳）

**长期：** 改 `mutations.ts` 让 dualWrite 函数返回 affected count → 调用方可断言期望值 → 静默失败转显式失败。留 v1.0 候选批次。

**来源：** BL-032 Soft-watch S3。BL-030 ops 漏 dualWriteOnCreate 的 FK orphan 是同模式不同函数。

---

## 7. Generator 实装后 staging 端到端跑 .ts 脚本硬要求（v0.9.9 — BL-031 沉淀）

**坑：** Generator vitest mock fetch / mock prisma 单测通过 ≠ 脚本 prod-shaped 数据下能跑通。BL-031-F003 backfill 脚本本地 mock 测试 6/6 PASS，staging 二跑发现 `${productId}::uuid` cast 撞 42883（asset.product_id 实际是 text）→ 二次 commit c1405c7 修。

**修订规则：**

- 所有 `scripts/*.ts` 脚本在 `executor:generator` 完成后，**必须 staging 端到端跑一次 dry-run**：

  ```bash
  ssh tripplezhou@staging
  cd /opt/kolmatrix-staging
  set -a && source .env.staging && set +a
  node_modules/.bin/tsx scripts/<your>.ts  # 默认 dry-run
  ```

- staging dry-run 必须返回非空 stats；若 staging 数据集真的无候选，generator_handoff 必须明文说明"staging 无 fixture 数据，algorithm correctness 由 mock 单测验证"
- 失败 → 视为 acceptance 不满足，回 fixing；非 verifying 受理范围

**反面：** BL-031-F003 mock-only PASS → CI green → 切 verifying → Reviewer 跑 staging 才发现 cuid bug → c1405c7 二跑修。本可在 building 阶段提前 24h 发现。

**来源：** BL-031-F003 cuid cast bug。BL-032 building 已遵守此规则跑了 staging dry-run（虽 staging 无 fixture）。

---

## 8. Migration 引入新表必查 RLS policy 默认 enabled（v0.9.11 — backend-full-scan-audit 沉淀）

**坑：** backend-full-scan-2026-05-04 audit DB-CRIT-1 暴露 `audit_log` + `event_log` 两张表 migration 引入时未配 RLS policy → 全裸 SELECT 跨租户读漏洞。复盘 BL-005 / BL-007 等历史批次也漏过同模式。

**Planner / Generator 检查清单（任何新 prisma migration 创建 table 时）：**

```bash
# 起草 migration 后跑：
grep -l 'CREATE TABLE' prisma/migrations/*/migration.sql | head -5
# 任意新 CREATE TABLE 必须同 migration 含：
# 1. ENABLE ROW LEVEL SECURITY
# 2. CREATE POLICY ... USING (...)
grep -A2 'CREATE TABLE' prisma/migrations/<new>/migration.sql
```

**默认 RLS policy 模板（适用 99% 业务表）：**

```sql
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_tenant_isolation" ON "<table>"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
```

兼容 §1 NULLIF 兜底约定 + 无 tenant_id 列的 cross-tenant 元数据表不适用。

**例外白名单（不需 RLS policy）：**

| 表 | 理由 |
|---|---|
| `tenant` | 无 tenant_id 列；credentials auth 流的 lookup 表 |
| `user` | 已有 `user_isolation` policy 含 platform_admin 旁路（详见 §4 旁路矩阵） |
| `_prisma_migrations` | Prisma 内部表，superuser 专用 |

**新表落入白名单的判据：** 表无 tenant_id 列且不存任何 tenant-specific data。否则一律走默认模板。

**Spec 起草必含段落（任何新建 table 的 migration）：**

```markdown
**RLS 策略（v0.9.11 框架硬要求）：**
- 表：`<new_table>`
- 列：含 / 不含 `tenant_id` 列
- Policy：`<table>_tenant_isolation`（默认模板复用）
- 验证：`tests/integration/<table>-rls.test.ts` ≥2 case：tenant A 写 / tenant B 读返 0
- 例外（如适用）：标注白名单理由
```

**反面：** `audit_log` 表 BL-005 引入时未配 RLS，prod 跨 tenant SELECT 暴露 N 月；`event_log` 同模式。BL-034 (本批次) 收尾时一并修补。

**来源：** KOLMatrix `docs/reviews/backend-full-scan-2026-05-04.md` DB-CRIT-1 / DB-H1。BL-005 (audit_log) + BL-007 (event_log) 历史漏洞溯源。

### 8.1 同 migration 启用多表 RLS 时 cross-cutting helper 必须同 commit 配套改 withTenant（v0.9.12 — BL-034 F003 沉淀）

**坑：** 启用 `audit_log` + `event_log` 两表 RLS 时，BL-034 spec §F003 原仅要求 `logAudit` 改 `withTenant`，未列同 commit 必须配套改 `logEvent`。结果：`logEvent` 的 33 处调用方在 RLS 启用瞬间 **silent fail**（withTenant 无 tenantId 时 `app.tenant_id` 取空字符串 → RLS 拒写 INSERT，但因为是异步 fire-and-forget 模式不抛错给上层）。Generator Kimi 实装时主动同 commit `a23d24d` 配套修，避免 prod 部署后静默丢事件。

**这是 cross-cutting helper 的典型坑** — `logAudit` / `logEvent` / `metrics.record` / `analytics.track` 等横切函数被 N 处调用，spec 起草时只看到「主要用法」一处。

**Spec 起草 + Generator 开工 checklist（任何启用 RLS 的 migration）：**

```bash
# Generator 开工前必跑：
grep -rn "logAudit\|logEvent\|metrics\.\|analytics\." src/ | wc -l
# 必须 ≤ 启用 RLS 的表数 × 30，否则有遗漏调用方
# 列出每个调用方的 tenantId 来源（请求上下文 / withTenant 上层 / platform-level）
```

**Spec acceptance 必含子项：**

> [ ] 列出本 migration 启用 RLS 的所有 cross-cutting helper（grep 全仓 logXXX / metrics / analytics / cache.delete 等）+ 每个 helper 在新 RLS 下的行为分支（withTenant 旁路 / platform-level 直写 / 错误抛出）。Generator 开工前提交 helper 调用方核查清单作 generator_handoff 一项。

**反面：** BL-005 / BL-007 引入 audit_log / event_log 时若 spec 没强求核查 logEvent 33+ 调用方，启用 RLS 后静默丢事件可能数月不被发现（事件丢失不报错，仅是 audit/observability 维度数据缺失）。BL-034 借由 Generator 主动责任心避开了此坑，但下次同模式靠运气不可靠。

**来源：** BL-034 F003 a23d24d Generator 主动同 commit 修复 logEvent → 提案 v0.9.12 沉淀（用户 2026-05-05 全 Accept）。配套同坑 BL-031 silent updateMany 模式（§6）。

---

## 9. Schema migration ROLLBACK 不对称风险 — 扩范围 migration 必带 UPDATE clamp 前置 step（v0.9.24 #16 / BL-076 #16，扩展 BL-070 #22）

**Migration 顺向无损 ≠ ROLLBACK 无损。** 扩范围 migration（NUMERIC(M,N) / VARCHAR(N) 增大）顺向无损（小集合 ⊂ 大集合），但 ROLLBACK（大集合 → 小集合）若 prod 已含越界 row → `value out of range` throw。本段是 §12 `prisma migrate dev` wrap ROLLBACK skeleton 注入 + `scripts/validate-rollback-sql.sh` CI 检查（BL-070 #22）的 **数据维度补充** — 即使 ROLLBACK SQL 形式正确，运行时仍可能 fail。

### 9.1 反例 — BL-076-F001 engagement_rate NUMERIC(5,2) → (7,2)

**顺向（无损）：**

```sql
ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(7, 2);
-- 5,2 ⊂ 7,2，任意已存在 row 均可 cast
```

**ROLLBACK（非对称 — fail）：**

```sql
ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(5, 2);
-- ❌ ERROR: numeric field overflow
-- DETAIL: A field with precision 5, scale 2 must round to an absolute value less than 10^3.
-- prod 已含 15 行 engagement_rate > 999.99（adapter clamp 上限 99999.99，详 §11）
```

### 9.2 模板 — ROLLBACK SQL 含 UPDATE clamp 前置 step

```sql
-- 顺向 (无损):
ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(7, 2);

-- ROLLBACK (非对称, prod 已含 > 999.99 行时必须先 UPDATE clamp):
-- Step 1: clamp 越界 row 到 ROLLBACK 目标范围
UPDATE "kol"
SET "engagement_rate" = LEAST("engagement_rate", 999.99)
WHERE "engagement_rate" > 999.99;

-- Step 2: ALTER (此时无越界 row)
ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(5, 2);
```

**关键设计：**
- UPDATE 必须先于 ALTER，否则 ALTER throw 后 UPDATE 没机会执行
- clamp 用 `LEAST(col, MAX)` 而非业务阈值，确保 ROLLBACK 数据不丢精度（数据损失最小化）
- `WHERE col > MAX` 限制扫描行 — 大表 ROLLBACK 避免全表 UPDATE
- ROLLBACK 注释**显式说明**「prod 已含越界 row 时必须先 UPDATE clamp」(避免下次类似 ROLLBACK 时重新踩坑)

### 9.3 适用边界

| Column type | ROLLBACK 不对称风险 | 应对 |
|---|---|---|
| **NUMERIC(M,N)** | ✅ 有 — 缩 precision/scale 可越界 | ROLLBACK 必带 UPDATE clamp 前置 |
| **VARCHAR(N)** | ✅ 有 — 缩长度可截断 | ROLLBACK 必带 UPDATE substring 前置（按业务决定保留前缀 / 抛错） |
| **DECIMAL(M,N)** | ✅ 同 NUMERIC | 同 NUMERIC |
| **Int → SmallInt** | ✅ 有 — int 值可能超 smallint 范围 | ROLLBACK 必带 UPDATE clamp 或 fail-fast |
| **Int / BigInt / Text / Uuid / Boolean / Json** | ❌ 无尺寸约束 | ROLLBACK 安全，不需 UPDATE 前置 |

**ROLLBACK skeleton 默认模板（BL-070 #22 sediment 已实装 `scripts/prisma-migrate-dev-wrap.sh`，详 §12）当前不自动检测尺寸约束扩缩。**未来 enhancement：wrap script 增量解析 ALTER COLUMN TYPE 是否含尺寸约束类型 + 顺向是否「扩」 → 自动注入「ROLLBACK: 提醒 prod 数据查 max(col)」step。留 BL-078+ follow-up。

### 9.4 Generator self-check 流程

写 ROLLBACK SQL 时按以下三步判断：

1. **顺向 ALTER 是否含尺寸约束类型扩范围？**（NUMERIC / VARCHAR / SmallInt 等扩大）
2. 若是 → 查 prod 实际 value range 是否已越界 ROLLBACK 目标范围：
   ```sql
   SELECT max(engagement_rate), count(*) FILTER (WHERE engagement_rate > 999.99)
   FROM kol;
   ```
3. 越界 → ROLLBACK 必加 `UPDATE ... clamp` 前置 step + 注释说明触发条件

### 9.5 配套上游沉淀（adapter 端 clamp）

`engagement_rate > 999.99` 现象的本质是 adapter 输出未 clamp 业务阈值 + DB 上限留余量。**详 §11 adapter output 边界 check 三件套 — clamp + outlier flag + 业务阈值 < DB 上限**：业务阈值 (100%) < DB 上限 (99999.99) — 异常先标 flag 不丢数据，DB 边界仅最后兜底。

**来源：** BL-076-F001 prod schema migration 实战（顺向 deploy OK，ROLLBACK 测试时 fail）+ v0.9.24 #16 用户 2026-05-27 ack（扩展 BL-070 #22 §12 ROLLBACK skeleton 注入）。

---

## 10. DB / 外部 API batch 健壮性 — per-element try/catch + stats + audit forensic（v0.9.24 #15 / BL-076 #15）

**坑：** `for ... of` 内 `prisma.upsert` / 外部 API call / 文件 IO 默认假设全部成功 → 单元素异常 throw 阻塞整 batch。BL-076-F003 根因：`scripts/kol-sync-daily.ts` import.ts `for raw of raws` loop 无 per-KOL try/catch → 第一个 numeric overflow throw → 整 2567 KOL batch fail（`inserted=0 updated=0 errors=1`），prod 数据同步管道在沉默中断 14 天。

**模板：**

```typescript
const stats = { success: 0, failed: 0 };

for (const item of items) {
  try {
    await prisma.X.upsert({ where: { ... }, create: { ... }, update: { ... } });
    stats.success += 1;
  } catch (err) {
    stats.failed += 1;
    console.error("[batch] item failed:", item.id, err);

    // forensic：失败明细落 audit_log（嵌 try/catch 防 audit 再 throw recurse）
    try {
      await prisma.auditLog.create({
        data: {
          action: "X.failed",
          tenantId: item.tenantId ?? null,
          payload: {
            itemId: item.id,
            itemSummary: { /* 最小可识别字段，避免敏感数据 */ },
            error: String(err).slice(0, 500),
          },
        },
      });
    } catch (auditErr) {
      // swallow — audit 失败不能阻塞主 batch；上层 log monitoring 兜底
      console.error("[batch] audit failed:", auditErr);
    }
  }
}

return stats; // 上层 caller 据 stats.failed / stats.success 决定 alerting
```

**关键设计：**
- `stats.failed` 累加而非 throw — caller 据 stats 决策是否 alert，不是单元素 fail 即全停
- audit_log 落 forensic 明细 — 后置追溯单条失败原因（v0.9.24 #14 prod alerting 抓 stats.failed > 0 配套）
- audit 嵌 try/catch — audit 自身失败不能 recurse 阻塞主 batch
- 错误 message slice(0, 500) — 防超长 stack trace 撑爆 payload column

**适用边界：**
- ✅ DB write loop（`prisma.upsert` / `prisma.create` 批量）
- ✅ 外部 API call loop（aigcgateway / Resend / 第三方平台 fetch 批量）
- ✅ 文件 IO 批量（CSV 行解析 + 落 DB / 图片处理 batch）
- ❌ 业务 critical 单 transaction（payment / 唯一性 reservation 等 — fail-fast 更安全）
- ❌ ACID 跨表多 step 操作（事务原子性优先于个体隔离）

**配套 alerting（详 `deploy-patterns.md` §"prod 关键流程 log-based alerting"）：** stats.failed > 0 时 caller log `level=WARN/ERROR + stats`，触发 Slack webhook + GCP Cloud Monitoring，避免 BL-076 同款 14 天沉默 outage。

来源：BL-076-F003 实战（import.ts 加 per-KOL try/catch + stats.failed + audit forensic）+ v0.9.24 #15 用户 2026-05-27 ack。

---

## 11. adapter output 边界 check 三件套 — clamp + outlier flag + 业务阈值 < DB 上限（v0.9.24 #17 / BL-076 #17）

**坑：** adapter (external API → DB) 数据流默认信任 upstream 数值 → 超出 DB column type 范围即 `numeric field overflow` throw。BL-076-F002 实战：apify-kol adapter 计算 `engagementRate = totalLikes / postsCount / followers * 100`，少量 KOL 因 followers 异常小或 totalLikes 异常大 → rawRate > 99999.99 → `Decimal(7,2)` overflow → 整 batch fail（配合 §10 缺失同时暴露）。

**三件套模板：**

```typescript
// 三件套：clamp + outlier flag + 业务阈值 < DB 上限
const BUSINESS_THRESHOLD = 100;     // 业务阈值（百分比合理上限）
const DB_MAX = 99999.99;            // DB Decimal(7,2) 上限
// 业务阈值 < DB 上限 — 异常先标 flag 不丢数据，DB 边界仅最后兜底

const rawValue = computeFromExternalAPI(input); // 可能 null / NaN / 超大
const clampedValue = rawValue == null
  ? null
  : Math.min(Math.max(rawValue, 0), DB_MAX);

const isOutlier = rawValue != null && rawValue > BUSINESS_THRESHOLD;

return {
  field: clampedValue,
  metadata: {
    flags: {
      ...existingFlags,
      field_outlier: isOutlier,        // 业务异常 flag — 后置 dashboard / audit 关注
      field_raw_overflow: rawValue != null && rawValue > DB_MAX, // DB 兜底触发 flag
    },
  },
};
```

**三层关系：**

| 层 | 触发条件 | 用途 |
|---|---|---|
| **业务阈值 BUSINESS_THRESHOLD** | rawValue > 业务合理范围（如 100% engagement rate） | 标 `outlier=true` flag，下游 dashboard 过滤 / 人工 audit |
| **DB 上限 DB_MAX**（必须 >> 业务阈值） | rawValue > DB column type 上限 | clamp 到 DB_MAX 防 overflow throw + 标 `raw_overflow` flag |
| **null 兜底** | rawValue == null / NaN | 写 null（DB column 允许 null）+ 上游 stats 计 `metadata_missing` |

**关键设计：**
- **业务阈值 < DB 上限是设计原则** — 异常值先标 flag 不丢数据，DB 边界仅最后兜底（不是业务阈值即 reject）
- **outlier flag 落 metadata.flags 而非独立 column** — JSON 字段灵活扩展，避免 schema migration 抖动
- **不 throw / 不 skip 异常 row** — 上游 batch loop（§10）依赖每条都返回 stats.success，flag 后置审查

**适用边界：**
- ✅ Decimal(M,N) / SmallInt / VARCHAR(N) 有尺寸约束的 DB 列上游 adapter
- ✅ LLM 返回数值字段（如 `score / weight`）— 模型可能输出超范围或非数字
- ✅ 用户 input 数值字段（age / count 等）— 业务阈值过滤 + DB 兜底
- ⚠️ Int / Float / Text 无尺寸约束 type 不需 clamp，但仍建议加 `outlier` flag（业务阈值过滤）

**配套 schema 设计（详 §9 Schema migration ROLLBACK 不对称风险）：** DB 列尺寸定义时留余量（如 BL-076 把 `engagement_rate` 从 NUMERIC(5,2) 扩到 NUMERIC(7,2)），余量比业务阈值至少大 100x，避免频繁 ALTER。

来源：BL-076-F002 实战（apify-kol adapter Math.min(rawRate, 99999.99) + outlier=rawRate>100 + metadata.flags 落地）+ v0.9.24 #17 用户 2026-05-27 ack。

---

## 12. `prisma migrate dev` wrap script — 自动注入 ROLLBACK skeleton（v0.9.24 沉淀 / BL-070 #22）

`prisma migrate dev` 创 migration 不自动加 ROLLBACK 注释，`scripts/validate-rollback-sql.sh` 是后置 CI 检查，触发 CI 红才发现。**建议 wrap script 自动注入 ROLLBACK skeleton 从生产源头避免 CI 红：**

```bash
#!/usr/bin/env bash
# scripts/prisma-migrate-dev-wrap.sh
npx prisma migrate dev "$@"

# 找最新 migration 文件，未含 ROLLBACK 注释则注入 skeleton
LATEST=$(ls -t prisma/migrations/*/migration.sql | head -1)
if ! grep -q "^-- ROLLBACK:" "$LATEST"; then
  cat >> "$LATEST" <<EOF

-- ROLLBACK: <inverse SQL here>
-- TODO(BL-XXX): fill in inverse SQL before merge
EOF
  echo "✓ Injected ROLLBACK skeleton in $LATEST — please fill before commit"
fi
```

**配置 package.json：**
```json
{
  "scripts": {
    "db:migrate": "bash scripts/prisma-migrate-dev-wrap.sh"
  }
}
```

**注意：** 此 wrap 仅注入 skeleton 提示，**不检测尺寸约束扩缩类 ROLLBACK 的数据维度风险** —— 扩范围 migration（NUMERIC/VARCHAR 增大）的 ROLLBACK 仍须按 §9 手动加 `UPDATE clamp` 前置 step。

来源：BL-070 fix-round 1 #22 — `scripts/validate-rollback-sql.sh` CI 检查触发后回头补 ROLLBACK 注释（fix-round 浪费）；上游 wrap 自动注入避免。

---

## 版本历史

| 日期 | 修订 | 来源 |
|---|---|---|
| 2026-04-20 | 初版沉淀（§1 RLS NULLIF） | KOLMatrix BI1-F008 |
| 2026-04-20 | §2 DB 命名 / 角色 / Grant 与 migration 一致性 | KOLMatrix BI2 DB 命名坑 |
| 2026-05-01 | §3 Prisma 7+ JSON 列写入需 InputJsonValue cast | KOLMatrix B5-F004/F006 同坑 |
| 2026-05-04 | §4 RLS 旁路矩阵 + cross-tenant ops 决策树 | KOLMatrix BL-030-F003 backfill scanProducts 0 行（BL-031-F003 hotfix） |
| 2026-05-04 | §5 跨表 id 类型一致性 / §6 Silent updateMany / §7 staging 端到端跑 .ts 脚本 | KOLMatrix BL-031 cuid cast hotfix + BL-032 S3 |
| 2026-05-05 | §8 Migration 引入新表必查 RLS policy 默认 enabled | KOLMatrix backend-full-scan-2026-05-04 audit DB-CRIT-1 |
| 2026-05-05 | §8.1 同 migration 启用多表 RLS 时 cross-cutting helper 必须同 commit 配套改 withTenant（v0.9.12）| BL-034 F003 logAudit + logEvent 33+ 调用方 silent-fail 风险 |
| 2026-05-26 | §4.6 跨 tenant 平台级聚合（withPlatformAdmin vs 循环 tenant set_config）| KOLMatrix BL-075-F006 /api/health kol_coverage 0 行 prod regression（v0.9.24 #13） |
| 2026-05-27 | §9 Schema migration ROLLBACK 不对称风险 / §10 batch per-element try/catch + stats + audit forensic / §11 adapter 边界三件套（clamp+outlier+阈值<DB上限）| KOLMatrix BL-076-F001/F002/F003（engagement_rate NUMERIC(5,2)→(7,2) + 2567 KOL 14 天沉默 outage）v0.9.24 #15/#16/#17 |
| 2026-05-27 | §12 `prisma migrate dev` wrap 自动注入 ROLLBACK skeleton | KOLMatrix BL-070 #22 |
