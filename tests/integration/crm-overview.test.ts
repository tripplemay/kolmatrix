/**
 * BM2-F007 · /crm overview integration spec.
 *
 * End-to-end behaviour of `runCrmOverview` + the
 * `updateKolRelationshipStatusHelper` mutation:
 *
 *   - stage distribution returns 6 ordered buckets even when some are
 *     empty
 *   - funnel conversion math reproduces aggregate.ts (sanity bridge)
 *   - cumulativeSpend sums KolCampaign.kolFee where status engaged
 *   - recentChanges pulls audit_log rows authored by the helper
 *   - ?status alias plumbing test (no DB) is covered in the unit
 *     suite — here we just confirm the audit_log → recentChanges
 *     pipeline lands cleanly
 *   - cross-tenant RLS doesn't leak counts or audit rows
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

type OverviewMod = typeof import("@/lib/crm/overview");
type UpdateMod = typeof import("@/lib/crm/update");

let overviewMod: OverviewMod;
let updateMod: UpdateMod;

const TENANT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TENANT_B = "bbbbbbbb-0000-4000-8000-000000000002";
const OWNER_A = "cccccccc-0000-4000-8000-000000000003";

beforeAll(async () => {
  await setupTestDb();
  overviewMod = await import("@/lib/crm/overview");
  updateMod = await import("@/lib/crm/update");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log"`);
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
});

async function seedTenant(
  tenantId: string,
  ownerId: string,
  kolStages: Array<{ status: string; count: number }>
) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Tenant ${tenantId.slice(0, 4)}`,
      slug: `crm-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: ownerId },
    create: {
      id: ownerId,
      tenantId,
      email: `owner-${tenantId.slice(0, 4)}@crm.test`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
    update: {},
  });
  const kolIds: string[] = [];
  let i = 0;
  for (const stage of kolStages) {
    for (let n = 0; n < stage.count; n += 1) {
      const k = await admin.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: `crm_${tenantId.slice(0, 4)}_${i}`,
          displayName: `Crm KOL ${i}`,
          relationshipStatus: stage.status,
        },
      });
      kolIds.push(k.id);
      i += 1;
    }
  }
  return { kolIds, ownerId };
}

describe("runCrmOverview", () => {
  it("returns 6 ordered buckets including zeros", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 3 },
      { status: "long_term", count: 2 },
    ]);
    const overview = await overviewMod.runCrmOverview(TENANT_A);
    expect(overview.stageDistribution).toHaveLength(6);
    expect(
      overview.stageDistribution.find((b) => b.status === "prospect")!
        .count
    ).toBe(3);
    expect(
      overview.stageDistribution.find((b) => b.status === "long_term")!
        .count
    ).toBe(2);
    expect(
      overview.stageDistribution.find((b) => b.status === "first_contact")!
        .count
    ).toBe(0);
  });

  it("computes funnel conversions", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 5 },
      { status: "first_contact", count: 3 },
      { status: "negotiating", count: 1 },
      { status: "long_term", count: 1 },
    ]);
    const overview = await overviewMod.runCrmOverview(TENANT_A);
    const steps = overview.funnelMetrics.steps;
    expect(steps[0]!.count).toBe(10); // total
    expect(steps[1]!.count).toBe(5); // first_contact + neg + lt
    expect(steps[2]!.count).toBe(2); // neg + lt
    expect(steps[3]!.count).toBe(1); // lt
    expect(steps[1]!.conversionPercent).toBeCloseTo(50, 1);
    expect(steps[2]!.conversionPercent).toBeCloseTo(40, 1);
    expect(steps[3]!.conversionPercent).toBeCloseTo(50, 1);
  });

  it("sums cumulativeSpend from KolCampaign rows in engaged statuses", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 2 },
    ]);
    const admin = getAdminPrisma();
    const campaign = await admin.campaign.create({
      data: {
        tenantId: TENANT_A,
        name: "Spend campaign",
        ownerUserId: OWNER_A,
        status: "active",
      },
    });
    await admin.kolCampaign.createMany({
      data: [
        {
          tenantId: TENANT_A,
          campaignId: campaign.id,
          kolId: kolIds[0]!,
          status: "signed",
          kolFee: "1000.00",
        },
        {
          tenantId: TENANT_A,
          campaignId: campaign.id,
          kolId: kolIds[1]!,
          status: "pending",
          kolFee: "500.00", // pending should NOT count
        },
      ],
    });
    const overview = await overviewMod.runCrmOverview(TENANT_A);
    expect(overview.collabKpi.cumulativeSpend).toBe(1000);
    expect(overview.collabKpi.totalPipeline).toBe(2);
  });

  it("includes spendSparkline (length 14) populated from audit_log when commitments occur", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "negotiating", count: 1 },
    ]);
    // Move the KOL to long_term — helper writes audit_log
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      kolIds[0]!,
      "long_term"
    );
    const overview = await overviewMod.runCrmOverview(TENANT_A);
    expect(overview.collabKpi.spendSparkline).toHaveLength(14);
    expect(
      overview.collabKpi.spendSparkline.reduce((a, b) => a + b, 0)
    ).toBeGreaterThanOrEqual(1);
  });

  it("populates recentChanges from helper-driven audit_log writes", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 2 },
    ]);
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      kolIds[0]!,
      "first_contact"
    );
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      kolIds[1]!,
      "negotiating"
    );
    const overview = await overviewMod.runCrmOverview(TENANT_A);
    expect(overview.recentChanges).toHaveLength(2);
    const names = overview.recentChanges.map((r) => r.after).sort();
    expect(names).toEqual(["first_contact", "negotiating"]);
    expect(overview.recentChanges[0]!.actorId).toBe(OWNER_A);
  });

  it("isolates audit_log + KOL counts across tenants", async () => {
    const a = await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 3 },
    ]);
    const b = await seedTenant(
      TENANT_B,
      "dddddddd-0000-4000-8000-000000000004",
      [{ status: "long_term", count: 5 }]
    );
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      a.kolIds[0]!,
      "first_contact"
    );
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_B,
      "dddddddd-0000-4000-8000-000000000004",
      b.kolIds[0]!,
      "negotiating"
    );

    const ovA = await overviewMod.runCrmOverview(TENANT_A);
    const ovB = await overviewMod.runCrmOverview(TENANT_B);

    expect(ovA.collabKpi.totalPipeline).toBe(3);
    expect(ovB.collabKpi.totalPipeline).toBe(5);

    expect(ovA.recentChanges).toHaveLength(1);
    expect(ovA.recentChanges[0]!.kolId).toBe(a.kolIds[0]);
    expect(ovB.recentChanges).toHaveLength(1);
    expect(ovB.recentChanges[0]!.kolId).toBe(b.kolIds[0]);
  });
});

describe("updateKolRelationshipStatusHelper", () => {
  it("rejects unknown status with invalid_status", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "prospect", count: 1 },
    ]);
    await expect(
      updateMod.updateKolRelationshipStatusHelper(
        TENANT_A,
        OWNER_A,
        kolIds[0]!,
        "ghost"
      )
    ).rejects.toMatchObject({ code: "invalid_status" });
  });

  it("returns the previous status alongside the new one", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "first_contact", count: 1 },
    ]);
    const result = await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      kolIds[0]!,
      "negotiating"
    );
    expect(result.before).toBe("first_contact");
    expect(result.relationshipStatus).toBe("negotiating");
  });

  it("does NOT write audit_log when the value did not change (no-op)", async () => {
    const { kolIds } = await seedTenant(TENANT_A, OWNER_A, [
      { status: "negotiating", count: 1 },
    ]);
    await updateMod.updateKolRelationshipStatusHelper(
      TENANT_A,
      OWNER_A,
      kolIds[0]!,
      "negotiating"
    );
    const audits = await getAdminPrisma().auditLog.findMany({
      where: { action: "kol.relationship_changed" },
    });
    expect(audits).toHaveLength(0);
  });
});
