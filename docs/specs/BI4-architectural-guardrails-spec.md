# BI4 — 架构护栏 批次规格

> 类型：Infrastructure Sprint（基建批次，MVP 前最后一棒）
> 状态：✅ 定稿 2026-04-23，Generator 可开工
> Planner: Kimi · Generator: johnsong · Evaluator: Reviewer

---

## 1. 背景与目标

MVP 纵向路线（BM1 控制台+KOL / BM2 Campaign+联系+CRM+ROI+周报）涉及 ~20 features，跨多个领域。如果不前置做几个"架构护栏"，BM1/BM2 spec 会臃肿、Generator 一批次多主题、未来扩展会有返工。

本批次独立做 **5 项纯基建 guard rails**，每项 ≤ 200 行代码 + 基础测试，总 2-3 天 Generator 工作量，换后续 MVP 零返工。

### 必要性依据（来自 session 讨论）

| Guard rail | 不做的返工成本 | 做了的 MVP 零成本 |
|---|---|---|
| Async Job Queue interface | B5 接 BullMQ 时要改所有调用点 ~2 天 | BM2 发邮件直接 `jobQueue.add(...)`，MVP 同步执行；B5 只换 executor |
| event_log 表 | B7 开放 API 需要历史事件，早期数据永远丢失 | 5 个关键动作埋点，0.5 天 |
| audit_log 表 | 企业合规批次无法回溯早期操作 | 3-5 敏感操作埋点，0.5 天 |
| Cursor pagination util | 数据 > 10 万条时 offset pagination 崩，必须改 + 前端联动 ~1 天 | 一个 util，KOL 列表直接用 |
| KOL tsvector index | B1 全文搜索需 migration + 重建索引（有 lock 风险）| 一次 migration 创建，MVP 筛选 `name ILIKE` 先跑，B1 搜索切到 tsvector |

---

## 2. 范围

### In Scope

1. **F001 — Async Job Queue interface + in-memory executor stub**
2. **F002 — `event_log` 表 + `logEvent()` helper**
3. **F003 — `audit_log` 表 + `logAudit()` helper**
4. **F004 — Cursor pagination util `createCursorPaginator<T>()`**
5. **F005 — KOL tsvector search index migration**

### Out of Scope
- ❌ 实际业务埋点（event/audit 用 helper，埋点在 BM1/BM2 各 feature 自己加）
- ❌ BullMQ 真实接入 + Redis 队列（留 B5 批次）
- ❌ 全文搜索查询 UI 联动（留 BM1 F003 / B1 完整搜索）
- ❌ event_log 的 webhook 投递 / audit_log 的 UI 查询页（B7/B9）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| Job Queue interface 形态 | `JobQueue` interface + `InMemoryJobQueue` 实现 + `jobQueue.add(name, payload)` API | B5 只换 executor（`BullMQJobQueue implements JobQueue`），调用点零改动 |
| event_log / audit_log 存储 | 各自一张独立表 + Prisma model，无 RLS（平台级记录）| 不跨 tenant 读，admin/合规用途；RLS 反而增加管理复杂度 |
| event vs audit 边界 | **event_log** = 业务事件（create/update/delete/send）/ **audit_log** = 敏感操作（user role change / data export / config edit） | 分离 concerns，未来 webhook 投递 event 不含 audit 数据 |
| Cursor pagination 形式 | 封装 Prisma cursor + pageSize + 可选 orderBy | typesafe、Prisma 原生支持、未来 tRPC 可直接复用 |
| tsvector 维护方式 | DB trigger（不靠 app 层）| 数据修改时自动更新，无一致性风险；Prisma raw SQL migration 一次搞定 |
| tsvector 字段范围 | KOL 表的 `name` + `handle` + `tags` + `knownBrandCollabs` | MVP 搜索主要查这 4 个；未来加字段再重建索引 |
| 写日志失败怎么办 | helper 用 fire-and-forget（try/catch swallow + console.error），不阻塞主流程 | 日志是辅助功能，不该成为主功能故障点；B8 合规时再评估是否需严格 |

## 4. 功能列表（5 项，全 executor:generator）

### F001 — Async Job Queue interface + in-memory executor stub

**实现：**

`src/lib/jobs/queue.ts`（新文件）:

