/**
 * BM2-F008 · ROI loaders integration spec.
 *
 * Covers:
 *   - loadRoiSummary aggregates by tenant + status, returns
 *     totalSpend / totalRevenue / avgRoi / topCampaign / counts
 *   - loadRoiTrend buckets only `completed` campaigns by closedAt
 *   - loadRoiCampaigns returns only completed, sorted by ROI desc
 *   - cross-tenant RLS: tenant B cannot see tenant A's numbers
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

type QueriesMod = typeof import("@/lib/roi/queries");

let queries: QueriesMod;

const TENANT_A = "11111111-0000-4000-8000-aaaaaaaaaaaa";
const TENANT_B = "22222222-0000-4000-8000-bbbbbbbbbbbb";
const OWNER_A = "33333333-0000-4000-8000-cccccccccccc";
const OWNER_B = "44444444-0000-4000-8000-dddddddddddd";

beforeAll(async () => {
  await setupTestDb();
  queries = await import("@/lib/roi/queries");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

interface CampaignSeed {
  name: string;
  status: "draft" | "active" | "completed";
  spendTotal: number;
  revenueRecorded?: number | null;
  closedAt?: Date | null;
}

async function seedTenant(
  tenantId: string,
  ownerId: string,
  campaigns: CampaignSeed[]
) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Roi Tenant ${tenantId.slice(0, 4)}`,
      slug: `roi-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: ownerId },
    create: {
      id: ownerId,
      tenantId,
      email: `owner-${tenantId.slice(0, 4)}@roi.test`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
    update: {},
  });
  for (const c of campaigns) {
    await admin.campaign.create({
      data: {
        tenantId,
        name: c.name,
        ownerUserId: ownerId,
        status: c.status,
        spendTotal: c.spendTotal.toFixed(2),
        revenueRecorded:
          c.revenueRecorded == null
            ? null
            : c.revenueRecorded.toFixed(2),
        closedAt: c.closedAt ?? null,
      },
    });
  }
}

describe("loadRoiSummary", () => {
  it("aggregates totals and identifies the top completed campaign", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { name: "A", status: "completed", spendTotal: 100, revenueRecorded: 200 },
      { name: "B", status: "completed", spendTotal: 100, revenueRecorded: 250 },
      { name: "C", status: "active", spendTotal: 50, revenueRecorded: null },
      {
        name: "D",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: null,
      },
    ]);
    const summary = await queries.loadRoiSummary(TENANT_A);
    expect(summary.totalSpend).toBe(350);
    expect(summary.totalRevenue).toBe(450);
    expect(summary.campaignCount).toEqual({ active: 1, completed: 3 });
    expect(summary.avgRoiPercent).toBe(125); // (100 + 150) / 2
    expect(summary.topCampaign?.name).toBe("B");
  });

  it("returns null avgRoi + null topCampaign when no completed has revenue", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      {
        name: "Solo",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: null,
      },
    ]);
    const summary = await queries.loadRoiSummary(TENANT_A);
    expect(summary.avgRoiPercent).toBeNull();
    expect(summary.topCampaign).toBeNull();
  });

  it("isolates totals across tenants", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { name: "A1", status: "completed", spendTotal: 100, revenueRecorded: 150 },
    ]);
    await seedTenant(TENANT_B, OWNER_B, [
      {
        name: "B1",
        status: "completed",
        spendTotal: 1000,
        revenueRecorded: 5000,
      },
    ]);
    const a = await queries.loadRoiSummary(TENANT_A);
    const b = await queries.loadRoiSummary(TENANT_B);
    expect(a.totalSpend).toBe(100);
    expect(b.totalSpend).toBe(1000);
    expect(a.topCampaign?.name).toBe("A1");
    expect(b.topCampaign?.name).toBe("B1");
  });
});

describe("loadRoiTrend", () => {
  it("buckets completed campaigns by closedAt within the window", async () => {
    const NOW_MS = Date.parse("2026-04-24T15:30:00.000Z");
    await seedTenant(TENANT_A, OWNER_A, [
      {
        name: "Inside",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 200,
        closedAt: new Date("2026-04-22T08:00:00Z"),
      },
      {
        name: "Outside",
        status: "completed",
        spendTotal: 999,
        revenueRecorded: 999,
        closedAt: new Date("2026-03-01T00:00:00Z"),
      },
      {
        // Active campaigns are excluded even if revenue happens to be set.
        name: "ActiveSkip",
        status: "active",
        spendTotal: 50,
        revenueRecorded: 80,
        closedAt: null,
      },
    ]);
    const trend = await queries.loadRoiTrend(TENANT_A, 5, NOW_MS);
    expect(trend).toHaveLength(5);
    const day = trend.find((p) => p.date === "2026-04-22")!;
    expect(day.spendTotal).toBe(100);
    expect(day.revenue).toBe(200);
    expect(day.roiPercent).toBe(100);
    // Outside-window day stays empty.
    expect(trend.find((p) => p.date === "2026-04-21")?.spendTotal).toBe(0);
  });

  it("ignores closedAt-null rows to keep the trend honest", async () => {
    const NOW_MS = Date.parse("2026-04-24T15:30:00.000Z");
    await seedTenant(TENANT_A, OWNER_A, [
      {
        name: "Phantom",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 200,
        closedAt: null,
      },
    ]);
    const trend = await queries.loadRoiTrend(TENANT_A, 3, NOW_MS);
    expect(trend.every((p) => p.spendTotal === 0)).toBe(true);
  });
});

describe("loadRoiCampaigns", () => {
  it("returns only completed and sorts by ROI desc", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { name: "Low", status: "completed", spendTotal: 100, revenueRecorded: 110 },
      { name: "Mid", status: "completed", spendTotal: 100, revenueRecorded: 200 },
      { name: "High", status: "completed", spendTotal: 100, revenueRecorded: 500 },
      { name: "Active", status: "active", spendTotal: 100, revenueRecorded: 9999 },
      { name: "NullRevenue", status: "completed", spendTotal: 50, revenueRecorded: null },
    ]);
    const out = await queries.loadRoiCampaigns(TENANT_A);
    expect(out.map((r) => r.name)).toEqual([
      "High",
      "Mid",
      "Low",
      "NullRevenue", // null roi sorts last
    ]);
    expect(out.find((r) => r.name === "High")!.roiPercent).toBe(400);
    expect(out.find((r) => r.name === "NullRevenue")!.roiPercent).toBeNull();
  });

  it("isolates rows across tenants", async () => {
    await seedTenant(TENANT_A, OWNER_A, [
      { name: "A", status: "completed", spendTotal: 100, revenueRecorded: 200 },
    ]);
    await seedTenant(TENANT_B, OWNER_B, [
      { name: "B", status: "completed", spendTotal: 100, revenueRecorded: 200 },
    ]);
    const a = await queries.loadRoiCampaigns(TENANT_A);
    const b = await queries.loadRoiCampaigns(TENANT_B);
    expect(a.map((r) => r.name)).toEqual(["A"]);
    expect(b.map((r) => r.name)).toEqual(["B"]);
  });
});
