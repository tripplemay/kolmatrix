/**
 * BM2-F005 · Campaign detail / KolCampaign CRUD integration spec
 *
 * Covers the shared helpers (`runCampaignDetail` / `addKolToCampaign` /
 * `removeKolFromCampaign` / `updateKolCampaign` /
 * `transitionCampaignStatus` / `recordCampaignRevenue`) that back
 * both the Server Actions and the REST routes. `runAvailableKolsFor-
 * Campaign` was retired in BL-066-F006 alongside the manual add-to-
 * campaign path.
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

type Detail = typeof import("@/lib/campaigns/detail");
type KolOps = typeof import("@/lib/campaigns/kol-operations");
type Update = typeof import("@/lib/campaigns/update");

let mod: { detail: Detail; kolOps: KolOps; update: Update };

const TENANT_A = "11111111-0000-4000-8000-000000000001";
const TENANT_B = "22222222-0000-4000-8000-000000000002";
const OWNER_A = "33333333-0000-4000-8000-000000000003";
const OWNER_B = "44444444-0000-4000-8000-000000000004";

beforeAll(async () => {
  await setupTestDb();
  mod = {
    detail: await import("@/lib/campaigns/detail"),
    kolOps: await import("@/lib/campaigns/kol-operations"),
    update: await import("@/lib/campaigns/update"),
  };
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log"`);
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
});

interface SeededWorld {
  tenantId: string;
  ownerId: string;
  productId: string;
  campaignId: string;
  kolIds: string[];
}

async function seedWorld(
  tenantId: string,
  ownerId: string,
  kolCount = 3,
  opts: { status?: string; savedCount?: number } = {}
): Promise<SeededWorld> {
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
      name: "Campaign One",
      ownerUserId: ownerId,
      productId: product.id,
      status: opts.status ?? "draft",
      spendTotal: "0",
    },
  });
  // BL-063 F002: isSaved column dropped. The savedCount option is now
  // a no-op; callers can leave it unset. The seedWorld signature stays
  // for backwards compat with the existing test bodies.
  void opts.savedCount;
  const kolIds: string[] = [];
  for (let i = 0; i < kolCount; i += 1) {
    const k = await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: `seed_${tenantId.slice(0, 4)}_${i}`,
        displayName: `Seed ${i}`,
        followerCount: 1_000 * (i + 1),
        email: i % 2 === 0 ? `kol${i}@example.test` : null,
      },
    });
    kolIds.push(k.id);
  }
  return {
    tenantId,
    ownerId,
    productId: product.id,
    campaignId: campaign.id,
    kolIds,
  };
}

describe("runCampaignDetail", () => {
  it("returns the campaign with product + kolCampaigns", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 2);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
      kolFee: 500,
    });
    const detail = await mod.detail.runCampaignDetail(w.tenantId, w.campaignId);
    expect(detail).not.toBeNull();
    expect(detail!.product?.name).toBe("Launch Game");
    expect(detail!.kols).toHaveLength(1);
    expect(detail!.kols[0]!.kolFee).toBe(500);
    expect(detail!.spendTotal).toBe(500);
    expect(detail!.kols[0]!.hasEmail).toBe(true);
  });

  it("returns null for a campaign outside the tenant (RLS)", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await seedWorld(TENANT_B, OWNER_B, 1);
    const asB = await mod.detail.runCampaignDetail(TENANT_B, w.campaignId);
    expect(asB).toBeNull();
  });
});

describe("addKolToCampaign + spendTotal recompute", () => {
  it("adds a KOL with status=pending and refreshes spendTotal", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 2);
    const r = await mod.kolOps.addKolToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      { kolId: w.kolIds[0]!, kolFee: 250 }
    );
    expect(r.newSpendTotal).toBe(250);

    const fresh = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(Number(fresh.spendTotal.toString())).toBe(250);

    const link = await getAdminPrisma().kolCampaign.findFirstOrThrow({
      where: { campaignId: w.campaignId },
    });
    expect(link.status).toBe("pending");
  });

  it("accumulates multiple KOLs and reports combined spendTotal", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 3);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
      kolFee: 100.5,
    });
    const r2 = await mod.kolOps.addKolToCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      { kolId: w.kolIds[1]!, kolFee: 200 }
    );
    expect(r2.newSpendTotal).toBe(300.5);
  });

  it("rejects duplicate add with already_linked", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
    });
    await expect(
      mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
        kolId: w.kolIds[0]!,
      })
    ).rejects.toMatchObject({ code: "already_linked" });
  });

  it("rejects unknown kolId with kol_not_found", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await expect(
      mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
        kolId: "11111111-0000-4000-8000-ffffffffffff",
      })
    ).rejects.toMatchObject({ code: "kol_not_found" });
  });
});

describe("updateKolCampaign · status + fee + audit_log", () => {
  it("updates contactStatus and writes campaign.kol.status_changed audit", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
    });
    await mod.kolOps.updateKolCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds[0]!,
      { contactStatus: "contacted" }
    );
    // Poll audit_log — logAudit is fire-and-forget.
    const deadline = Date.now() + 2000;
    let audits: Array<{ action: string; payload: unknown }> = [];
    while (Date.now() < deadline) {
      audits = (await getAdminPrisma().auditLog.findMany({
        where: { action: "campaign.kol.status_changed" },
        select: { action: true, payload: true },
      })) as typeof audits;
      if (audits.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(audits).toHaveLength(1);
  });

  it("updates kolFee, recomputes spendTotal, and writes campaign.kol.fee_updated audit", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 2);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
      kolFee: 100,
    });
    const r = await mod.kolOps.updateKolCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds[0]!,
      { kolFee: 250 }
    );
    expect(r.newSpendTotal).toBe(250);
    const fresh = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(Number(fresh.spendTotal.toString())).toBe(250);
  });

  it("rejects invalid contactStatus", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
    });
    await expect(
      mod.kolOps.updateKolCampaign(
        w.tenantId,
        w.ownerId,
        w.campaignId,
        w.kolIds[0]!,
        { contactStatus: "bogus" }
      )
    ).rejects.toMatchObject({ code: "invalid_status" });
  });

  it("rejects negative kolFee", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
    });
    await expect(
      mod.kolOps.updateKolCampaign(
        w.tenantId,
        w.ownerId,
        w.campaignId,
        w.kolIds[0]!,
        { kolFee: -5 }
      )
    ).rejects.toMatchObject({ code: "invalid_fee" });
  });
});

describe("removeKolFromCampaign", () => {
  it("removes a link and refreshes spendTotal downward", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 2);
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[0]!,
      kolFee: 100,
    });
    await mod.kolOps.addKolToCampaign(w.tenantId, w.ownerId, w.campaignId, {
      kolId: w.kolIds[1]!,
      kolFee: 50,
    });
    const r = await mod.kolOps.removeKolFromCampaign(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      w.kolIds[0]!
    );
    expect(r.newSpendTotal).toBe(50);
  });

  it("rejects with link_not_found when the KOL isn't in the campaign", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 1);
    await expect(
      mod.kolOps.removeKolFromCampaign(
        w.tenantId,
        w.ownerId,
        w.campaignId,
        w.kolIds[0]!
      )
    ).rejects.toMatchObject({ code: "link_not_found" });
  });
});

describe("transitionCampaignStatus", () => {
  it("draft → active sets startedAt", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0);
    await mod.update.transitionCampaignStatus(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      "active"
    );
    const c = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(c.status).toBe("active");
    expect(c.startedAt).not.toBeNull();
  });

  it("active → completed sets closedAt", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0, { status: "active" });
    await mod.update.transitionCampaignStatus(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      "completed"
    );
    const c = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(c.status).toBe("completed");
    expect(c.closedAt).not.toBeNull();
  });

  it("completed → active (Reactivate) clears closedAt", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0, { status: "active" });
    await mod.update.transitionCampaignStatus(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      "completed"
    );
    await mod.update.transitionCampaignStatus(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      "active"
    );
    const c = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(c.status).toBe("active");
    expect(c.closedAt).toBeNull();
  });

  it("rejects draft → completed", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0);
    await expect(
      mod.update.transitionCampaignStatus(
        w.tenantId,
        w.ownerId,
        w.campaignId,
        "completed"
      )
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });
});

describe("recordCampaignRevenue", () => {
  it("stores revenue while status != completed", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0, { status: "active" });
    await mod.update.recordCampaignRevenue(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      12500
    );
    const c = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(Number(c.revenueRecorded!.toString())).toBe(12500);
  });

  it("rejects revenue edits while status=completed", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0, { status: "active" });
    await mod.update.transitionCampaignStatus(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      "completed"
    );
    await expect(
      mod.update.recordCampaignRevenue(
        w.tenantId,
        w.ownerId,
        w.campaignId,
        500
      )
    ).rejects.toMatchObject({ code: "forbidden_when_completed" });
  });

  it("clears revenue when called with null", async () => {
    const w = await seedWorld(TENANT_A, OWNER_A, 0, { status: "active" });
    await mod.update.recordCampaignRevenue(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      500
    );
    await mod.update.recordCampaignRevenue(
      w.tenantId,
      w.ownerId,
      w.campaignId,
      null
    );
    const c = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: w.campaignId },
    });
    expect(c.revenueRecorded).toBeNull();
  });
});
