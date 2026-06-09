/**
 * BL-025-F006 · Composer reader integration spec.
 *
 * BL-099-F005 (ADR-018): the legacy email_template dual-write mirror was
 * removed — Asset is the single source of truth. The original mirror
 * assertion cases (createAsset/updateAsset/deleteAsset → email_template
 * row, plus migrated-by-metadata propagation) have been deleted. What
 * remains is the Asset-backed behaviour:
 *   - loadOutreachTemplates surfaces asset-backed rows with the
 *     system / user scope mapping intact (+ en fallback when zh is empty)
 *   - loadAssetsForComposer search + productId filters at the integration
 *     layer
 *   - RLS isolation — tenant A's writes are invisible to tenant B
 */
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadOutreachTemplates } from "@/lib/email/templates";
import { createAsset } from "@/lib/assets/mutations";
import { loadAssetsForComposer } from "@/lib/assets/queries";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000002";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(tenantId: string) {
  return getAdminPrisma().tenant.create({
    data: {
      id: tenantId,
      name: `F006 Tenant ${tenantId.slice(0, 4)}`,
      slug: `f006-${tenantId.slice(0, 8)}`,
    },
  });
}

const seedEmail = {
  subject: "Hi {{kol.name}}",
  body: "Original body",
  locale: "en",
  variables: [{ token: "{{kol.name}}", required: true }],
};

// BL-099-F005 (ADR-018): the email_template dual-write mirror was removed
// — Asset is now the single source of truth. The original "dual-write to
// email_template" describe (createAsset/updateAsset/deleteAsset → mirror
// assertions, plus the migrated-by-metadata propagation case) existed
// solely to verify that mirror and is deleted. The Asset-side write +
// read behaviour is covered by the loadOutreachTemplates /
// loadAssetsForComposer suites below and by queries.test.ts.

describe("BL-025-F006 · loadOutreachTemplates delegates to asset table", () => {
  it("returns asset-backed rows with system / user scope intact", async () => {
    await seedTenant(TENANT_A);
    // Seed a system_seed asset (tenantId IS NULL) + a tenant-scoped
    // user-created asset; both must surface, scopes preserved.
    const admin = getAdminPrisma();
    const sys = await admin.asset.create({
      data: {
        tenantId: null,
        type: "email",
        name: "System Initial Outreach",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "system_seed",
        status: "published",
      },
    });
    const user = await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        type: "email",
        name: "Tenant A Custom",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });

    const rows = await asTenant(TENANT_A, (tx) =>
      loadOutreachTemplates(tx, TENANT_A, "en")
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(sys.id);
    expect(ids).toContain(user.id);
    const sysRow = rows.find((r) => r.id === sys.id)!;
    const userRow = rows.find((r) => r.id === user.id)!;
    expect(sysRow.scope).toBe("system");
    expect(userRow.scope).toBe("user");
  });

  it("falls back to en system seeds when zh has none", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    await admin.asset.create({
      data: {
        tenantId: null,
        type: "email",
        name: "EN System",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "system_seed",
        status: "published",
      },
    });
    const rows = await asTenant(TENANT_A, (tx) =>
      loadOutreachTemplates(tx, TENANT_A, "zh")
    );
    expect(rows.find((r) => r.scope === "system" && r.locale === "en")).toBeDefined();
  });
});

// BL-027-F006.D · S4 Soft-watch backfill — loadAssetsForComposer
// search + productId filter at the integration layer (queries.test.ts
// covers the same predicate translation against a stubbed Prisma; this
// suite hits the real where + ILIKE on Postgres).
describe("BL-027-F006.D · loadAssetsForComposer search + productId filters", () => {
  it("filters by case-insensitive name match (search arg)", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        type: "email",
        name: "Welcome to KOLMatrix",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });
    await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        type: "email",
        name: "Goodbye for now",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });

    const rows = await asTenant(TENANT_A, (tx) =>
      loadAssetsForComposer(tx, "email", "en", "welcome")
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("Welcome to KOLMatrix");
    expect(names).not.toContain("Goodbye for now");
  });

  it("filters by exact productId (compound with locale + search)", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    const product = await admin.product.create({
      data: {
        tenantId: TENANT_A,
        name: "Demo Product",
        category: "Game",
        targetAudience: "Casual gamers in the demo segment",
        uniqueSellingPoints: "Compact USP for filter test",
      },
    });
    await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        productId: product.id,
        type: "email",
        name: "Product-tied Outreach",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });
    await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        productId: null,
        type: "email",
        name: "Untied Outreach",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });

    const rows = await asTenant(TENANT_A, (tx) =>
      loadAssetsForComposer(tx, "email", "en", undefined, product.id)
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("Product-tied Outreach");
    expect(names).not.toContain("Untied Outreach");
  });
});

describe("BL-025-F006 · RLS isolation across composer reads", () => {
  it("tenant A's email asset is invisible to tenant B's composer reads", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    const aAsset = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Tenant A v1",
        content: seedEmail,
        source: "user_created",
        status: "published",
      })
    );

    const bRows = await asTenant(TENANT_B, (tx) =>
      loadOutreachTemplates(tx, TENANT_B, "en")
    );
    expect(bRows.find((r) => r.id === aAsset.id)).toBeUndefined();
  });
});
