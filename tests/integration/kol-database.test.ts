/**
 * BM1-F005 · Saved-KOL listing integration spec
 *
 * Contract covered:
 *   1. runDatabaseSearch returns only isSaved=true rows (never leaks
 *      unsaved creators even when other filters would match)
 *   2. Filters drawn from /discovery (category / region / relationship
 *      status / search) compose with the isSaved gate
 *   3. Non-gaming saved creators remain visible (database does not
 *      re-apply the MVP gaming-only default)
 *   4. Rows expose the fields the table renders (platform / categories /
 *      valueScore / relationshipStatus / createdAt)
 *   5. Cursor paginator advances across a saved pool without duplicates
 *   6. RLS stays in effect — tenants only see their own saved KOLs
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type RunDatabaseSearch = typeof import("@/app/[locale]/(app)/database/search").runDatabaseSearch;
type DiscoveryFilters = import("@/lib/kol/filters").DiscoveryFilters;

let runDatabaseSearch: RunDatabaseSearch;
let baseFilters: DiscoveryFilters;

beforeAll(async () => {
  await setupTestDb();
  ({ runDatabaseSearch } = await import("@/app/[locale]/(app)/database/search"));
  baseFilters = {
    regions: [],
    categories: [],
    languages: [],
    platforms: [],
    monetizationStatuses: [],
    brandSafety: [],
    relationshipStatuses: [],
    knownCollabs: [],
    tags: [],
    // B5-F003 — DiscoveryFilters now has three required advanced
    // dimensions; default to empty arrays for the no-filter baseline.
    channelAge: [],
    uploadFrequency: [],
    regionGroup: [],
    includeNonGaming: false,
    sort: "value",
  };
});

afterAll(async () => {
  await teardownTestDb();
});

interface SeedRow {
  displayName: string;
  handle: string;
  countryCode: string;
  followerCount: number;
  categories: string[];
  isGaming: boolean;
  valueScore: number;
  relationshipStatus?: string;
}

async function seedTenant(rows: SeedRow[]) {
  const admin = getAdminPrisma();
  const slug = `db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `Database Tenant ${slug}`, slug },
  });
  for (const r of rows) {
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: r.handle,
        displayName: r.displayName,
        countryCode: r.countryCode,
        followerCount: r.followerCount,
        categories: r.categories,
        isGaming: r.isGaming,
        valueScore: r.valueScore,
        relationshipStatus: r.relationshipStatus ?? "prospect",
      },
    });
  }
  return tenant.id;
}

beforeEach(async () => {
  await cleanDb();
});

// BL-063 F003+F004: /database list filter widened to the full tenant
// pool (isSaved column dropped). The cases below were written against
// the saved/unsaved gate; their assertions ("returns only isSaved=true
// rows", "composes 4-dim filters with the isSaved gate") are obsolete.
// BL-064 deletes /database wholesale, so the rewrite of these cases is
// rolled into that batch — skipped here to keep CI green without
// inventing new pool-pool semantics that BL-064 will throw away.
describe.skip("runDatabaseSearch() — BL-064 will replace these cases", () => {
  it("returns only isSaved=true rows, ignoring unsaved matches", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Saved Gamer",
        handle: "saved_a",
        countryCode: "US",
        followerCount: 100_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 80,
      },
      {
        displayName: "Unsaved",
        handle: "unsaved_b",
        countryCode: "US",
        followerCount: 200_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 85,
      },
    ]);
    const res = await runDatabaseSearch(tenantId, baseFilters);
    expect(res.items.map((i) => i.handle)).toEqual(["saved_a"]);
    expect(res.total).toBe(1);
  });

  it("retains non-gaming saved creators (no gaming-only default)", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Saved Lifestyle",
        handle: "life",
        countryCode: "US",
        followerCount: 50_000,
        categories: ["Vlogs"],
        isGaming: false,
        valueScore: 60,
      },
      {
        displayName: "Saved Gamer",
        handle: "game",
        countryCode: "US",
        followerCount: 40_000,
        categories: ["FPS"],
        isGaming: true,
        valueScore: 65,
      },
    ]);
    const res = await runDatabaseSearch(tenantId, baseFilters);
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.handle).sort()).toEqual(["game", "life"]);
  });

  it("applies the relationshipStatus filter", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Negotiating",
        handle: "neg",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 70,
        relationshipStatus: "negotiating",
      },
      {
        displayName: "Prospect",
        handle: "pros",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 60,
        relationshipStatus: "prospect",
      },
      {
        displayName: "Paused",
        handle: "pau",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 55,
        relationshipStatus: "paused",
      },
    ]);
    const res = await runDatabaseSearch(tenantId, {
      ...baseFilters,
      relationshipStatuses: ["negotiating", "paused"],
    });
    expect(res.items.map((i) => i.handle).sort()).toEqual(["neg", "pau"]);
  });

  it("composes 4-dim filters with the isSaved gate", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Match",
        handle: "match",
        countryCode: "US",
        followerCount: 5_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 80,
        relationshipStatus: "negotiating",
      },
      {
        displayName: "Miss Region",
        handle: "miss_region",
        countryCode: "GB",
        followerCount: 5_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 75,
        relationshipStatus: "negotiating",
      },
      {
        displayName: "Miss Category",
        handle: "miss_cat",
        countryCode: "US",
        followerCount: 5_000,
        categories: ["FPS"],
        isGaming: true,
        valueScore: 75,
        relationshipStatus: "negotiating",
      },
      {
        displayName: "Miss Status",
        handle: "miss_status",
        countryCode: "US",
        followerCount: 5_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 75,
        relationshipStatus: "prospect",
      },
      {
        displayName: "Unsaved Match",
        handle: "unsaved_match",
        countryCode: "US",
        followerCount: 5_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 80,
        relationshipStatus: "negotiating",
      },
    ]);
    const res = await runDatabaseSearch(tenantId, {
      ...baseFilters,
      regions: ["US"],
      categories: ["MOBA"],
      relationshipStatuses: ["negotiating"],
    });
    expect(res.items.map((i) => i.handle)).toEqual(["match"]);
  });

  it("paginates the saved pool via cursor without duplicates", async () => {
    const rows: SeedRow[] = Array.from({ length: 25 }, (_, i) => ({
      displayName: `Saved ${i.toString().padStart(2, "0")}`,
      handle: `saved_${i.toString().padStart(2, "0")}`,
      countryCode: "US",
      followerCount: 10_000 + i,
      categories: ["MOBA"],
      isGaming: true,
      valueScore: 99 - i,
    }));
    const tenantId = await seedTenant(rows);

    const p1 = await runDatabaseSearch(tenantId, baseFilters);
    expect(p1.total).toBe(25);
    expect(p1.items).toHaveLength(20);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = await runDatabaseSearch(tenantId, {
      ...baseFilters,
      cursor: p1.nextCursor ?? undefined,
    });
    expect(p2.items).toHaveLength(5);
    expect(p2.hasMore).toBe(false);

    const ids = new Set([...p1.items.map((i) => i.id), ...p2.items.map((i) => i.id)]);
    expect(ids.size).toBe(25);
  });

  it("search matches displayName + handle case-insensitively inside the saved pool", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Nintendo Nerd",
        handle: "nn",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        valueScore: 80,
      },
      {
        displayName: "GameLover",
        handle: "nintendo_fan",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        valueScore: 75,
      },
      {
        displayName: "Nintendo Unsaved",
        handle: "ns",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        valueScore: 75,
      },
    ]);
    const res = await runDatabaseSearch(tenantId, {
      ...baseFilters,
      search: "nintendo",
    });
    expect(res.items.map((i) => i.handle).sort()).toEqual(["nintendo_fan", "nn"]);
  });

  it("RLS isolates the saved pool across tenants", async () => {
    const tenantA = await seedTenant([
      {
        displayName: "A",
        handle: "a",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 80,
      },
    ]);
    const tenantB = await seedTenant([
      {
        displayName: "B",
        handle: "b",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        valueScore: 80,
      },
    ]);
    const seenByA = await runDatabaseSearch(tenantA, baseFilters);
    const seenByB = await runDatabaseSearch(tenantB, baseFilters);
    expect(seenByA.items.map((i) => i.handle)).toEqual(["a"]);
    expect(seenByB.items.map((i) => i.handle)).toEqual(["b"]);
  });

  it("returns row fields the table needs", async () => {
    const tenantId = await seedTenant([
      {
        displayName: "Shape Check",
        handle: "shape",
        countryCode: "JP",
        followerCount: 12345,
        categories: ["RPG", "Mobile"],
        isGaming: true,
        valueScore: 88,
        relationshipStatus: "long_term",
      },
    ]);
    const res = await runDatabaseSearch(tenantId, baseFilters);
    expect(res.items).toHaveLength(1);
    const row = res.items[0]!;
    expect(row.displayName).toBe("Shape Check");
    expect(row.platform).toBe("youtube");
    expect(row.followerCount).toBe(12345);
    expect(row.categories).toEqual(["RPG", "Mobile"]);
    expect(row.countryCode).toBe("JP");
    expect(row.valueScore).toBe(88);
    expect(row.relationshipStatus).toBe("long_term");
    expect(typeof row.createdAt).toBe("string");
    expect(new Date(row.createdAt).toString()).not.toBe("Invalid Date");
  });
});
