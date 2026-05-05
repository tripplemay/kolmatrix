/**
 * BL-034 F008 · `app.is_platform_admin` NULLIF guard regression spec.
 *
 * Mirror of the BI1-F008 / 20260420 test pattern but for the second GUC
 * the user_isolation policy reads. After
 * 20260505030000_rls_nullif_platform_admin we expect:
 *   1. A connection that previously held a SET LOCAL on
 *      `app.is_platform_admin` does NOT throw on the next withTenant
 *      query against the user table (NULLIF(empty, '') → NULL).
 *   2. An explicit `app.is_platform_admin = 'true'` still bypasses RLS
 *      for the `user` table (the legitimate platform-admin path).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  await setupTestDb();
  const admin = getAdminPrisma();
  for (const [id, slug] of [
    [TENANT_A, "f008-a"],
    [TENANT_B, "f008-b"],
  ] as const) {
    await admin.tenant.upsert({
      where: { id },
      update: {},
      create: { id, slug, name: `F008 Tenant ${slug}` },
    });
  }
  // Seed a user for each tenant so the policy has rows to filter.
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await admin.user.upsert({
      where: { email: `f008-${tenantId.slice(0, 4)}@example.test` },
      update: {},
      create: {
        tenantId,
        email: `f008-${tenantId.slice(0, 4)}@example.test`,
        hashedPassword: "$2b$12$deadbeef",
        name: `F008 User ${tenantId.slice(0, 4)}`,
        role: "marketer",
        locale: "en",
      },
    });
  }
});

afterAll(async () => {
  await teardownTestDb();
});

afterAll(async () => {
  await cleanDb();
});

describe("user_isolation NULLIF on app.is_platform_admin — BL-034 F008", () => {
  it("a withTenant query after a prior SET LOCAL on app.is_platform_admin does NOT throw on the user table", async () => {
    const app = getAppPrisma();

    // tx1: simulate the platform-admin code path. SET LOCAL is scoped to
    // the tx; once it commits, the GUC value sticks as `''` on the
    // pooled connection (Postgres semantics — the cause of the BI1-F008
    // bug for the sibling GUC). We explicitly query inside the tx so
    // the connection exits with the GUC having been touched.
    await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'true'`);
      await tx.$executeRawUnsafe(`SELECT 1`);
    });

    // tx2: a normal withTenant call on the SAME connection. Without the
    // NULLIF wrap this would throw `invalid input syntax for type
    // boolean: ""`. With F008 in place, the empty string degrades to
    // NULL and the policy short-circuits to the tenant-id branch.
    const rows = await asTenant(TENANT_A, (txn) =>
      txn.user.findMany({ where: {}, select: { email: true } }),
    );
    // tenant A's seeded user is visible; tenant B's is filtered.
    expect(rows.map((r) => r.email)).toEqual([
      `f008-${TENANT_A.slice(0, 4)}@example.test`,
    ]);
  });

  it("an explicit SET LOCAL app.is_platform_admin = true bypasses tenant filtering on user", async () => {
    const app = getAppPrisma();

    const everyoneEmails = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'true'`);
      const users = await tx.user.findMany({
        where: { email: { contains: "f008-" } },
        select: { email: true },
        orderBy: { email: "asc" },
      });
      return users.map((u) => u.email);
    });
    // Both tenants' seed users are visible because the platform-admin
    // branch is true.
    expect(everyoneEmails).toContain(`f008-${TENANT_A.slice(0, 4)}@example.test`);
    expect(everyoneEmails).toContain(`f008-${TENANT_B.slice(0, 4)}@example.test`);
  });
});
