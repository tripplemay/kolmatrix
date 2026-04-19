/**
 * Testcontainers PostgreSQL helper for integration tests.
 *
 * Lifecycle:
 *   - `setupTestDb()`     — boot postgres:16-alpine, run `prisma migrate
 *                           deploy` (schema + RLS policies + kolmatrix_app
 *                           role), create admin+app Prisma clients.
 *                           Idempotent: safe to call multiple times; the
 *                           container is shared within a worker.
 *   - `teardownTestDb()`  — disconnect clients and stop the container.
 *   - `cleanDb()`         — TRUNCATE all business tables between tests
 *                           (tenant-scoped + tenant itself). Preserves
 *                           schema / roles / policies.
 *   - `withTestTenant(fn)`— create a fresh tenant (unique slug), open a
 *                           `withTenant`-style transaction pinned to its
 *                           id, and hand the tx + tenantId to the callback.
 *   - `getAdminPrisma() / getAppPrisma()` — escape hatches for tests that
 *                           need the raw clients (e.g. RLS isolation
 *                           assertions that explicitly query without a
 *                           tenant context).
 *
 * Two Prisma clients exist on purpose:
 *   - `adminPrisma` connects as the postgres superuser (bypasses RLS).
 *     Used to bootstrap fixtures and for cleanDb().
 *   - `appPrisma`  connects as the `kolmatrix_app` non-superuser role,
 *     which matches src/lib/db.ts. RLS policies actually kick in on this
 *     client — it is the one that exercises the production auth surface.
 */
import { execSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

type Clients = {
  container: StartedPostgreSqlContainer;
  adminPrisma: PrismaClient;
  appPrisma: PrismaClient;
  adminUrl: string;
  appUrl: string;
};

const APP_ROLE_PASSWORD = "kolmatrix_app";
const POSTGRES_IMAGE = "postgres:16-alpine";
const DB_NAME = "kolmatrix";

let shared: Clients | null = null;

function buildAdminUrl(container: StartedPostgreSqlContainer): string {
  // Testcontainers exposes username/password we configured below; the
  // container port is randomised to avoid collisions with the dev stack
  // on 5433.
  const user = container.getUsername();
  const password = container.getPassword();
  const host = container.getHost();
  const port = container.getPort();
  return `postgresql://${user}:${password}@${host}:${port}/${DB_NAME}`;
}

function buildAppUrl(container: StartedPostgreSqlContainer): string {
  const host = container.getHost();
  const port = container.getPort();
  return `postgresql://kolmatrix_app:${APP_ROLE_PASSWORD}@${host}:${port}/${DB_NAME}`;
}

export async function setupTestDb(): Promise<Clients> {
  if (shared) return shared;

  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DB_NAME)
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  const adminUrl = buildAdminUrl(container);
  const appUrl = buildAppUrl(container);

  // `prisma migrate deploy` applies schema + creates kolmatrix_app role +
  // installs RLS policies. Runs via the superuser URL (prisma.config.ts
  // reads DATABASE_ADMIN_URL).
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_ADMIN_URL: adminUrl,
      DATABASE_URL: appUrl,
    },
  });

  const adminPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl }),
  });
  const appPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: appUrl }),
  });

  // Mirror URLs into process env so code under test (src/lib/db.ts when
  // imported from an integration test) resolves to the container. Test
  // files that import the production Prisma singleton will pick these up
  // at module load time.
  process.env.DATABASE_URL = appUrl;
  process.env.DATABASE_ADMIN_URL = adminUrl;

  shared = { container, adminPrisma, appPrisma, adminUrl, appUrl };
  return shared;
}

export async function teardownTestDb(): Promise<void> {
  if (!shared) return;
  await shared.appPrisma.$disconnect().catch(() => {});
  await shared.adminPrisma.$disconnect().catch(() => {});
  await shared.container.stop().catch(() => {});
  shared = null;
}

export function getAdminPrisma(): PrismaClient {
  if (!shared) {
    throw new Error("setupTestDb() must be called before getAdminPrisma()");
  }
  return shared.adminPrisma;
}

export function getAppPrisma(): PrismaClient {
  if (!shared) {
    throw new Error("setupTestDb() must be called before getAppPrisma()");
  }
  return shared.appPrisma;
}

/**
 * TRUNCATE every business table. Order mirrors FK dependency so the
 * `CASCADE` fallback is never actually needed, but we keep it for safety.
 * NextAuth `verification_token` is intentionally excluded — it has no
 * FKs and is cheap to leave populated.
 */
export async function cleanDb(): Promise<void> {
  const admin = getAdminPrisma();
  await admin.$executeRawUnsafe(
    `TRUNCATE TABLE
       "email_log", "email_template",
       "kol_campaign", "campaign",
       "kol",
       "account", "session", "user",
       "tenant"
     RESTART IDENTITY CASCADE`
  );
}

let tenantCounter = 0;

/**
 * Create a fresh tenant (unique slug) via the admin client, then open a
 * transaction on the app client with `SET LOCAL app.tenant_id` pinned to
 * that tenant — identical to src/lib/db.ts withTenant(). The callback
 * sees the tx handle and the tenant id.
 */
export async function withTestTenant<T>(
  fn: (tenantId: string, tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const admin = getAdminPrisma();
  const app = getAppPrisma();

  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random().toString(36).slice(2, 8)}`;

  const tenant = await admin.tenant.create({
    data: {
      name: `Test Tenant ${suffix}`,
      slug: `test-${suffix}`,
    },
  });

  return app.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    return fn(tenant.id, tx);
  });
}

/**
 * Run `fn` against the app client (kolmatrix_app role) inside a transaction
 * pinned to an *existing* tenant id. Used by tests that pre-seed data under
 * multiple tenants and need to prove RLS isolation across them.
 */
export async function asTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const app = getAppPrisma();
  return app.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}
