# ADR-007: Multi-Tenant RLS Strategy

## Status

**Accepted**

- 日期：2026-04-18
- 作者：Kimi（架构设计）+ johnsong（F004 实现）
- 相关批次：B0-foundation F003/F004 / 所有涉及多租户数据的业务批次

## Context

KOLMatrix 是 SaaS 平台，PRD §8 用户角色定义明确 3 类用户：
- 平台管理员（可访问全部租户）
- 业务执行者（仅访问自己租户数据）
- 客户（单一 candidate_list，凭 share_token）

PRD §6 "多账号管理隔离" 技术难点：
> 多个客户共用平台时数据隔离要求高
> 解决方案：租户级别数据隔离（行级安全策略）；客户只能看到自己的 KOL 清单；操作日志全量记录

关键问题：**多租户数据隔离的实现策略**。

## Decision

**采用 "共享 DB + 行级 RLS + 应用层 set local"：**

### 1. Schema 层

- 所有多租户表带 `tenant_id uuid not null` 列：`user / kol / campaign / kol_campaign / email_template / email_log`
- 全局表（无 tenant_id）：`tenant / audit_log / NextAuth 辅助表`

### 2. PostgreSQL 层

- 每张多租户表启用 RLS：
  ```sql
  ALTER TABLE kol ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON kol
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  ```
- 特殊 user 表：platform_admin 全可见
  ```sql
  CREATE POLICY user_isolation ON user
    USING (
      tenant_id = current_setting('app.tenant_id', true)::uuid
      OR current_setting('app.is_platform_admin', true)::bool = true
    );
  ```
- 应用专用角色 `kolmatrix_app` **非 superuser**，不能 BYPASSRLS
- Migration / seed 用 `kolmatrix_admin` 角色（BYPASSRLS）

### 3. 应用层

- `src/lib/db.ts` 提供 `withTenant(tenantId, fn)` 包装器：
  ```typescript
  export async function withTenant<T>(tenantId: string, fn: () => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}::uuid`;
      return fn();
    });
  }
  ```
- `withPlatformAdmin()` 类似，额外 `SET LOCAL app.is_platform_admin = true`
- 所有 ServerComponent / Route Handler 从 NextAuth session 取 `tenantId`，包装查询

### 4. 连接层

- 开发/生产都用 `kolmatrix_app` 角色连接（`.env` 的 `DATABASE_URL`）
- Migration/seed 用 `kolmatrix_admin` 角色（`.env` 的 `DATABASE_ADMIN_URL`）

## Consequences

### 正面

- **应用层无法绕过：** RLS 在数据库层强制，即使应用代码有 bug 写错查询，也不会泄漏 tenant 数据
- **符合 PRD §6 要求：** 真正的租户隔离，不是应用层 `WHERE tenant_id = ?` 的软隔离
- **审计 / 法规友好：** 数据库级别的强制隔离对 GDPR / SOC2 等审计友好
- **简单 ops：** 共享 DB 不需要多实例，成本可控
- **seed 正确：** B0 seed 用 admin 角色 bypass RLS 插入初始数据

### 负面

- **每次查询必须走 withTenant 包装：** 忘了包装 → raw 查询返回 0 行（failsafe）
- **Prisma migration 需要特殊配置：** Prisma 默认不支持 RLS policies，需要 raw SQL migration
- **学习曲线：** 新 agent 不熟悉 `set local` + Prisma $transaction 组合
- **性能开销：** 每次查询多一次 SET LOCAL（微秒级，可忽略）
- **platform_admin 跨租户查询有额外路径：** `withPlatformAdmin` 需独立包装

### 中性

- 测试层（BI1 F007）需要验证 RLS 隔离（6 张表 × 3 场景 = 18 用例）
- Prisma 生成的客户端不知道 RLS，若直接用 `prisma.kol.findMany()` 不包装 withTenant → 返回 0 行（不是错误，是正确的 failsafe）

## Alternatives Considered

### 方案 A（schema per tenant，已拒绝）

每个租户独立 PostgreSQL schema：`tenant_a.kol`, `tenant_b.kol`...

- **拒绝理由 1：** Prisma 不支持动态 schema 切换，要写 raw SQL
- **拒绝理由 2：** 跨租户查询（platform_admin 场景）需 UNION N 个 schema 性能差
- **拒绝理由 3：** 添加新租户需 migrate 新 schema，运维复杂

### 方案 B（separate DB per tenant，已拒绝）

每个租户独立 PostgreSQL 数据库。

- **拒绝理由 1：** 资源利用率极低（100 tenant × 独立实例 = 成本爆炸）
- **拒绝理由 2：** 跨租户查询需要连多个 DB
- **拒绝理由 3：** 适用于有合规隔离要求的顶级企业（金融/医疗），SaaS KOL 营销不需要

### 方案 C（纯应用层 WHERE tenant_id，已拒绝）

不启用 RLS，Prisma 查询带 `where: { tenantId }`。

- **拒绝理由 1：** 应用层 bug 直接泄漏（忘 where → 看到所有 tenant 数据）
- **拒绝理由 2：** 不符合 PRD §6 "行级安全策略" 要求
- **拒绝理由 3：** 审计不友好（只能靠 code review 保证安全）

## References

- **Commits：** 
  - `a1fe8c6`（F004 NextAuth v5 + RLS-enforcing app role + tenant-scoped client）
  - `50e4eda`（F004 集成完成）
- **Specs：** 
  - `docs/specs/B0-database-schema.md` §5 RLS 策略 SQL
  - `docs/dev/architecture.md` §3.2 多租户 RLS 策略
  - `docs/specs/PRD.md` §8 用户角色定义
- **测试：** 
  - `docs/specs/BI1-test-infrastructure-spec.md` F007（RLS integration tests）
  - `docs/test-cases/B0-foundation-test-cases.md` TC-RLS-001~006

## Notes

### Migration 注意事项

- Prisma schema 只声明表 + 列
- RLS policies 作为 raw SQL migration 附加：
  ```sql
  -- prisma/migrations/20260418010000_app_role/migration.sql
  ALTER TABLE kol ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON kol ...;
  ```
- 每条 migration 含 `-- ROLLBACK:` 注释（BI2 会 CI 检查）

### 开发注意事项

- `.env.local` 双 URL：`DATABASE_URL`（app 角色）+ `DATABASE_ADMIN_URL`（migrate/seed 用）
- 直接跑 `prisma.kol.findMany()` 不包装 withTenant → 0 行（正确行为，不是 bug）
- 业务代码强制 `withTenant(session.user.tenantId, () => prisma.kol.findMany())`

### 重新评估触发条件

- 如果未来有"联邦查询"需求（如统计全平台 KOL 总数）→ 需设计 platform_admin 专用查询路径（已有 withPlatformAdmin，但查询性能需验证）
- 如果租户数 > 10,000 → 考虑 sharding（但 RLS 策略可复用）
- 如果某客户要求独立 DB 实例（合规要求）→ 为该客户单独 provision，应用层按 DATABASE_URL 路由
