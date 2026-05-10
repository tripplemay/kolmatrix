/**
 * MVP-vf-F003 · Bulk-add KOLs to a campaign integration spec.
 *
 * Hits `bulkAddKolsToCampaign(tenantId, actorId, campaignId, kolIds)`
 * directly so the new POST /api/campaigns/:id/kols/bulk endpoint stays
 * thin — same pattern as the single-add tests in campaign-detail.test.ts.
 *
 * Covers:
 *   1. Inserts new KolCampaign rows for each fresh kolId, skips already-
 *      linked ones, counts not-found ids.
 *   2. Recomputes spendTotal in the same withTenant transaction.
 *   3. Writes one audit_log row per successful insert with action
 *      "kol.bulk_added_to_campaign".
 *   4. RLS isolates a Tenant B campaign attempt from Tenant A's KOLs.
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

type KolOps = typeof import("@/lib/campaigns/kol-operations");

let kolOps: KolOps;

const TENANT_A = "11111111-0000-4000-8000-aaaaaaaaaaaa";
const TENANT_B = "22222222-0000-4000-8000-bbbbbbbbbbbb";
const OWNER_A = "33333333-0000-4000-8000-cccccccccccc";
const OWNER_B = "44444444-0000-4000-8000-dddddddddddd";

beforeAll(async () => {
  await setupTestDb();
  kolOps = await import("@/lib/campaigns/kol-operations");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log"`);
});

interface World {
  tenantId: string;
  ownerId: string;
  campaignId: string;
  kolIds: string[];
}

async function seedTenant(
  tenantId: string,
  ownerId: string,
  kolCount = 5
): Promise<World> {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Tenant ${tenantId.slice(0, 4)}`,
      slug: `t-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: ownerId },
    create: {
      id: ownerId,
      tenantId,
      email: `owner-${tenantId.slice(0, 4)}@test.local`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
    update: {},
  });
  const product = await admin.product.create({
    data: {
      tenantId,
      name: "Launch Game",
      category: "RPG",
      targetAudience: "Core RPG fans aged 18-30",
      uniqueSellingPoints: "USP",
    },
  });
  const campaign = await admin.campaign.create({
    data: {
      tenantId,
      name: "Campaign Alpha",
      ownerUserId: ownerId,
      productId: product.id,
      status: "draft",
      spendTotal: "0",
    },
  });
  const kolIds: string[] = [];
  for (let i = 0; i < kolCount; i += 1) {
    const k = await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: `bulk_${tenantId.slice(0, 4)}_${i}`,
        displayName: `Bulk ${i}`,
        followerCount: 1_000 * (i + 1),
      },
    });
    kolIds.push(k.id);
  }
  return { tenantId, ownerId, campaignId: campaign.id, kolIds };
}

describe("bulkAddKolsToCampaign()", () => {
  it("inserts new links + recomputes spendTotal + writes audit_log per add", async () => {
    const w = await seedTenant(TENANT_A, OWNER_A, 4);
    const result = await kolOps.bulkAddKolsToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds
    );
    expect(result.added).toBe(4);
    expect(result.skipped).toBe(0);
    expect(result.notFound).toBe(0);
    expect(result.newSpendTotal).toBe(0); // null kolFee inserts → 0 spend

    const links = await getAdminPrisma().kolCampaign.findMany({
      where: { campaignId: w.campaignId },
      select: { kolId: true, status: true },
    });
    expect(new Set(links.map((l) => l.kolId))).toEqual(new Set(w.kolIds));
    expect(links.every((l) => l.status === "pending")).toBe(true);

    // logAudit() is fire-and-forget — poll until the writes flush.
    const deadline = Date.now() + 2000;
    let auditCount = 0;
    while (Date.now() < deadline) {
      auditCount = await getAdminPrisma().auditLog.count({
        where: {
          tenantId: w.tenantId,
          action: "kol.bulk_added_to_campaign",
        },
      });
      if (auditCount === 4) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(auditCount).toBe(4);
  });

  it("counts already-linked KOLs as `skipped` without erroring", async () => {
    const w = await seedTenant(TENANT_A, OWNER_A, 4);
    // Pre-link the first two so the second call sees them as existing.
    await kolOps.bulkAddKolsToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds.slice(0, 2)
    );
    const result = await kolOps.bulkAddKolsToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds
    );
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.notFound).toBe(0);
  });

  it("counts unknown KOL ids as `notFound` and adds the rest", async () => {
    const w = await seedTenant(TENANT_A, OWNER_A, 2);
    const fakeId = "99999999-0000-4000-8000-eeeeeeeeeeee";
    const result = await kolOps.bulkAddKolsToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      [...w.kolIds, fakeId]
    );
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.notFound).toBe(1);
  });

  it("rejects empty kolIds with a CampaignKolError", async () => {
    const w = await seedTenant(TENANT_A, OWNER_A, 1);
    await expect(
      kolOps.bulkAddKolsToCampaign(w.tenantId, w.ownerId, w.campaignId, [])
    ).rejects.toThrowError(/non-empty/);
  });

  it("rejects when the campaign belongs to another tenant (RLS)", async () => {
    const a = await seedTenant(TENANT_A, OWNER_A, 1);
    const b = await seedTenant(TENANT_B, OWNER_B, 1);
    // TENANT_B tries to add TENANT_A's campaign → should look up that
    // campaign through TENANT_B's withTenant context and miss it.
    await expect(
      kolOps.bulkAddKolsToCampaign(b.tenantId, b.ownerId, a.campaignId, b.kolIds)
    ).rejects.toThrowError(/not found/);
  });
});
