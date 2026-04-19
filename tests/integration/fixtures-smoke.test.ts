/**
 * F005 smoke: proves the fixture factories produce rows Prisma actually
 * accepts against the migrated schema. Any constraint mismatch (decimal
 * precision, JSON shape, unique key collisions) surfaces here instead
 * of exploding later inside F006/F007 business tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeCampaign, makeKol, makeTenant, makeUser } from "../fixtures";
import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

describe("Fixture factories → DB round-trip", () => {
  beforeAll(async () => {
    await setupTestDb();
    await cleanDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("inserts a tenant → user → kol → campaign chain with factory defaults", async () => {
    const admin = getAdminPrisma();

    const tenant = await admin.tenant.create({ data: makeTenant() });
    const user = await admin.user.create({
      data: makeUser({ tenantId: tenant.id }),
    });
    const kol = await admin.kol.create({
      data: makeKol({ tenantId: tenant.id }),
    });
    const campaign = await admin.campaign.create({
      data: makeCampaign({ tenantId: tenant.id, ownerUserId: user.id }),
    });

    expect(tenant.slug.startsWith("tenant-")).toBe(true);
    expect(user.tenantId).toBe(tenant.id);
    expect(user.role).toBe("marketer");
    expect(kol.tenantId).toBe(tenant.id);
    expect(kol.followerCount).toBeGreaterThan(0);
    expect(kol.categories.length).toBeGreaterThan(0);
    expect(Number(kol.engagementRate)).toBeGreaterThan(0);
    expect(campaign.tenantId).toBe(tenant.id);
    expect(campaign.ownerUserId).toBe(user.id);
    expect(campaign.markets.length).toBeGreaterThan(0);
  });

  it("respects overrides (country JP / follower=12345 / custom slug)", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: makeTenant({ slug: `override-${Date.now()}`, plan: "pro" }),
    });
    const kol = await admin.kol.create({
      data: makeKol({
        tenantId: tenant.id,
        countryCode: "JP",
        followerCount: 12_345,
        platform: "twitch",
      }),
    });

    expect(tenant.plan).toBe("pro");
    expect(kol.countryCode).toBe("JP");
    expect(kol.followerCount).toBe(12_345);
    expect(kol.platform).toBe("twitch");
  });

  it("two makeKol() calls produce non-colliding unique keys", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({ data: makeTenant() });

    const a = await admin.kol.create({ data: makeKol({ tenantId: tenant.id }) });
    const b = await admin.kol.create({ data: makeKol({ tenantId: tenant.id }) });

    expect(a.id).not.toBe(b.id);
    // uniqueness is enforced on (tenantId, platform, handle) — random
    // handle suffix must keep the two inserts apart even when platforms
    // collide by chance.
    if (a.platform === b.platform) {
      expect(a.handle).not.toBe(b.handle);
    }
  });
});
