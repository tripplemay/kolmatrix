/**
 * BM2-F003 · Campaign list query integration spec
 *
 * Covers (per audit §7):
 *   - Cursor pagination splits 25 rows into page (20) + page (5) with
 *     no duplicates or gaps (BI4-F004 util contract)
 *   - status filter narrows rows correctly
 *   - search (name contains, case-insensitive) narrows rows correctly
 *   - tenant-scoped isolation via withTenant / RLS
 *   - tenantTotalCount surfaces total campaigns regardless of filter
 *     (drives the empty-state vs no-matches UI branch)
 *   - Derived fields: spendTotal / ROI% / kolCount populate correctly
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

type RunCampaignListSearch = typeof import(
  "@/lib/campaigns/search"
).runCampaignListSearch;
type CampaignListFilters = import(
  "@/lib/campaigns/filters"
).CampaignListFilters;

let runCampaignListSearch: RunCampaignListSearch;

const DEFAULT_FILTERS: CampaignListFilters = {
  statuses: [],
  games: [],
  regions: [],
  ownerIds: [],
};

beforeAll(async () => {
  await setupTestDb();
  ({ runCampaignListSearch } = await import("@/lib/campaigns/search"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

interface SeedResult {
  tenantId: string;
  userId: string;
  campaignIdsInInsertOrder: string[];
}

async function seedTenantWithCampaigns(
  count: number,
  opts: {
    statuses?: Array<"draft" | "active" | "completed">;
    names?: string[];
    spendByCampaign?: number[];
    revenueByCampaign?: Array<number | null>;
    slug?: string;
  } = {}
): Promise<SeedResult> {
  const admin = getAdminPrisma();
  const slug = opts.slug ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tenant = await admin.tenant.create({
    data: { name: `List Tenant ${slug}`, slug },
  });
  const user = await admin.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${slug}@test.local`,
      name: "List Owner",
    },
  });
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // Force unique createdAt per row (stable cursor ordering across
    // the whole dataset). createdAt DESC is the default sort.
    const createdAt = new Date(2026, 0, 1, 0, 0, i);
    const status = opts.statuses?.[i] ?? "draft";
    const name = opts.names?.[i] ?? `Campaign ${String(i).padStart(2, "0")}`;
    const spend = opts.spendByCampaign?.[i] ?? 0;
    const revenue = opts.revenueByCampaign?.[i] ?? null;
    const c = await admin.campaign.create({
      data: {
        tenantId: tenant.id,
        name,
        ownerUserId: user.id,
        status,
        spendTotal: spend.toFixed(2),
        revenueRecorded: revenue == null ? null : revenue.toFixed(2),
        createdAt,
      },
    });
    ids.push(c.id);
  }
  return {
    tenantId: tenant.id,
    userId: user.id,
    campaignIdsInInsertOrder: ids,
  };
}

describe("runCampaignListSearch()", () => {
  it("returns all campaigns for a tenant with tenantTotalCount populated", async () => {
    const { tenantId } = await seedTenantWithCampaigns(3);
    const result = await runCampaignListSearch(tenantId, DEFAULT_FILTERS);
    expect(result.items).toHaveLength(3);
    expect(result.tenantTotalCount).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("sorts by createdAt DESC so newest-first appears on page 1", async () => {
    const { tenantId, campaignIdsInInsertOrder } =
      await seedTenantWithCampaigns(5);
    const result = await runCampaignListSearch(tenantId, DEFAULT_FILTERS);
    // Insert order had older-first, expected output is newest-first.
    expect(result.items.map((i) => i.id)).toEqual(
      [...campaignIdsInInsertOrder].reverse()
    );
  });

  it("paginates 25 rows into pages of 20 + 5 with no overlap", async () => {
    const { tenantId } = await seedTenantWithCampaigns(25);

    const page1 = await runCampaignListSearch(tenantId, DEFAULT_FILTERS);
    expect(page1.items).toHaveLength(20);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();
    expect(page1.tenantTotalCount).toBe(25);

    const page2 = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(5);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();
    expect(page2.tenantTotalCount).toBe(25);

    const seen = new Set([
      ...page1.items.map((r) => r.id),
      ...page2.items.map((r) => r.id),
    ]);
    expect(seen.size).toBe(25);
  });

  it("narrows by status filter while tenantTotalCount still covers everything", async () => {
    const { tenantId } = await seedTenantWithCampaigns(4, {
      statuses: ["draft", "active", "completed", "active"],
    });
    const active = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      statuses: ["active"],
    });
    expect(active.items.every((r) => r.status === "active")).toBe(true);
    expect(active.items).toHaveLength(2);
    expect(active.tenantTotalCount).toBe(4);
    const drafts = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      statuses: ["draft"],
    });
    expect(drafts.items).toHaveLength(1);
  });

  it("narrows by search (case-insensitive contains) on campaign name", async () => {
    const { tenantId } = await seedTenantWithCampaigns(3, {
      names: ["Nebula Launch", "Cyber Odyssey", "nebula Expansion"],
    });
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      search: "NEBULA",
    });
    expect(res.items.map((r) => r.name).sort()).toEqual([
      "Nebula Launch",
      "nebula Expansion",
    ]);
  });

  it("computes ROI% only when status=completed AND revenue is present AND spend > 0", async () => {
    const { tenantId } = await seedTenantWithCampaigns(4, {
      statuses: ["completed", "completed", "active", "completed"],
      spendByCampaign: [100, 100, 100, 0],
      revenueByCampaign: [150, null, 150, 200],
    });
    const res = await runCampaignListSearch(tenantId, DEFAULT_FILTERS);
    const byName = new Map(res.items.map((r) => [r.name, r]));
    const rows = [
      byName.get("Campaign 00")!,
      byName.get("Campaign 01")!,
      byName.get("Campaign 02")!,
      byName.get("Campaign 03")!,
    ];
    // completed + spend=100 + revenue=150 → +50%
    expect(rows[0].roiPercent).toBe(50);
    // completed + no revenue → null
    expect(rows[1].roiPercent).toBeNull();
    // active + spend=100 + revenue=150 → null (status gate)
    expect(rows[2].roiPercent).toBeNull();
    // completed + spend=0 + revenue=200 → null (divide-by-zero gate)
    expect(rows[3].roiPercent).toBeNull();
  });

  it("includes kolCount from a single groupBy (no N+1)", async () => {
    const { tenantId, campaignIdsInInsertOrder, userId } =
      await seedTenantWithCampaigns(2);
    const admin = getAdminPrisma();
    const kol = await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "counter_kol",
        displayName: "Counter Kol",
      },
    });
    await admin.kolCampaign.create({
      data: {
        tenantId,
        kolId: kol.id,
        campaignId: campaignIdsInInsertOrder[0],
      },
    });
    // Confirm owner back-ref stays on the first tenant
    expect(userId).toBeTruthy();

    const res = await runCampaignListSearch(tenantId, DEFAULT_FILTERS);
    const withLink = res.items.find(
      (r) => r.id === campaignIdsInInsertOrder[0]
    )!;
    const withoutLink = res.items.find(
      (r) => r.id === campaignIdsInInsertOrder[1]
    )!;
    expect(withLink.kolCount).toBe(1);
    expect(withoutLink.kolCount).toBe(0);
  });

  it("isolates rows across tenants (RLS)", async () => {
    const a = await seedTenantWithCampaigns(2, { slug: "iso-a" });
    const b = await seedTenantWithCampaigns(3, { slug: "iso-b" });

    const aResult = await runCampaignListSearch(a.tenantId, DEFAULT_FILTERS);
    const bResult = await runCampaignListSearch(b.tenantId, DEFAULT_FILTERS);

    expect(aResult.items.map((r) => r.id).sort()).toEqual(
      a.campaignIdsInInsertOrder.sort()
    );
    expect(bResult.items.map((r) => r.id).sort()).toEqual(
      b.campaignIdsInInsertOrder.sort()
    );
    // Tenant counts are independent.
    expect(aResult.tenantTotalCount).toBe(2);
    expect(bResult.tenantTotalCount).toBe(3);
  });

  it("returns an empty page with tenantTotalCount=0 for a brand-new tenant", async () => {
    const admin = getAdminPrisma();
    const t = await admin.tenant.create({
      data: { name: "Empty", slug: `empty-${Date.now()}` },
    });
    const result = await runCampaignListSearch(t.id, DEFAULT_FILTERS);
    expect(result.items).toHaveLength(0);
    expect(result.tenantTotalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty items but tenantTotalCount>0 when filters miss", async () => {
    const { tenantId } = await seedTenantWithCampaigns(2, {
      statuses: ["draft", "draft"],
    });
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      statuses: ["completed"],
    });
    expect(res.items).toHaveLength(0);
    expect(res.tenantTotalCount).toBe(2);
  });
});