```typescript
// Job Queue 抽象接口。MVP 用 in-memory 同步 executor，
// B5 批次接 BullMQ 时只换 executor，调用点不改。

export interface JobPayload {
  [key: string]: unknown;
}

export interface JobOptions {
  /** 延迟毫秒 */
  delay?: number;
  /** 幂等 ID（防重复入队）*/
  idempotencyKey?: string;
  /** Tenant scope，便于追踪 */
  tenantId?: string;
}

export interface JobHandler<P = JobPayload> {
  (payload: P, context: { jobId: string; tenantId?: string }): Promise<void>;
}

export interface JobQueue {
  register<P = JobPayload>(name: string, handler: JobHandler<P>): void;
  add<P = JobPayload>(name: string, payload: P, options?: JobOptions): Promise<{ jobId: string }>;
  stats(): { pending: number; completed: number; failed: number };
}

/**
 * In-memory stub executor. MVP 阶段发邮件等任务同步执行；
 * B5 替换为 BullMQJobQueue 即可不改调用点。
 */
export class InMemoryJobQueue implements JobQueue { ... }

/** 全局单例，app 启动时注册所有 handlers */
export const jobQueue: JobQueue = new InMemoryJobQueue();
```

`src/lib/jobs/handlers/register.ts`（新文件，handler 注册中心）:
```typescript
// BM1/BM2 各 feature 在这里注册自己的 handler
// jobQueue.register('send-email', async (payload, ctx) => { ... });
// MVP 期间为空，留给后续批次填充。
```

在 `instrumentation.ts` 里 import `@/lib/jobs/handlers/register` 以确保 handler 注册生效。

**Acceptance：**
- `tests/unit/jobs/queue.test.ts` 覆盖：register → add → handler 执行 / duplicate idempotencyKey 抛或去重 / stats 准确 / handler throws 不崩主流程
- `jobQueue.add('test', {foo:1})` 在没 register 时给 warn log 不崩
- TypeScript 类型推导 OK（`jobQueue.add<SendEmailPayload>('send-email', {...})` 推 out payload type）

### F002 — `event_log` 表 + `logEvent()` helper

**实现：**

Prisma schema 追加:
```prisma
model EventLog {
  id         String   @id @default(cuid())
  tenantId   String?  // null 表示平台级事件
  actorId    String?  // 触发事件的 user id，null 表示系统
  type       String   @db.VarChar(64)  // e.g. "kol.created", "campaign.email_sent"
  resourceId String?  @db.VarChar(64)  // 相关资源 id
  payload    Json     // 事件具体数据
  createdAt  DateTime @default(now())

  @@index([tenantId, type, createdAt])
  @@index([resourceId])
  @@map("event_log")
}
```

Migration `20260424000000_event_log/migration.sql` 含完整 `-- ROLLBACK: DROP TABLE "event_log";`。

Helper `src/lib/events/log.ts`:
```typescript
export interface EventData {
  type: string;              // "kol.created"
  tenantId?: string;
  actorId?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Fire-and-forget event logging.
 * 失败仅 console.error，不阻塞主流程。
 * BM1/BM2 在各 feature 调用点（如 kol.create() 成功后）加一行。
 */
export async function logEvent(data: EventData): Promise<void> { ... }
```

**Acceptance：**
- Migration 通过 F007 CI ROLLBACK 校验
- `tests/integration/event-log.test.ts`: logEvent → DB 记录 / 失败 swallow（DB down 时主流程不抛）/ 查询 by tenant+type+时间范围
- Prisma Client 生成后 TypeScript `prisma.eventLog.findMany(...)` 可用

### F003 — `audit_log` 表 + `logAudit()` helper

**实现：**

