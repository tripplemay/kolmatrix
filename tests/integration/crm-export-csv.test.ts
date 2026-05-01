/**
 * BIx-mvp-polish-pass F001 — `/api/crm/export-csv`.
 *
 * Mocks `@/auth` and exercises the GET handler against a real DB so
 * the assertions cover RFC-4180 quoting + Content-Disposition +
 * range filtering as a single integration unit.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

let tenantCounter = 0;

async function freshTenant(): Promise<{ id: string; slug: string }> {
  const admin = getAdminPrisma();
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `CSV Test ${suffix}`, slug: `csv-test-${suffix}` },
  });
  return { id: tenant.id, slug: tenant.slug };
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  authMock.mockReset();
});

describe("/api/crm/export-csv (BIx-vf F001)", () => {
  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("@/app/api/crm/export-csv/route");
    const res = await GET(new Request("http://test.local/api/crm/export-csv"));
    expect(res.status).toBe(401);
  });

  it("returns CSV with header row + Content-Disposition + roster", async () => {
    const admin = getAdminPrisma();
    const tenant = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenant.id, id: tenant.id } });

    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "alpha",
        displayName: "Alpha Streams",
        followerCount: 1000,
        relationshipStatus: "contacted",
        countryCode: "US",
      },
    });
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "beta",
        // Display name with a comma — must be quoted in the CSV.
        displayName: 'Beta, "the Wave"',
        followerCount: 2500,
        relationshipStatus: "prospect",
        countryCode: "JP",
      },
    });

    const { GET } = await import("@/app/api/crm/export-csv/route");
    const res = await GET(
      new Request(`http://test.local/api/crm/export-csv?range=allTime`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="crm-csv_test_/);
    expect(disposition).toMatch(/\.csv"$/);

    const body = await res.text();
    const lines = body.split("\n").filter(Boolean);
    expect(lines[0]).toBe(
      "kol_id,handle,display_name,platform,country_code,follower_count,relationship_status,campaign_count,total_spend_usd,created_at"
    );
    expect(lines).toHaveLength(3); // header + 2 data rows

    // The display name with comma+quote must be RFC-4180 quoted.
    const betaRow = lines.find((l) => l.includes("beta,"));
    expect(betaRow).toBeDefined();
    expect(betaRow!).toContain('"Beta, ""the Wave"""');
  });

  it("falls back to last90d when the range query param is unknown", async () => {
    const admin = getAdminPrisma();
    const tenant = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenant.id, id: tenant.id } });

    // 1 KOL inside last90d window, 1 outside (1 year ago).
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "fresh",
        displayName: "Fresh",
        followerCount: 100,
        relationshipStatus: "prospect",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "stale",
        displayName: "Stale",
        followerCount: 200,
        relationshipStatus: "prospect",
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      },
    });

    const { GET } = await import("@/app/api/crm/export-csv/route");
    const res = await GET(
      new Request("http://test.local/api/crm/export-csv?range=garbage")
    );
    const body = await res.text();
    const lines = body.split("\n").filter(Boolean);
    // Only the fresh KOL should be in the CSV (last90d default after
    // the unknown value falls through to DEFAULT_CRM_RANGE).
    expect(lines).toHaveLength(2);
    expect(body).toContain("fresh");
    expect(body).not.toContain("stale");
  });
});
