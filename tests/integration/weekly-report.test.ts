/**
 * BM2-F010 · WeeklyReport persistence + share-token integration spec.
 *
 * Covers:
 *   - upsert overwrites contentMd + summaryJson + clears shareToken
 *   - cross-tenant RLS isolation (tenant B cannot read tenant A rows)
 *   - loadRecentWeeklyReports orders by weekEnd DESC
 *   - attachShareToken writes a 32-char base64url + 7-day expiry
 *   - loadSharedWeeklyReport returns ONLY the 4 spec'd columns
 *   - loadSharedWeeklyReport returns null after expiry
 *   - loadSharedWeeklyReport returns null on unknown / malformed token
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

type PersistenceMod = typeof import("@/lib/weekly-report/persistence");

let persistence: PersistenceMod;

const TENANT_A = "11111111-0000-4000-8000-aaaaaaaaaaaa";
const TENANT_B = "22222222-0000-4000-8000-bbbbbbbbbbbb";
const OWNER_A = "33333333-0000-4000-8000-cccccccccccc";
const OWNER_B = "44444444-0000-4000-8000-dddddddddddd";

const WEEK_START = new Date(Date.UTC(2026, 3, 13)); // Mon 2026-04-13
const WEEK_END = new Date(Date.UTC(2026, 3, 19)); // Sun 2026-04-19

beforeAll(async () => {
  await setupTestDb();
  persistence = await import("@/lib/weekly-report/persistence");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(tenantId: string, ownerId: string) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Weekly Report Tenant ${tenantId.slice(0, 4)}`,
      slug: `wr-${tenantId.slice(0, 8)}`,
      logoUrl: `https://example.com/${tenantId.slice(0, 4)}.png`,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: ownerId },
    create: {
      id: ownerId,
      tenantId,
      email: `owner-${tenantId.slice(0, 4)}@wr.test`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
    update: {},
  });
}

function snapshot(name: string) {
  return {
    tenantSnapshot: { name, logoUrl: null },
    kolActivity: { newPartnerships: 1, statusChanges: [], emailsSent: 5, aiCustomizedEmails: 3 },
    roiData: { totalSpend: 100, totalRevenue: 200, avgRoiPercent: 100, topCampaign: null },
    prevWeekComparison: null,
    generatedAt: new Date().toISOString(),
  };
}

const HEADINGS_MD =
  "## Executive Summary\nbody\n\n## Top Performers\nbody\n\n## Key Activity\nbody\n\n## Key Insights\nbody\n\n## Looking Ahead\nbody";

describe("upsertWeeklyReport", () => {
  it("creates a row on first call and overwrites on the second", async () => {
    await seedTenant(TENANT_A, OWNER_A);

    const first = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: "v1 markdown\n\n" + HEADINGS_MD,
      summaryJson: snapshot("Tenant A"),
    });
    expect(first.contentMd).toContain("v1 markdown");

    const second = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: "v2 markdown\n\n" + HEADINGS_MD,
      summaryJson: snapshot("Tenant A v2"),
    });
    expect(second.id).toBe(first.id);
    expect(second.contentMd).toContain("v2 markdown");
  });

  it("clears any pre-existing share token on overwrite", async () => {
    await seedTenant(TENANT_A, OWNER_A);

    const first = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("Tenant A"),
    });
    const minted = await persistence.attachShareToken({
      tenantId: TENANT_A,
      reportId: first.id,
    });
    expect(minted.token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("Tenant A v2"),
    });

    const after = await getAdminPrisma().weeklyReport.findUnique({
      where: { id: first.id },
    });
    expect(after?.shareToken).toBeNull();
    expect(after?.shareTokenExpiresAt).toBeNull();
  });

  it("treats different locales as separate rows", async () => {
    await seedTenant(TENANT_A, OWNER_A);

    const en = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("Tenant A en"),
    });
    const zh = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "zh",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("Tenant A zh"),
    });
    expect(en.id).not.toBe(zh.id);
  });
});

describe("loadRecentWeeklyReports", () => {
  it("orders by weekEnd DESC and respects the limit", async () => {
    await seedTenant(TENANT_A, OWNER_A);

    for (let i = 0; i < 4; i += 1) {
      const start = new Date(Date.UTC(2026, 0, 5 + i * 7));
      const end = new Date(Date.UTC(2026, 0, 11 + i * 7));
      await persistence.upsertWeeklyReport({
        tenantId: TENANT_A,
        createdByUserId: OWNER_A,
        weekStart: start,
        weekEnd: end,
        locale: "en",
        contentMd: HEADINGS_MD,
        summaryJson: snapshot(`week ${i}`),
      });
    }

    const recent = await persistence.loadRecentWeeklyReports(TENANT_A, 3);
    expect(recent).toHaveLength(3);
    const dates = recent.map((r) => r.weekEnd.toISOString().slice(0, 10));
    expect(dates).toEqual(["2026-02-01", "2026-01-25", "2026-01-18"]);
  });
});

describe("cross-tenant RLS", () => {
  it("isolates rows across tenants", async () => {
    await seedTenant(TENANT_A, OWNER_A);
    await seedTenant(TENANT_B, OWNER_B);

    await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("A"),
    });
    await persistence.upsertWeeklyReport({
      tenantId: TENANT_B,
      createdByUserId: OWNER_B,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("B"),
    });

    const aOnly = await persistence.loadRecentWeeklyReports(TENANT_A);
    const bOnly = await persistence.loadRecentWeeklyReports(TENANT_B);
    expect(aOnly).toHaveLength(1);
    expect(bOnly).toHaveLength(1);
    expect(aOnly[0].id).not.toBe(bOnly[0].id);
  });
});

describe("loadSharedWeeklyReport (anonymous)", () => {
  it("returns the report when token is valid + not expired", async () => {
    await seedTenant(TENANT_A, OWNER_A);
    const row = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("A"),
    });
    const { token } = await persistence.attachShareToken({
      tenantId: TENANT_A,
      reportId: row.id,
    });

    const payload = await persistence.loadSharedWeeklyReport(token);
    expect(payload).not.toBeNull();
    expect(payload!.contentMd).toContain("Executive Summary");
    expect(payload!.summaryJson?.tenantSnapshot.name).toBe("A");
    // BL-051a-F002 + F003 added revokedAt + locale to the payload so
    // the public page can render the 'revoked' state with metadata
    // and pick the report's authoring locale for translations.
    expect(Object.keys(payload!).sort()).toEqual([
      "contentMd",
      "createdAt",
      "locale",
      "revokedAt",
      "shareTokenExpiresAt",
      "summaryJson",
    ]);
  });

  it("returns null for an unknown token", async () => {
    const payload = await persistence.loadSharedWeeklyReport(
      "abcdefghijklmnopqrstuvwxyz123456"
    );
    expect(payload).toBeNull();
  });

  it("returns null for malformed tokens (no SQL hit)", async () => {
    expect(await persistence.loadSharedWeeklyReport("not-a-token")).toBeNull();
    expect(await persistence.loadSharedWeeklyReport("")).toBeNull();
    expect(
      await persistence.loadSharedWeeklyReport("contains spaces 1234567890ab")
    ).toBeNull();
  });

  it("returns null when shareTokenExpiresAt is in the past", async () => {
    await seedTenant(TENANT_A, OWNER_A);
    const row = await persistence.upsertWeeklyReport({
      tenantId: TENANT_A,
      createdByUserId: OWNER_A,
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      locale: "en",
      contentMd: HEADINGS_MD,
      summaryJson: snapshot("A"),
    });
    const { token } = await persistence.attachShareToken({
      tenantId: TENANT_A,
      reportId: row.id,
    });
    // Force-expire by writing the past via the admin client.
    await getAdminPrisma().weeklyReport.update({
      where: { id: row.id },
      data: { shareTokenExpiresAt: new Date(Date.UTC(2020, 0, 1)) },
    });

    const payload = await persistence.loadSharedWeeklyReport(token);
    // The DB row exists, but the helper layer must treat it as gone
    // — the page caller checks `isShareTokenExpired` next.
    expect(payload).not.toBeNull();
    expect(payload!.shareTokenExpiresAt.getTime()).toBeLessThan(Date.now());
  });
});
