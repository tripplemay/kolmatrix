/**
 * BIx-mvp-polish-pass F002 P1-3 — Campaigns Owner filter integration spec.
 *
 * Locks two contracts:
 *   1. `loadCampaignOwners` returns an empty list when the tenant has
 *      ≤ 1 user (so the UI hides the filter for solo tenants).
 *   2. `loadCampaignOwners` returns distinct owners with usable display
 *      names when there are 2+ users with campaigns.
 *   3. The campaign list `where` clause filters by ownerUserId when
 *      `filters.ownerIds` is non-empty.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

let tenantCounter = 0;

async function freshTenant(): Promise<string> {
  const admin = getAdminPrisma();
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `Test Tenant ${suffix}`, slug: `test-${suffix}` },
  });
  return tenant.id;
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

// We commit fixtures via `getAdminPrisma()` rather than inside a
// `withTestTenant` block because `loadCampaignOwners` opens its own
// `withTenant` transaction and (per Postgres MVCC) wouldn't see
// uncommitted writes from a sibling tx.
describe("loadCampaignOwners (MVP-vf F002 P1-3)", () => {
  it("returns [] when tenant has only one user", async () => {
    const { loadCampaignOwners } = await import("@/lib/campaigns/list-kpis");
    const admin = getAdminPrisma();
    const tenantId = await freshTenant();
    await admin.user.create({
      data: { email: "solo@t.local", tenantId, role: "marketer", name: "Solo" },
    });

    const owners = await loadCampaignOwners(tenantId);
    expect(owners).toEqual([]);
  });

  it("returns distinct owners + falls back to email when name is empty", async () => {
    const { loadCampaignOwners } = await import("@/lib/campaigns/list-kpis");
    const admin = getAdminPrisma();
    const tenantId = await freshTenant();

    const u1 = await admin.user.create({
      data: { email: "alice@t.local", tenantId, role: "marketer", name: "Alice" },
    });
    const u2 = await admin.user.create({
      data: { email: "bob@t.local", tenantId, role: "marketer", name: "" },
    });
    // 3rd user has no campaigns — must NOT appear in the result.
    await admin.user.create({
      data: { email: "carol@t.local", tenantId, role: "marketer", name: "Carol" },
    });
    await admin.campaign.create({
      data: {
        tenantId,
        name: "C-A",
        ownerUserId: u1.id,
        status: "active",
        markets: ["US"],
      },
    });
    await admin.campaign.create({
      data: {
        tenantId,
        name: "C-B",
        ownerUserId: u2.id,
        status: "active",
        markets: ["US"],
      },
    });

    const owners = await loadCampaignOwners(tenantId);
    const ids = owners.map((o) => o.id).sort();
    expect(ids).toEqual([u1.id, u2.id].sort());
    // u2.name is "" → falls back to email
    const u2Owner = owners.find((o) => o.id === u2.id);
    expect(u2Owner?.name).toBe("bob@t.local");
  });

  it("buildCampaignWhere applies ownerUserId filter when ownerIds is non-empty", async () => {
    const { buildCampaignWhere } = await import("@/lib/campaigns/filters");
    const where = buildCampaignWhere({
      statuses: [],
      search: undefined,
      games: [],
      regions: [],
      ownerIds: ["aaaaaaaa-1111-2222-3333-444444444444"],
      dateFrom: undefined,
      dateTo: undefined,
      cursor: undefined,
    });
    expect(where).toMatchObject({
      ownerUserId: { in: ["aaaaaaaa-1111-2222-3333-444444444444"] },
    });
  });
});
