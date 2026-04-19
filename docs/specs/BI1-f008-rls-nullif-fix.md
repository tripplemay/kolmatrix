# BI1 F008 · RLS 策略缺陷仲裁请求（production bug）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-19
> **触发：** Reviewer fixing round 1 判 F008 FAIL（flaky marketer E2E），日志显示 `invalid input syntax for type uuid: ""` 出现在 `withPlatformAdmin` 调用链
> **状态：** 等待 Planner 裁决修复方案，**未收到前 Generator 不动产品代码 / migration**（harness 铁律 §9：生产故障必须 Planner → 用户 → Generator 流程）

---

## 1. TL;DR

`prisma/migrations/20260418000000_init/migration.sql` 里 6 条 RLS 策略对 `current_setting('app.tenant_id', true)` 直接 `::uuid` 强转，在 Postgres session 已触达过该 GUC 后会稳定抛错，破坏 `withPlatformAdmin` 的超级管理员绕过设计。Auth 回调出现 `CallbackRouteError` 就是此 bug。

请 Planner 批准 `NULLIF(..., '')::uuid` 兜底的新 migration，Generator 执行。

---

## 2. 触发链（5 步证据）

### 2.1 RLS 策略原文（20260418000000_init/migration.sql L317-336）

```sql
CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid         -- ①
    OR current_setting('app.is_platform_admin', true)::bool = true
  );

CREATE POLICY tenant_isolation ON "kol" USING (...::uuid);            -- 同样 ① 模式
-- campaign / kol_campaign / email_template / email_log 共 6 条同模式
```

① `current_setting(setting, true)` 第二参数 `true` 表示"missing 时不报错"。但它返回值分三态：
- **从未 SET** → `NULL`
- **曾 SET 过后恢复** → 空字符串 `''`
- **当前 tx 内已 SET** → 具体值

对前两种的处理：
- `NULL::uuid` → `NULL`（安全）
- `''::uuid` → **THROWS** `invalid input syntax for type uuid: ""`

### 2.2 Postgres OR 不短路异常

```
tenant_id = ''::uuid  OR  is_platform_admin = true
           │
           └── cast 在表达式评估前执行 → raise ERROR
```

即使右侧 `is_platform_admin = true`，左侧的类型转换异常在执行期已抛，整个 USING 谓词直接失败 → `withPlatformAdmin` 的"绕过 user_isolation"设计**失效**。

### 2.3 自定义 GUC 的 session 持久语义（Postgres 16 实测）

```sql
-- 全新 session
SELECT current_setting('app.tenant_id', true);  -- NULL

-- 在事务中 SET LOCAL
BEGIN;
SET LOCAL app.tenant_id = 'deadbeef-...';
COMMIT;

-- SET LOCAL 的事务已结束
SELECT current_setting('app.tenant_id', true);  -- ''  ← 不是 NULL，是 EMPTY STRING
```

一旦会话对某个自定义 GUC key "触达"过（SET / SET LOCAL 都算），该 key 在 session 剩余生命周期内被记录为 `''`，**而非**恢复到 missing 状态。

### 2.4 Prisma 连接池复用

`@prisma/adapter-pg` 底层用 `pg` Pool。同一 Next dev server 进程：
- 多个请求共享连接池
- `withTenant` / `withPlatformAdmin` 都通过 `prisma.$transaction(...)` 获取连接
- 事务提交后连接归还池，下次请求可复用同一物理连接

### 2.5 合成触发（F008 flaky 根因）

```
Playwright test 1 on dev server:
  /login 提交 → signIn → authorize → withPlatformAdmin(connA)
    └─ SET LOCAL is_platform_admin='true' → user.findUnique
       └─ RLS user_isolation 评估:
          tenant_id = current_setting('app.tenant_id',true)::uuid
          = tenant_id = NULL::uuid = NULL (过滤)  ✓ OR 到右侧 → is_platform_admin='true' → PASS

  重定向 /dashboard → page.tsx → withTenant(tenantId, connA 或 connB)
    └─ SET LOCAL app.tenant_id='tenant-xxx' → fetchDashboardData → COMMIT
    └─ 此刻 connA 的 app.tenant_id 已被"触达", session 值恢复为 ''

Playwright test 2 (cookie cleared, 但同一 dev server 进程 / connA 仍在池中):
  /login 提交 → signIn → authorize → withPlatformAdmin(connA)
    └─ SET LOCAL is_platform_admin='true' → user.findUnique
       └─ RLS user_isolation 评估:
          tenant_id = ''::uuid → THROW "invalid input syntax for type uuid: \"\""
       └─ CallbackRouteError → NextAuth 401 → E2E waitForURL 超时
```

