/**
 * B7b-F003 · SavedSearch CRUD + RLS integration spec.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "33333333-3333-3333-3333-333333333333";
const USER_B = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(tenantId: string, userId: string) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Tenant ${tenantId.slice(0, 4)}`,
      slug: `tenant-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      tenantId,
      email: `user-${tenantId.slice(0, 4)}@test.local`,
      name: "User",
    },
    update: {},
  });
}

describe("SavedSearch", () => {
  it("supports create/list/delete in tenant scope", async () => {
    await seedTenant(TENANT_A, USER_A);

    const created = await asTenant(TENANT_A, (tx) =>
      tx.savedSearch.create({
        data: {
          tenantId: TENANT_A,
          userId: USER_A,
          name: "US FPS high tier",
          filters: {
            regions: ["US"],
            categories: ["FPS"],
            tiers: ["high"],
          },
        },
      })
    );

    const listed = await asTenant(TENANT_A, (tx) =>
      tx.savedSearch.findMany({ where: { userId: USER_A } })
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(created.id);

    await asTenant(TENANT_A, (tx) => tx.savedSearch.delete({ where: { id: created.id } }));
    const afterDelete = await asTenant(TENANT_A, (tx) =>
      tx.savedSearch.findMany({ where: { userId: USER_A } })
    );
    expect(afterDelete).toHaveLength(0);
  });

  it("isolates rows across tenants", async () => {
    await seedTenant(TENANT_A, USER_A);
    await seedTenant(TENANT_B, USER_B);

    const rowA = await asTenant(TENANT_A, (tx) =>
      tx.savedSearch.create({
        data: {
          tenantId: TENANT_A,
          userId: USER_A,
          name: "A search",
          filters: { search: "A" },
        },
      })
    );

    const rowB = await asTenant(TENANT_B, (tx) =>
      tx.savedSearch.create({
        data: {
          tenantId: TENANT_B,
          userId: USER_B,
          name: "B search",
          filters: { search: "B" },
        },
      })
    );

    const aView = await asTenant(TENANT_A, (tx) => tx.savedSearch.findMany());
    const bView = await asTenant(TENANT_B, (tx) => tx.savedSearch.findMany());

    expect(aView.map((r) => r.id)).toEqual([rowA.id]);
    expect(bView.map((r) => r.id)).toEqual([rowB.id]);
  });
});