Prisma schema:
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String?
  actorId    String   // audit 强制要有 actor
  action     String   @db.VarChar(64)  // e.g. "user.role_changed", "data.exported"
  targetType String   @db.VarChar(32)  // "user" / "kol" / "campaign"
  targetId   String   @db.VarChar(64)
  before     Json?    // 修改前状态
  after      Json?    // 修改后状态
  ipAddress  String?  @db.VarChar(45)
  userAgent  String?  @db.Text
  createdAt  DateTime @default(now())

  @@index([tenantId, actorId, createdAt])
  @@index([targetType, targetId])
  @@map("audit_log")
}
```

Migration `20260424000100_audit_log/migration.sql` + ROLLBACK SQL。

Helper `src/lib/audit/log.ts`:
```typescript
export interface AuditData {
  actorId: string;              // audit 强制要 actorId，不能 null
  action: string;               // "user.role_changed"
  targetType: string;
  targetId: string;
  tenantId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** 同步落库（audit 比 event 更严格，失败也应 log stderr）*/
export async function logAudit(data: AuditData): Promise<void> { ... }
```

**Acceptance：**
- Migration 通过 F007 CI
- `tests/integration/audit-log.test.ts`: logAudit 成功 → DB 记录 / actorId 缺失 TypeScript 编译报错 / before-after diff 保留
- 查询 by actor + 时间范围 / 查询 by target

### F004 — Cursor pagination util

**实现：**

`src/lib/pagination/cursor.ts`:

```typescript
export interface CursorPaginationParams {
  cursor?: string;        // base64 encoded { id, sortField, sortValue }
  limit?: number;         // default 20, max 100
  orderBy?: string;       // default "createdAt"
  direction?: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;     // null = no more
  hasMore: boolean;
  total?: number;                 // 可选 count(*)
}

/**
 * Factory for typesafe Prisma cursor pagination.
 *
 * Usage:
 *   const paginator = createCursorPaginator({
 *     model: prisma.kol,
 *     defaultOrderBy: 'createdAt',
 *   });
 *   const page = await paginator.query({ where: {...}, cursor: req.query.cursor });
 */
export function createCursorPaginator<TModel, TWhere>(
  config: {
    model: { findMany: (args: any) => Promise<any[]>; count?: (args: any) => Promise<number> };
    defaultOrderBy?: string;
    defaultLimit?: number;
    maxLimit?: number;
  }
): {
  query(args: { where?: TWhere } & CursorPaginationParams): Promise<CursorPaginationResult<TModel>>;
};
```

**Acceptance：**
- `tests/unit/pagination/cursor.test.ts`: 分页前 3 条 / cursor 解出并继续 / hasMore false at end / limit cap 到 maxLimit / orderBy asc+desc / where filter 叠加 OK
- Cursor 是 URL-safe base64，前端可透明传递
- TypeScript 使用时泛型推导：`paginator.query<KolWhereInput>({ where: {...} })` items 类型为 Kol[]

### F005 — KOL tsvector search index migration

**实现：**

Migration `20260424000200_kol_tsvector/migration.sql`:

```sql
-- Add tsvector column for full-text search
ALTER TABLE "kol" ADD COLUMN "search_vector" tsvector;

-- Populate existing rows
UPDATE "kol" SET "search_vector" = 
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(handle, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string("knownBrandCollabs", ' '), '')), 'C');

-- GIN index for query speed
CREATE INDEX "kol_search_vector_idx" ON "kol" USING GIN("search_vector");

-- Trigger to auto-maintain on insert/update
CREATE OR REPLACE FUNCTION kol_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := 
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.handle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."knownBrandCollabs", ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kol_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "kol"
  FOR EACH ROW
  EXECUTE FUNCTION kol_search_vector_update();

-- ROLLBACK: DROP TRIGGER kol_search_vector_trigger ON "kol";
--           DROP FUNCTION kol_search_vector_update();
--           DROP INDEX kol_search_vector_idx;
--           ALTER TABLE "kol" DROP COLUMN search_vector;
```

Prisma schema 追加 `searchVector Unsupported("tsvector")?` 字段（读不回写，仅让 Prisma client 知道此列存在，避免 db pull 时丢失）。

提供 helper `src/lib/search/tsvector.ts`:
```typescript
/** Build a plainto_tsquery parameter for PostgreSQL */
export function buildKolSearchQuery(userInput: string): string { ... }