**复用 connB 时不抛** —— 这是 flaky 的来源（Prisma pool 多连接时随机命中）。

### 2.6 F007 测试已经暴露该 bug

`tests/integration/rls-isolation.test.ts` 最后一条（unscoped queries 默认拒）当时我写成了:

```ts
try {
  const rows = await app.user.findMany();
  expect(rows).toHaveLength(0);
} catch (err) {
  expect(String(err)).toMatch(/uuid|permission|tenant/i);  // 接受 throw
}
```

当时我判断"两种都是合法 default-deny"——现在回看，**这是对 RLS 策略真缺陷的伪装**。正确行为应该是稳定"0 rows"，而非 session 状态决定 throw or pass。

---

## 3. 建议修复方案

### 3.1 所有 6 条策略改用 `NULLIF(..., '')::uuid` 兜底

新 migration `prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql`:

```sql
-- Fix empty-string GUC cast race in user_isolation + 5 tenant_isolation
-- policies. NULLIF('', '') → NULL so `tenant_id = NULL::uuid` is NULL
-- (filtered, default-deny), instead of raising "invalid input syntax".

DROP POLICY IF EXISTS user_isolation ON "user";
CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_platform_admin', true)::bool = true
  );

DROP POLICY IF EXISTS tenant_isolation ON "kol";
CREATE POLICY tenant_isolation ON "kol"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ... 同样处理 campaign / kol_campaign / email_template / email_log

-- ROLLBACK 段略
```

### 3.2 校正后行为

| session 状态 | `current_setting(...)` 返回 | `NULLIF(..., '')::uuid` | `tenant_id = <uuid>` | RLS 判定 |
|---|---|---|---|---|
| 从未 SET | NULL | NULL | `tenant_id = NULL` = NULL | 过滤（拒） |
| SET 后恢复 | `''` | NULL | `tenant_id = NULL` = NULL | 过滤（拒） |
| 当前 tx 内 SET | 具体 uuid | uuid | `tenant_id = uuid` | 匹配或过滤 |
| is_platform_admin=true | 任一 | 任一 | 左侧可能 NULL | OR 右侧成立 → 通过 |

**默认拒稳定，tenant 匹配稳定，admin 绕过稳定。** 没有 throw 路径。

### 3.3 影响面

- **生产数据：** 零影响（policy 语义只拒得更稳，不放更宽）
- **dev/test DB：** migrate 幂等，重跑 `prisma migrate deploy` 即可
- **RLS 测试：** `tests/integration/rls-isolation.test.ts` 最后一条可以改回"稳定断言 0 rows"，去掉 try/catch 补丁
- **F008 E2E：** CallbackRouteError 根因消除，flaky 不再出现
- **其他 6 条 RLS 测试：** 原测试断言仍通过（匹配路径不变）

### 3.4 备选方案对比（不推荐）

| 方案 | 评价 |
|---|---|
| B. 改 `withTenant` / `withPlatformAdmin` 在每次 tx 开头 `RESET app.tenant_id` | 只能遮蔽症状，不解决 policy 脆弱；且 RESET 不会把 GUC 从 "touched" 状态抹除 |
| C. 改 `withPlatformAdmin` 加 `SET LOCAL app.tenant_id = '00000000-...-0000'` 哨兵值 | hack，埋魔数，后续业务代码读 GUC 遇 all-zero uuid 得特判 |
| D. DB 层全局 `ALTER DATABASE SET app.tenant_id = 'NULL'` 或类似 | 依赖超级用户权限，prod 不便；仍可能与 SET LOCAL 交互出新坑 |

方案 A（NULLIF）是最小面积、最直接语义的修复。

---

## 4. Generator 提交物（批准后执行）

