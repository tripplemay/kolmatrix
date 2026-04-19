import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
  withTestTenant,
} from "../helpers/db";

describe("Testcontainers PostgreSQL bootstrap", () => {
  beforeAll(async () => {
    await setupTestDb();
    await cleanDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("boots a container, applies prisma migrate deploy, and accepts a tenant row", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Db Setup Smoke", slug: "db-setup-smoke" },
    });
    expect(tenant.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(tenant.name).toBe("Db Setup Smoke");

    const fetched = await admin.tenant.findUnique({ where: { id: tenant.id } });
    expect(fetched?.slug).toBe("db-setup-smoke");
  });

  it("installed the kolmatrix_app role and RLS policies (unscoped kol read returns 0)", async () => {
    // Seed a tenant + kol via the admin client (bypasses RLS).
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "RLS Smoke", slug: "rls-smoke" },
    });
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "smoke_kol",
        displayName: "Smoke KOL",
        platform: "youtube",
        countryCode: "US",
        language: "en",
        followerCount: 1000,
        engagementRate: 0.05,
        avgViews: 500,
        categories: ["gaming"],
        aiScore: 80,
        audienceGeoDist: {},
        audienceAgeDist: {},
        audienceGenderDist: {},
      },
    });

    // Unscoped read via the app client — no tenant context — must return 0
    // rows because the tenant_isolation policy drops everything when
    // `app.tenant_id` is unset.
    const { getAppPrisma } = await import("../helpers/db");
    const app = getAppPrisma();
    const rows = await app.kol.findMany();
    expect(rows).toHaveLength(0);
  });

  it("withTestTenant isolates rows: a caller only sees its own tenant", async () => {
    const tenantARows = await withTestTenant(async (tenantId, tx) => {
      await tx.kol.create({
        data: {
          tenantId,
          handle: "tenant_a_kol",
          displayName: "Tenant A KOL",
          platform: "twitch",
          countryCode: "JP",
          language: "ja",
          followerCount: 2000,
          engagementRate: 0.04,
          avgViews: 800,
          categories: ["gaming"],
          aiScore: 72,
          audienceGeoDist: {},
          audienceAgeDist: {},
          audienceGenderDist: {},
        },
      });
      return tx.kol.findMany();
    });
    expect(tenantARows).toHaveLength(1);
    expect(tenantARows[0]?.handle).toBe("tenant_a_kol");

    const tenantBRows = await withTestTenant(async (_tenantId, tx) => {
      return tx.kol.findMany();
    });
    expect(tenantBRows).toHaveLength(0);
  });
});
