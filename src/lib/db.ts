/**
 * Application-side Prisma client.
 *
 * Two contracts:
 *   - `prisma`              — base client, connects as the non-superuser
 *                             `kolmatrix_app` role. Any query to a
 *                             tenant-scoped table without a tenant context
 *                             returns 0 rows.
 *   - `withTenant(id, fn)`  — open a transaction, `SET LOCAL app.tenant_id`,
 *                             run the callback against that transaction so
 *                             the RLS policies see the tenant and return
 *                             the caller's own rows.
 *   - `withPlatformAdmin`   — same shape, but sets
 *                             `app.is_platform_admin = true` (honored only
 *                             by the user_isolation policy). Used by the
 *                             credentials auth flow to look up a user by
 *                             email before we know which tenant they
 *                             belong to.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

import { assertUuid } from "./uuid";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// BL-034 F004: assertUuid moved to src/lib/uuid.ts so raw-SQL callers
// (e.g. embedding/kol-embed.ts) can import the validator without pulling
// in the Prisma singleton's DATABASE_URL boot guard at module load time.
// Re-exported here so existing imports keep resolving.
export { assertUuid } from "./uuid";

/**
 * Run `fn` inside a transaction whose `app.tenant_id` is pinned to the
 * caller's tenant. All reads/writes through the passed `tx` handle are
 * automatically filtered by the RLS policies.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  assertUuid(tenantId, "tenantId");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Run `fn` with platform-admin scope. The user_isolation policy lets rows
 * through when `app.is_platform_admin = true`, which is needed during
 * credentials auth (we only know the email at that point, not the tenant).
 * Must NOT be exposed to request code after login — reserve for
 * bootstrap / auth flows that prove their own authority.
 */
export async function withPlatformAdmin<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
    return fn(tx);
  });
}

export { Prisma };
export type TenantPrisma = Prisma.TransactionClient;
