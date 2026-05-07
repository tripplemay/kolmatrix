/**
 * BL-051a-F010 + F011 · End-to-end product soft delete spec.
 *
 * Real-DB verification that complements tests/unit/products-soft-delete
 * (mocked Prisma). Two acceptance cases the unit suite can't cover:
 *
 *   1. Full flow: insert product + reference rows → soft delete with
 *      cascade confirm → product.deletedAt populated, related campaign
 *      and asset rows physically intact (D2 — no cascade mutation),
 *      F007 list query excludes the tombstone via deletedAt: null.
 *
 *   2. F011 audit trail permanence: product.deleted audit_log row is
 *      written, survives subsequent ops, and isn't FK-cascade-deleted
 *      because audit_log has no FK back to product (verified by
 *      hard-deleting the product row and confirming the audit row
 *      remains).
 *
 * Spec callout: orphan campaign 4425e07e was ops-cleaned 2026-05-07 at
 * commit bc69a65. This batch's soft delete prevents new orphans by
 * keeping the product row physically present.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedProductWithRefs() {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: {
      name: "Soft Delete Studio",
      slug: `softdel-${Date.now()}-${Math.random()}`,
    },
  });
  const owner = await admin.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${Date.now()}-${Math.random()}@softdel.test`,
      hashedPassword: "x",
      name: "Owner",
      role: "marketer",
    },
  });
  const product = await admin.product.create({
    data: {
      tenantId: tenant.id,
      name: "Soft Delete Test Product",
      category: "MOBA",
      targetAudience: "Mobile gamers 18-34",
      uniqueSellingPoints: "Daily tournaments",
    },
  });
  const campaign = await admin.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "SoftDel Campaign",
      status: "draft",
      ownerUserId: owner.id,
      productId: product.id,
    },
  });
  const asset = await admin.asset.create({
    data: {
      tenantId: tenant.id,
      productId: product.id,
      type: "email",
      name: "SoftDel Asset",
      content: { subject: "test", body: "test" },
      source: "user_created",
      status: "draft",
    },
  });
  return { tenantId: tenant.id, ownerId: owner.id, product, campaign, asset };
}

describe("product soft delete end-to-end (BL-051a-F010 + F011)", () => {
  it("full flow: soft-delete with cascade confirm + list filter excludes tombstones + relations preserved", async () => {
    const { tenantId, product, campaign, asset } = await seedProductWithRefs();
    const admin = getAdminPrisma();

    // Initial state: list returns the product (deletedAt is null).
    const before = await admin.product.findMany({
      where: { tenantId, deletedAt: null },
    });
    expect(before).toHaveLength(1);
    expect(before[0].id).toBe(product.id);

    // Soft delete via raw UPDATE (the action helper depends on auth +
    // withTenant — covered in tests/unit. This test verifies the DB-
    // level shape after the F008 contract has fired.)
    await admin.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date() },
    });

    // F007 list filter: tombstone is invisible to active queries.
    const after = await admin.product.findMany({
      where: { tenantId, deletedAt: null },
    });
    expect(after).toHaveLength(0);

    // D2 — campaign and asset rows physically intact (no cascade mutation).
    const campaignAfter = await admin.campaign.findUnique({
      where: { id: campaign.id },
    });
    expect(campaignAfter).not.toBeNull();
    expect(campaignAfter?.productId).toBe(product.id);

    const assetAfter = await admin.asset.findUnique({
      where: { id: asset.id },
    });
    expect(assetAfter).not.toBeNull();
    expect(assetAfter?.productId).toBe(product.id);

    // F009-aligned: campaign join through `include: { product: true }`
    // still resolves the (now-tombstoned) product, with deletedAt set
    // — so the UI can render "(Product deleted)".
    const campaignWithProduct = await admin.campaign.findUnique({
      where: { id: campaign.id },
      select: { product: { select: { deletedAt: true } } },
    });
    expect(campaignWithProduct?.product?.deletedAt).not.toBeNull();
  });

  it("audit_log row outlives the product (no FK cascade) — F011 permanence guarantee", async () => {
    const { tenantId, ownerId, product } = await seedProductWithRefs();
    const admin = getAdminPrisma();

    // Write a product.deleted audit row that mirrors what F008's
    // logAudit produces in production.
    await admin.auditLog.create({
      data: {
        tenantId,
        actorUserId: ownerId,
        action: "product.deleted",
        resourceType: "product",
        resourceId: product.id,
        payload: {
          after: {
            productName: product.name,
            cascadeCount: { campaign: 1, asset: 1, kolCampaign: 0 },
            softDelete: true,
          },
        },
      },
    });

    // Hard-delete the product (worst case — far beyond what soft delete
    // would do). The audit_log row must survive because the schema
    // has no FK from audit_log.resourceId → product.id.
    // (Cascade child rows campaign + asset would block FK-checking
    // delete; remove them first to isolate the audit_log assertion.)
    await admin.asset.deleteMany({ where: { productId: product.id } });
    await admin.campaign.deleteMany({ where: { productId: product.id } });
    await admin.product.delete({ where: { id: product.id } });

    const auditRow = await admin.auditLog.findFirst({
      where: {
        tenantId,
        action: "product.deleted",
        resourceId: product.id,
      },
    });
    expect(auditRow).not.toBeNull();
    const payload = auditRow?.payload as
      | { after?: { softDelete?: boolean; cascadeCount?: unknown } }
      | null;
    expect(payload?.after?.softDelete).toBe(true);
    expect(payload?.after?.cascadeCount).toEqual({
      campaign: 1,
      asset: 1,
      kolCampaign: 0,
    });
  });
});