/** Use with prisma.$queryRaw for full-text search in B1+ */
export async function searchKols(tenantId: string, query: string, limit?: number): Promise<Kol[]> { ... }
```

注：**MVP BM1 F004 KOL Discovery 筛选**可以继续用 Prisma `name ILIKE` 跑起来，`searchKols()` helper 留给 B1 完整版接入。本 feature 只做基础设施。

**Acceptance：**
- Migration 通过 F007 ROLLBACK SQL 校验 + 在 Testcontainers 上成功 migrate + rollback 可回
- `tests/integration/kol-tsvector.test.ts`: insert KOL → search_vector 自动填充 / update KOL name → search_vector 自动更新 / `searchKols(tenantId, "dota")` 返回命中 KOL / 空 query 返回 [] 不报错
- EXPLAIN ANALYZE 验证 GIN 索引被使用（不走顺序扫描）

## 5. 依赖关系

```
F001 Job Queue          独立
F002 event_log          独立
F003 audit_log          独立
F004 Cursor pagination  独立
F005 tsvector           依赖 F007 ROLLBACK SQL 校验（已建立）
```

**执行顺序：** 全部 可并行（F001/F002/F003/F004 独立；F005 只依赖 F007 机制）。Generator 可线性按 F001→F005 做。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| tsvector trigger 在 Testcontainers 的 Postgres 版本兼容 | Testcontainers 已用 `postgres:16-alpine`，GIN + tsvector 从 PG 11 就稳定，无兼容性问题 |
| 写日志失败阻塞主流程 | event/audit helper 都用 try/catch swallow + console.error |
| InMemoryJobQueue 测试不覆盖真 BullMQ 行为 | 接口设计阶段做好抽象：handler 注册 + payload 序列化要求 JSON-safe，确保切换时零坑 |
| Cursor 暴露 DB 细节到前端 URL | Cursor 用 base64 包装，前端只复制粘贴不解析 |
| audit_log before/after 存敏感数据 | 本批次不定义具体埋点（BM2 用户管理场景埋点时评估；可加字段级 mask 机制如 `sanitizeBefore(userFields, ['password'])`）|

## 7. 验收方式（Evaluator 阶段）

Reviewer 执行：

### L1 自动化
- `npm run test:unit` + `test:integration` 全绿
- `npm run test:coverage` 覆盖率维持 ≥ 80%
- `npm run lint` + `npx tsc --noEmit` 无错
- `bash scripts/validate-rollback-sql.sh` 通过（含新 2 条 migration）
- CI 8 jobs 全绿

### L2 功能验证
- `tests/unit/jobs/queue.test.ts` ≥ 5 用例全绿（注册/入队/执行/幂等/stats）
- `tests/integration/event-log.test.ts` ≥ 3 用例全绿
- `tests/integration/audit-log.test.ts` ≥ 3 用例全绿
- `tests/unit/pagination/cursor.test.ts` ≥ 4 用例全绿
- `tests/integration/kol-tsvector.test.ts` ≥ 3 用例全绿（含 EXPLAIN 验证 GIN 索引）

### L3 生产就绪
- staging `https://staging.kol.guangai.ai` 跑 migration 成功
- pm2 reload 无掉包（F002 B1 保证）
- 两张新表 `event_log` / `audit_log` 在 staging DB 可查

## 8. 引用文档

- `framework/harness/database-patterns.md`（DB 命名 migration-consistency）
- `framework/harness/deploy-patterns.md`（PM2 zero-downtime 3 条件）
- `docs/specs/B0-database-schema.md`（Kol 表结构）
- `docs/specs/BI1-test-infrastructure-spec.md`（Testcontainers / F007 ROLLBACK）
- `docs/product/KOLMatrix-MVP-PRD.md`（MVP scope）

## 9. 启动检查清单（Generator 开工前）

- [x] BAux1 status=done（已签收 2026-04-23）✅
- [x] role_assignments 在 progress.json 设置（Planner: Kimi / Generator: johnsong / Evaluator: Reviewer）
- [x] 本 spec 用户确认范围 ✅ 2026-04-23
- [x] Testcontainers + ROLLBACK SQL 校验 CI 流程已就位（BI1 F007）

## 10. 完成后效果

本批次完成后，**BM1 + BM2 业务批次可以干净调用以下基建**：

```typescript
// BM2 发邮件 feature
await jobQueue.add('send-kol-email', { campaignKolId, templateId }, { tenantId });

// BM1 KOL 列表分页
const paginator = createCursorPaginator({ model: prisma.kol, defaultOrderBy: 'followerCount' });
return paginator.query({ where: { tenantId, gameCategories: { some: { ... } } }, limit: 20 });

// BM1 KOL 创建后记录事件
await logEvent({ type: 'kol.added', tenantId, actorId, resourceId: kol.id, payload: { source: 'manual' } });

// BM2 用户改角色时记录审计
await logAudit({ actorId, action: 'user.role_changed', targetType: 'user', targetId, before: {role:'marketer'}, after: {role:'admin'} });

// BM1 F004 / B1 未来全文搜索
const results = await searchKols(tenantId, 'dota streaming brasil');
```

**所有业务批次零架构改动（只加调用）**，符合 MVP PRD §11 "前置完整 schema + 架构基础设施"原则。
