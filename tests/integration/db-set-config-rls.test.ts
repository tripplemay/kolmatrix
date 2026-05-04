/**
 * BL-020-F004 · `withTenant` / `withPlatformAdmin` parameterised set_config
 *
 * Covers:
 *   1. RLS enforcement still holds after the SET LOCAL → set_config rewrite
 *      — tenant A writes a kol via the production `withTenant`, tenant B
 *      reading the same table sees zero rows.
 *   2. Injection-shaped tenantId values are rejected by `assertUuid`
 *      before any SQL runs (defense-in-depth — set_config itself is
 *      already parameterised, but the application layer still validates).
 *   3. `withPlatformAdmin` bypasses the `user` table RLS so the
 *      credentials-auth flow can look up an account by email before the
 *      tenant context is known.
 *
 * The test imports `@/lib/db` *after* `setupTestDb()` mutates
 * `process.env.DATABASE_URL`, so the production singleton connects to the
 * testcontainer rather than to any dev/local URL leaked into the env.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { makeKol, makeTenant, makeUser } from "../fixtures";
import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

type DbModule = typeof import("@/lib/db");
let withTenant: DbModule["withTenant"];
let withPlatformAdmin: DbModule["withPlatformAdmin"];

beforeAll(async () => {
  await setupTestDb();
  // Dynamic import after the testcontainer URL is stamped into env so the
  // production Prisma singleton in src/lib/db.ts connects to the test DB.
  const mod = await import("@/lib/db");
  withTenant = mod.withTenant;
  withPlatformAdmin = mod.withPlatformAdmin;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("withTenant — set_config parameterised RLS enforcement", () => {
  it("tenant A's kol row is invisible to tenant B (RLS still enforced)", async () => {
    const admin = getAdminPrisma();
    const a = await admin.tenant.create({ data: makeTenant({ slug: "f004-a" }) });
    const b = await admin.tenant.create({ data: makeTenant({ slug: "f004-b" }) });

    const created = await withTenant(a.id, (tx) =>
      tx.kol.create({ data: makeKol({ tenantId: a.id, handle: "f004-a-handle" }) })
    );
    expect(created.id).toBeTruthy();

    const aSees = await withTenant(a.id, (tx) => tx.kol.findMany({ select: { id: true } }));
    expect(aSees.map((k) => k.id)).toEqual([created.id]);

    const bSees = await withTenant(b.id, (tx) => tx.kol.findMany({ select: { id: true } }));
    expect(bSees).toEqual([]);
  });

  it("rejects injection-shaped tenantId before any SQL is executed", async () => {
    const admin = getAdminPrisma();
    const a = await admin.tenant.create({ data: makeTenant({ slug: "f004-injection" }) });
    await withTenant(a.id, (tx) =>
      tx.kol.create({ data: makeKol({ tenantId: a.id, handle: "still-here" }) })
    );

    await expect(
      withTenant("'; DROP TABLE kol; --", (tx) => tx.kol.findMany())
    ).rejects.toThrow(/tenantId must be a UUID string/);

    // Sanity: the row survives — assertUuid rejected the injection before
    // it could reach the DB layer at all.
    const survivors = await withTenant(a.id, (tx) =>
      tx.kol.findMany({ select: { handle: true } })
    );
    expect(survivors.map((k) => k.handle)).toEqual(["still-here"]);
  });
});

describe("withPlatformAdmin — user-table RLS bypass for credentials auth", () => {
  it("finds a user by email across tenants without app.tenant_id set", async () => {
    const admin = getAdminPrisma();
    const a = await admin.tenant.create({ data: makeTenant({ slug: "f004-pa-a" }) });
    const b = await admin.tenant.create({ data: makeTenant({ slug: "f004-pa-b" }) });
    const userA = await admin.user.create({
      data: makeUser({ tenantId: a.id, email: "alpha@f004.test" }),
    });
    const userB = await admin.user.create({
      data: makeUser({ tenantId: b.id, email: "beta@f004.test" }),
    });

    const found = await withPlatformAdmin((tx) =>
      tx.user.findMany({ select: { id: true, email: true } })
    );
    const ids = found.map((u) => u.id).sort();
    expect(ids).toEqual([userA.id, userB.id].sort());

    const byEmail = await withPlatformAdmin((tx) =>
      tx.user.findUnique({ where: { email: "beta@f004.test" } })
    );
    expect(byEmail?.id).toBe(userB.id);
  });
});