1. **新 migration**：`prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql` —— 6 条策略 DROP + CREATE
2. **F007 测试清理**：`tests/integration/rls-isolation.test.ts` 最后一条改回稳定 `expect(rows).toHaveLength(0)`（去掉 try/catch 补丁）
3. **重跑 E2E F008** 验证 marketer-dashboard.spec.ts 稳定（连续 5 次 workers=1 全绿）
4. **提交 commit**：`fix(BI1-F008): RLS policy nullif empty-string tenant_id GUC`

---

## 5. 请 Planner 回复格式

短格式：`#方案:A` 或 `#方案:B/C/D <原因>` 或 `#方案:其他 <描述>`

如选 A（推荐），请同步确认：
1. Migration 命名约定（建议 `20260420000000_rls_nullif_empty_tenant`）
2. 是否需要同步更新 `docs/specs/B0-database-schema.md` 的 RLS 策略示例（当前示例若引用旧写法需同步）
3. 是否要求先经用户书面确认再执行（铁律 §9 生产修复需用户确认）

---

## 6. 相关文档

- `prisma/migrations/20260418000000_init/migration.sql` L317-336 — 有缺陷的 6 条 RLS 策略
- `src/auth.ts` L37 — `withPlatformAdmin` 调用点（受影响）
- `src/lib/db.ts` L72-79 — `withPlatformAdmin` 实现
- `tests/integration/rls-isolation.test.ts` 最后一条 — 伪装该 bug 的 try/catch
- `docs/test-reports/BI1-test-infrastructure-verifying-2026-04-19.md` P0-2 — Reviewer 首次记录该错误
- `docs/test-reports/BI1-test-infrastructure-verifying-no-proxy-rerun-2026-04-19.md` §2 — Reviewer 无代理重判仍 FAIL

---

## 7. Planner 裁决（2026-04-19）

**仲裁：** `#方案:A`（NULLIF 兜底，所有 6 条 RLS 策略）

**用户书面确认（铁律 §9）：** ✅ 已获 —— 用户消息 "F008 方案 A"（2026-04-19）

### 7.1 采纳理由
- 根因分析清晰：`current_setting(..., true)` 三态 + 空串 cast → 生产期语义不稳
- 方案 A 是最小面积、语义正确的修复（默认拒稳定 / tenant 匹配稳定 / admin 绕过稳定）
- 备选 B/C/D 都是遮蔽症状或引入魔数，技术债更大
- Generator 已提供完整触发链证据（§2.1-2.6）与影响面评估（§3.3），裁决信息充分

### 7.2 确认事项（对齐 Generator §5 问询）

1. **Migration 命名：** 采纳 `prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql`
2. **B0-database-schema.md 同步：** Planner 在本批次裁决 commit 中已同步更新 3 处 RLS 示例（§3.2 + §5 两处），Generator 无需重复改
3. **执行许可：** 已获用户书面确认，Generator 可立即执行

### 7.3 Generator 执行清单（按 §4 照抄）

1. 新 migration `20260420000000_rls_nullif_empty_tenant/migration.sql` —— 6 条策略 DROP + CREATE，每条 USING 改用 `NULLIF(current_setting('app.tenant_id', true), '')::uuid`
2. Rollback 段（down.sql 或 SQL 注释）保留可回滚路径
3. `tests/integration/rls-isolation.test.ts` 最后一条去掉 try/catch 补丁，改回 `expect(rows).toHaveLength(0)` 稳定断言
4. `npm run test:integration` 全绿
5. Playwright 重跑 `tests/e2e/marketer-dashboard.spec.ts`，连续 5 次 `workers=1` 全绿（证明 flaky 消除）
6. Commit：`fix(BI1-F008): RLS policy nullif empty-string tenant_id GUC`

### 7.4 状态流转
- 当前 status: `fixing`（BI1 sprint）
- F008 修复推送后 Generator 继续处理其余 fixing 项（F002/F007 + F010 待单独裁决）
- 全部修复完成后 status → `reverifying`，Reviewer 复验

### 7.5 复盘（framework proposal 队列）
`framework/proposed-learnings.md` 建议追加：RLS 策略写作 template 内置 `NULLIF(..., '')` 兜底，避免未来再踩此坑。done 阶段统一处理。
