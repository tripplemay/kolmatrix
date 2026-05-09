/**
 * BL-052 F003 · KPI snapshot integration spec.
 *
 * Drives `takeKpiSnapshot` against a real Postgres container and
 * verifies:
 *   1. fresh tenant → 5 KPI columns persisted with the values computed
 *      from the seeded fixtures (kolCount, activeCampaigns,
 *      emailsSent7d, productCount, avgValueScore)
 *   2. same-day re-run is idempotent (upsert by composite PK; second
 *      call updates without inserting a new row)
 *   3. RLS isolation: tenant A's snapshot is invisible to tenant B
 *
 * Fixture choice mirrors how fetchDashboardData (data.ts) computes the
 * scalars so the snapshot has obvious "ground truth" values.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { takeKpiSnapshot } from "@/lib/dashboard/kpi-snapshot";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
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

async function seedTenant(slug: string) {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: { name: `KPI Test ${slug}`, slug: `kpi-${slug}-${Date.now()}` },
  });
  return tenant.id;
}

async function seedFixtures(
  tenantId: string,
  opts: {
    kolCount: number;
    activeCampaigns: number;
    productCount: number;
    emailsSent7d: number;
    valueScores: number[]; // average is computed from these
  }
) {
  const admin = getAdminPrisma();
  // Round-trip user for FK on EmailLog.userId / Campaign.ownerId.
  const owner = await admin.user.create({
    data: {
      tenantId,
      email: `owner-${tenantId.slice(0, 8)}@example.test`,
      name: "Owner",
      role: "marketer",
    },
  });

  // KOLs: half gaming with valueScore (counted), half non-gaming
  // (excluded from kolCount + avgValueScore).
  for (let i = 0; i < opts.kolCount; i++) {
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: `kol-gaming-${tenantId.slice(0, 4)}-${i}`,
        displayName: `Gaming KOL ${i}`,
        followerCount: 1000 * (i + 1),
        isGaming: true,
        valueScore: opts.valueScores[i] ?? 60,
      },
    });
  }
  // Add one non-gaming KOL to confirm the isGaming filter.
  await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `kol-non-gaming-${tenantId.slice(0, 4)}`,
      displayName: "Non-Gaming KOL",
      followerCount: 100,
      isGaming: false,
      valueScore: 5, // would skew avg if filter ignored
    },
  });

  for (let i = 0; i < opts.activeCampaigns; i++) {
    await admin.campaign.create({
      data: {
        tenantId,
        name: `Campaign ${i}`,
        ownerUserId: owner.id,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86_400_000),
      },
    });
  }
  // One closed campaign — must NOT count towards activeCampaigns.
  await admin.campaign.create({
    data: {
      tenantId,
      name: "Closed",
      ownerUserId: owner.id,
      status: "completed",
      startDate: new Date(),
      endDate: new Date(),
    },
  });

  for (let i = 0; i < opts.productCount; i++) {
    await admin.product.create({
      data: {
        tenantId,
        name: `Product ${i}`,
        category: "mobile",
        targetAudience: "test audience",
        uniqueSellingPoints: "test usp",
      },
    });
  }

  const now = Date.now();
  for (let i = 0; i < opts.emailsSent7d; i++) {
    await admin.emailLog.create({
      data: {
        tenantId,
        subject: `Recent ${i}`,
        bodyHtml: "<p>x</p>",
        toAddress: `to-${i}@example.test`,
        fromAddress: "marketer@kolquest.com",
        status: "sent",
        sentAt: new Date(now - i * 3_600_000), // last few hours
      },
    });
  }
  // One stale email, 30 days back — must NOT count towards emailsSent7d.
  await admin.emailLog.create({
    data: {
      tenantId,
      subject: "Stale",
      bodyHtml: "<p>x</p>",
      toAddress: "stale@example.test",
      fromAddress: "marketer@kolquest.com",
      status: "sent",
      sentAt: new Date(now - 30 * 86_400_000),
    },
  });

  return { ownerId: owner.id };
}

describe("takeKpiSnapshot", () => {
  it("persists the 5 KPI scalars with values matching fixtures", async () => {
    const tenantId = await seedTenant("a");
    await seedFixtures(tenantId, {
      kolCount: 3,
      activeCampaigns: 2,
      productCount: 4,
      emailsSent7d: 5,
      valueScores: [80, 60, 40], // avg = 60
    });

    const record = await takeKpiSnapshot(getAppPrisma(), tenantId);

    expect(record.kolCount).toBe(3);
    expect(record.activeCampaigns).toBe(2);
    expect(record.productCount).toBe(4);
    expect(record.emailsSent7d).toBe(5);
    expect(record.avgValueScore).toBe(60);
    expect(record.tenantId).toBe(tenantId);

    // Direct DB readback confirms the row materialised at the
    // composite PK.
    const dbRow = await getAdminPrisma().kpiDailySnapshot.findFirst({
      where: { tenantId },
    });
    expect(dbRow).not.toBeNull();
    expect(dbRow!.kolCount).toBe(3);
    expect(Number(dbRow!.avgValueScore.toString())).toBe(60);
  });

  it("is idempotent on same-day re-runs (upsert, no duplicate row)", async () => {
    const tenantId = await seedTenant("b");
    await seedFixtures(tenantId, {
      kolCount: 1,
      activeCampaigns: 0,
      productCount: 1,
      emailsSent7d: 0,
      valueScores: [50],
    });

    const fixedDate = new Date("2026-05-07T03:00:00Z");
    await takeKpiSnapshot(getAppPrisma(), tenantId, fixedDate);

    // Add one more product before the second snapshot — re-run should
    // overwrite the row in place (productCount goes 1 → 2), not insert
    // a sibling row for the same date.
    await getAdminPrisma().product.create({
      data: {
        tenantId,
        name: "Extra Product",
        category: "mobile",
        targetAudience: "test audience",
        uniqueSellingPoints: "test usp",
      },
    });

    const second = await takeKpiSnapshot(getAppPrisma(), tenantId, fixedDate);
    expect(second.productCount).toBe(2);

    const allRows = await getAdminPrisma().kpiDailySnapshot.findMany({
      where: { tenantId },
    });
    expect(allRows).toHaveLength(1);
    expect(allRows[0].productCount).toBe(2);
  });

  // BL-060 F003 — guard against the same leak fixed in fetchDashboardData:
  // tombstoned KOLs must not inflate the daily snapshot's kolCount or
  // skew avgValueScore. The cron writes one row per tenant per UTC day,
  // and any leak compounds into the dashboard trend chart.
  it("excludes soft-deleted KOLs from kolCount and avgValueScore", async () => {
    const tenantId = await seedTenant("soft-delete");
    await seedFixtures(tenantId, {
      kolCount: 2,
      activeCampaigns: 0,
      productCount: 0,
      emailsSent7d: 0,
      valueScores: [80, 60], // active mean = 70
    });

    const admin = getAdminPrisma();
    // 2 tombstoned gaming KOLs with score=10 — would drag avgValueScore
    // to 40 and bump kolCount to 4 if the soft-delete filter were missing.
    for (let i = 0; i < 2; i++) {
      await admin.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: `tomb-${tenantId.slice(0, 4)}-${i}`,
          displayName: `Tomb ${i}`,
          followerCount: 100,
          isGaming: true,
          valueScore: 10,
          deletedAt: new Date(),
        },
      });
    }

    const record = await takeKpiSnapshot(getAppPrisma(), tenantId);
    expect(record.kolCount).toBe(2);
    expect(record.avgValueScore).toBe(70);
  });

  it("isolates snapshots across tenants under RLS (app role can only see its own)", async () => {
    const tenantA = await seedTenant("rls-a");
    const tenantB = await seedTenant("rls-b");
    await seedFixtures(tenantA, {
      kolCount: 1,
      activeCampaigns: 0,
      productCount: 0,
      emailsSent7d: 0,
      valueScores: [70],
    });
    await seedFixtures(tenantB, {
      kolCount: 2,
      activeCampaigns: 0,
      productCount: 0,
      emailsSent7d: 0,
      valueScores: [40, 60],
    });

    await takeKpiSnapshot(getAppPrisma(), tenantA);
    await takeKpiSnapshot(getAppPrisma(), tenantB);

    // From tenant A's RLS context, only A's row is visible.
    const visibleFromA = await asTenant(tenantA, (tx) =>
      tx.kpiDailySnapshot.findMany({})
    );
    expect(visibleFromA).toHaveLength(1);
    expect(visibleFromA[0].tenantId).toBe(tenantA);
    expect(visibleFromA[0].kolCount).toBe(1);

    // From tenant B's RLS context, only B's row is visible.
    const visibleFromB = await asTenant(tenantB, (tx) =>
      tx.kpiDailySnapshot.findMany({})
    );
    expect(visibleFromB).toHaveLength(1);
    expect(visibleFromB[0].tenantId).toBe(tenantB);
    expect(visibleFromB[0].kolCount).toBe(2);
  });
});
