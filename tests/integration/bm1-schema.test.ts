/**
 * BM1-F001 · Schema extension integration spec
 *
 * Contract covered:
 *   1. Product CRUD round-trip (admin client)
 *   2. Product RLS isolates tenants (NULLIF-guarded policy)
 *   3. Kol new columns round-trip (5 representative ones + loop over
 *      the remaining 11-dim filter predicates)
 *   4. KolCampaign.kol_fee round-trip
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
  setupTestDb,
  teardownTestDb,
  withTestTenant,
} from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  // cleanDb() sweeps business tables but not product/event_log/audit_log.
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "product"`);
});

describe("product table", () => {
  it("CRUD round-trips via admin client", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Acme Studios", slug: `acme-${Date.now()}` },
    });

    const created = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "Honor of Kings",
        category: "MOBA",
        targetAudience: "Casual mobile gamers 18-34",
        uniqueSellingPoints: "Daily tournaments + seasonal skins",
        downloadUrl: "https://example.com/hok",
        launchDate: new Date("2025-12-01"),
      },
    });

    expect(created.id).toMatch(/^c[a-z0-9]{20,}$/);
    expect(created.uniqueSellingPoints).toContain("Daily tournaments");
    expect(created.aiAssets).toBeNull();

    const updated = await admin.product.update({
      where: { id: created.id },
      data: {
        aiAssets: { emailTemplates: [{ subject: "Hello", body: "Hi" }] },
      },
    });
    expect(updated.aiAssets).toMatchObject({
      emailTemplates: [{ subject: "Hello", body: "Hi" }],
    });

    await admin.product.delete({ where: { id: created.id } });
    const count = await admin.product.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(0);
  });

  it("isolates products across tenants via RLS (NULLIF-guarded)", async () => {
    const admin = getAdminPrisma();

    const tenantA = await admin.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-${Date.now()}` },
    });
    const tenantB = await admin.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-${Date.now()}` },
    });

    await admin.product.create({
      data: {
        tenantId: tenantA.id,
        name: "A Product",
        category: "RPG",
        uniqueSellingPoints: "Tenant A exclusive",
      },
    });
    await admin.product.create({
      data: {
        tenantId: tenantB.id,
        name: "B Product",
        category: "FPS",
        uniqueSellingPoints: "Tenant B exclusive",
      },
    });

    // Under tenant A context, RLS must hide tenant B's row.
    const seenByA = await asTenant(tenantA.id, (tx) =>
      tx.product.findMany({ orderBy: { name: "asc" } })
    );
    expect(seenByA.map((p) => p.name)).toEqual(["A Product"]);

    const seenByB = await asTenant(tenantB.id, (tx) =>
      tx.product.findMany({ orderBy: { name: "asc" } })
    );
    expect(seenByB.map((p) => p.name)).toEqual(["B Product"]);

    // App client without a tenant context (NULLIF degrades '' → NULL) = 0 rows.
    const app = getAppPrisma();
    const noContext = await app.product.findMany();
    expect(noContext).toEqual([]);
  });
});

describe("kol new BM1 columns", () => {
  it("round-trips valueScore / isGaming / isSaved / relationshipStatus / tags", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const created = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "bm1_star",
          displayName: "BM1 Star",
          categories: ["moba"],
          valueScore: 78,
          isGaming: true,
          isSaved: true,
          relationshipStatus: "negotiating",
          tags: ["priority", "english"],
        },
      });

      expect(created.valueScore).toBe(78);
      expect(created.isGaming).toBe(true);
      expect(created.isSaved).toBe(true);
      expect(created.relationshipStatus).toBe("negotiating");
      expect(created.tags).toEqual(["priority", "english"]);
      // Defaults should appear even when omitted (covered below).
    });
  });

  it("applies defaults for unspecified new columns", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const created = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "default_bm1",
          displayName: "Default KOL",
          categories: [],
        },
      });
      expect(created.valueScore).toBeNull();
      expect(created.isGaming).toBe(true);
      expect(created.isSaved).toBe(false);
      expect(created.relationshipStatus).toBe("prospect");
      expect(created.tags).toEqual([]);
      expect(created.knownBrandCollabs).toEqual([]);
    });
  });

  it("round-trips the remaining 11-dim filter columns", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const now = new Date("2026-04-20T00:00:00Z");
      const created = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "dim_test",
          displayName: "Dim Test",
          categories: ["moba"],
          uploadsPerMonth: 12,
          lastUploadAt: now,
          monetizationStatus: "MONETIZED",
          brandSafetyRating: "PG",
          knownBrandCollabs: ["AcmeCo", "ContosoInc"],
          engagementAuthenticity: 87,
          aiTaggedAt: now,
          aiTagConfidence: "high",
        },
      });

      const checks: Array<[string, unknown]> = [
        ["uploadsPerMonth", 12],
        ["monetizationStatus", "MONETIZED"],
        ["brandSafetyRating", "PG"],
        ["engagementAuthenticity", 87],
        ["aiTagConfidence", "high"],
      ];
      for (const [key, expected] of checks) {
        expect(created[key as keyof typeof created]).toBe(expected);
      }
      expect(created.lastUploadAt?.toISOString()).toBe(now.toISOString());
      expect(created.aiTaggedAt?.toISOString()).toBe(now.toISOString());
      expect(created.knownBrandCollabs).toEqual(["AcmeCo", "ContosoInc"]);
    });
  });
});

describe("kol_campaign.kol_fee", () => {
  it("round-trips the new Decimal(10,2) kol_fee column", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const kol = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "fee_kol",
          displayName: "Fee KOL",
          categories: [],
        },
      });

      const admin = getAdminPrisma();
      // Campaign creation requires an owner user; build minimal fixtures
      // via admin to avoid threading auth through this schema smoke test.
      const user = await admin.user.create({
        data: {
          tenantId,
          email: `owner-${Date.now()}@bm1.test`,
          name: "Owner",
        },
      });
      const campaign = await admin.campaign.create({
        data: { tenantId, name: "BM1 Campaign", ownerUserId: user.id },
      });

      const kc = await tx.kolCampaign.create({
        data: {
          tenantId,
          kolId: kol.id,
          campaignId: campaign.id,
          kolFee: 1234.5,
        },
      });
      expect(kc.kolFee?.toString()).toBe("1234.5");
    });
  });
});
