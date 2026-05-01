/**
 * BIx-mvp-polish-pass F001 — `/crm` time-toggle.
 *
 * Locks two contracts:
 *   1. `rangeStart()` returns the right cutoff Date for each range
 *      (pure helper; tests injected `now`).
 *   2. `runCrmOverview` actually narrows its 4 panels by the cutoff:
 *        thisQuarter / last90d / allTime each return KOL counts that
 *        match what we wrote inside / outside the window.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

// Defer this import until after `setupTestDb()` boots the test
// container — otherwise lib/crm/overview.ts pulls in @/lib/db's
// prisma client and pins it to localhost:5432 (the CI runner has no
// postgres there). Same pattern as tests/integration/crm-overview.test.ts.
type OverviewMod = typeof import("@/lib/crm/overview");
let overviewMod: OverviewMod;

let tenantCounter = 0;

async function freshTenant(): Promise<string> {
  const admin = getAdminPrisma();
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `CRM Test ${suffix}`, slug: `crm-test-${suffix}` },
  });
  return tenant.id;
}

beforeAll(async () => {
  await setupTestDb();
  overviewMod = await import("@/lib/crm/overview");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("rangeStart() (BIx-vf F001)", () => {
  const NOW = new Date("2026-05-15T12:00:00Z");

  it("allTime returns null", () => {
    expect(overviewMod.rangeStart("allTime", NOW)).toBeNull();
  });

  it("last90d returns 90 days before now", () => {
    const out = overviewMod.rangeStart("last90d", NOW);
    expect(out).not.toBeNull();
    const diffMs = NOW.getTime() - out!.getTime();
    expect(diffMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("thisQuarter returns the start of the calendar quarter (UTC)", () => {
    // May → Q2 starts on 2026-04-01 UTC
    expect(overviewMod.rangeStart("thisQuarter", NOW)?.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z"
    );
  });

  it("isCrmRange accepts only the 3 valid values", () => {
    expect(overviewMod.isCrmRange("allTime")).toBe(true);
    expect(overviewMod.isCrmRange("last90d")).toBe(true);
    expect(overviewMod.isCrmRange("thisQuarter")).toBe(true);
    expect(overviewMod.isCrmRange("today")).toBe(false);
    expect(overviewMod.isCrmRange(null)).toBe(false);
    expect(overviewMod.isCrmRange(undefined)).toBe(false);
  });

  it("DEFAULT_CRM_RANGE is last90d", () => {
    expect(overviewMod.DEFAULT_CRM_RANGE).toBe("last90d");
  });
});

describe("runCrmOverview range filtering (BIx-vf F001)", () => {
  it("allTime returns every KOL; last90d narrows to recent ones", async () => {
    const admin = getAdminPrisma();
    const tenantId = await freshTenant();

    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1y ago
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    // 1 KOL outside the 90d window, 2 inside.
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "old1",
        displayName: "Old 1",
        followerCount: 100,
        relationshipStatus: "prospect",
        createdAt: oldDate,
      },
    });
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "new1",
        displayName: "New 1",
        followerCount: 200,
        relationshipStatus: "prospect",
        createdAt: recentDate,
      },
    });
    await admin.kol.create({
      data: {
        tenantId,
        platform: "twitch",
        handle: "new2",
        displayName: "New 2",
        followerCount: 300,
        relationshipStatus: "first_contact",
        createdAt: recentDate,
      },
    });

    const all = await overviewMod.runCrmOverview(tenantId, { range: "allTime" });
    const allTotal = all.stageDistribution.reduce((acc, b) => acc + b.count, 0);
    expect(allTotal).toBe(3);

    const last90 = await overviewMod.runCrmOverview(tenantId, { range: "last90d" });
    const last90Total = last90.stageDistribution.reduce((acc, b) => acc + b.count, 0);
    expect(last90Total).toBe(2);
  });

  it("default option (no range) behaves like last90d", async () => {
    const admin = getAdminPrisma();
    const tenantId = await freshTenant();
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "fresh",
        displayName: "Fresh",
        followerCount: 100,
        relationshipStatus: "prospect",
        createdAt: new Date(),
      },
    });

    const noOpt = await overviewMod.runCrmOverview(tenantId);
    const last90 = await overviewMod.runCrmOverview(tenantId, { range: "last90d" });
    expect(noOpt.collabKpi.totalPipeline).toBe(last90.collabKpi.totalPipeline);
  });
});
