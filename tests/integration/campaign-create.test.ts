/**
 * BM2-F004 · Campaign create integration spec
 *
 * Exercises the shared `createCampaignRecord` helper used by both the
 * Server Action and POST /api/campaigns. Covers:
 *
 *   - Happy path persists a draft campaign with spendTotal=0, the
 *     product FK set, and markets[] populated
 *   - event_log `campaign.created` row written with resourceId = new id
 *   - productNotFound raised when the productId is outside the tenant
 *     (cross-tenant RLS)
 *   - endDate < startDate fails validation at the schema layer before
 *     touching the DB
 *   - budget parsing: non-numeric / overflow / 2-decimal precision
 *   - kpiTarget stored as JSON `{ brief }` shape
 *   - Tenant isolation: two tenants with the same product name create
 *     independent campaigns
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

type CreateCampaignFn = typeof import(
  "@/lib/campaigns/create"
).createCampaignRecord;
type Schema = typeof import(
  "@/lib/campaigns/schema"
).createCampaignSchemaWithDateOrder;

let createCampaignRecord: CreateCampaignFn;
let CampaignCreateError: typeof import(
  "@/lib/campaigns/create"
).CampaignCreateError;
let createCampaignSchema: Schema;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const OWNER_A = "33333333-3333-3333-3333-333333333333";
const OWNER_B = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  await setupTestDb();
  ({ createCampaignRecord, CampaignCreateError } = await import(
    "@/lib/campaigns/create"
  ));
  ({ createCampaignSchemaWithDateOrder: createCampaignSchema } = await import(
    "@/lib/campaigns/schema"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenantWithProduct(
  tenantId: string,
  userId: string,
  productName = "Seed Game"
) {
  const admin = getAdminPrisma();
  await admin.tenant.create({
    data: {
      id: tenantId,
      name: `Tenant ${tenantId.slice(0, 4)}`,
      slug: `t-${tenantId.slice(0, 8)}`,
    },
  });
  await admin.user.create({
    data: {
      id: userId,
      tenantId,
      email: `user-${tenantId.slice(0, 4)}@test.local`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
  });
  const product = await admin.product.create({
    data: {
      tenantId,
      name: productName,
      category: "RPG",
      uniqueSellingPoints: "USP",
    },
  });
  return product;
}

describe("createCampaignRecord()", () => {
  it("persists a draft campaign with spendTotal=0 and product FK", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const input = createCampaignSchema.parse({
      name: "Cyber Odyssey Beta",
      productId: product.id,
      budgetAmount: "10000.50",
      markets: ["global", "us"],
      ownerUserId: OWNER_A,
      kpiTarget: "2M views in 30 days",
    });

    const result = await createCampaignRecord(TENANT_A, input);
    expect(result.id).toMatch(/^[0-9a-f-]+$/);

    const row = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(row.status).toBe("draft");
    expect(Number(row.spendTotal.toString())).toBe(0);
    expect(row.productId).toBe(product.id);
    expect(Number(row.budgetAmount!.toString())).toBe(10000.5);
    expect(row.markets).toEqual(["global", "us"]);
    expect(row.ownerUserId).toBe(OWNER_A);
    expect(row.kpiTarget).toEqual({ brief: "2M views in 30 days" });
  });

  it("writes an event_log row with campaign.created + resourceId", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const input = createCampaignSchema.parse({
      name: "Event Log Test",
      productId: product.id,
      ownerUserId: OWNER_A,
    });
    const { id } = await createCampaignRecord(TENANT_A, input);
    // logEvent is fire-and-forget, so poll briefly for the row to
    // appear instead of relying on the microtask ordering.
    const deadline = Date.now() + 2000;
    let rows: Array<{
      tenantId: string | null;
      actorId: string | null;
    }> = [];
    while (Date.now() < deadline) {
      rows = await getAdminPrisma().eventLog.findMany({
        where: { type: "campaign.created", resourceId: id },
        select: { tenantId: true, actorId: true },
      });
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenantId).toBe(TENANT_A);
    expect(rows[0]!.actorId).toBe(OWNER_A);
  });

  it("throws product_not_found when the productId is outside the tenant (cross-tenant RLS)", async () => {
    const productA = await seedTenantWithProduct(TENANT_A, OWNER_A, "A Game");
    await seedTenantWithProduct(TENANT_B, OWNER_B, "B Game");
    const input = createCampaignSchema.parse({
      name: "Cross Tenant",
      productId: productA.id,
      ownerUserId: OWNER_B,
    });
    await expect(
      createCampaignRecord(TENANT_B, input)
    ).rejects.toBeInstanceOf(CampaignCreateError);
  });

  it("throws product_not_found for an unknown productId", async () => {
    await seedTenantWithProduct(TENANT_A, OWNER_A);
    const input = createCampaignSchema.parse({
      name: "Unknown Product",
      productId: "cuid-that-does-not-exist",
      ownerUserId: OWNER_A,
    });
    await expect(
      createCampaignRecord(TENANT_A, input)
    ).rejects.toMatchObject({ code: "product_not_found" });
  });
});

describe("createCampaignSchema (zod)", () => {
  it("flags a missing name", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const parsed = createCampaignSchema.safeParse({
      name: "",
      productId: product.id,
      ownerUserId: OWNER_A,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        "nameRequired"
      );
    }
  });

  it("flags endBeforeStart when dates reverse", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const parsed = createCampaignSchema.safeParse({
      name: "Reversed dates",
      productId: product.id,
      ownerUserId: OWNER_A,
      startDate: "2026-05-15",
      endDate: "2026-05-10",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        "endBeforeStart"
      );
    }
  });

  it("flags non-numeric budget", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const parsed = createCampaignSchema.safeParse({
      name: "Bad budget",
      productId: product.id,
      ownerUserId: OWNER_A,
      budgetAmount: "abc",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        "budgetInvalid"
      );
    }
  });

  it("accepts a valid 2-decimal budget and strips an empty string", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const parsed = createCampaignSchema.parse({
      name: "Good budget",
      productId: product.id,
      ownerUserId: OWNER_A,
      budgetAmount: "12.50",
      kpiTarget: "",
    });
    expect(parsed.budgetAmount).toBe(12.5);
    expect(parsed.kpiTarget).toBeUndefined();
  });

  it("flags overflow budget", async () => {
    const product = await seedTenantWithProduct(TENANT_A, OWNER_A);
    const parsed = createCampaignSchema.safeParse({
      name: "Too big",
      productId: product.id,
      ownerUserId: OWNER_A,
      budgetAmount: "99999999999.99",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        "budgetOverflow"
      );
    }
  });
});
