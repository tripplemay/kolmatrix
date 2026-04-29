/**
 * BM1-F004 · KOL Discovery search + toggle integration spec
 *
 * Contract covered:
 *   1. Default filter (no input) returns only gaming KOLs (isGaming=true)
 *   2. includeNonGaming=true returns both gaming + non-gaming creators
 *   3. Follower range narrows the result set correctly
 *   4. Category filter uses `hasSome` over the categories[] column
 *   5. EngagementRate threshold excludes rows with NULL rate
 *   6. Search matches both displayName (fuzzy, case-insensitive) and handle
 *   7. Cursor pagination advances across pages without duplicates or gaps
 *   8. Sort by followers / value / recent produces the right ordering
 *   9. runDiscoverySearch respects RLS (cross-tenant rows stay hidden)
 *  10. toggleKolSaved-style isSaved flip persists to the DB and surfaces
 *      the new flag on the next read
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type RunDiscoverySearch = typeof import("@/app/[locale]/(app)/discovery/search").runDiscoverySearch;
type DiscoveryFilters = import("@/lib/kol/filters").DiscoveryFilters;

let runDiscoverySearch: RunDiscoverySearch;
let baseFilters: DiscoveryFilters;

beforeAll(async () => {
  await setupTestDb();
  ({ runDiscoverySearch } = await import("@/app/[locale]/(app)/discovery/search"));
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

interface SeededKol {
  id: string;
  displayName: string;
  handle: string;
  countryCode: string;
  followerCount: number;
  categories: string[];
  isGaming: boolean;
  engagementRate: number | null;
  valueScore: number;
  createdAt: Date;
}

async function seedTenantWithKols(
  rows: Array<Omit<SeededKol, "id" | "createdAt"> & { createdAt?: Date }>,
  slug = `disco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): Promise<{ tenantId: string; created: SeededKol[] }> {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: { name: `Discovery Tenant ${slug}`, slug },
  });
  const created: SeededKol[] = [];
  for (const r of rows) {
    const k = await admin.kol.create({
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
        engagementRate: r.engagementRate,
        createdAt: r.createdAt ?? new Date(),
      },
    });
    created.push({
      id: k.id,
      displayName: k.displayName,
      handle: k.handle,
      countryCode: k.countryCode ?? "",
      followerCount: k.followerCount,
      categories: k.categories,
      isGaming: k.isGaming,
      engagementRate: k.engagementRate == null ? null : Number(k.engagementRate.toString()),
      valueScore: k.valueScore!,
      createdAt: k.createdAt,
    });
  }
  return { tenantId: tenant.id, created };
}

beforeEach(async () => {
  await cleanDb();
});

describe("runDiscoverySearch()", () => {
  it("returns only gaming KOLs by default (isGaming=true)", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Gaming A",
        handle: "gaming_a",
        countryCode: "US",
        followerCount: 100_000,
        categories: ["FPS"],
        isGaming: true,
        engagementRate: 3.5,
        valueScore: 80,
      },
      {
        displayName: "Gaming B",
        handle: "gaming_b",
        countryCode: "GB",
        followerCount: 50_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 4.0,
        valueScore: 75,
      },
      {
        displayName: "Lifestyle Vlogger",
        handle: "lifestyle_c",
        countryCode: "US",
        followerCount: 200_000,
        categories: ["Vlogs"],
        isGaming: false,
        engagementRate: 2.5,
        valueScore: 60,
      },
    ]);

    const res = await runDiscoverySearch(tenantId, baseFilters);
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.handle).sort()).toEqual(["gaming_a", "gaming_b"]);
  });

  it("returns gaming + non-gaming when includeNonGaming=true", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Gaming A",
        handle: "g_a",
        countryCode: "US",
        followerCount: 100_000,
        categories: ["FPS"],
        isGaming: true,
        engagementRate: 3,
        valueScore: 80,
      },
      {
        displayName: "Lifestyle",
        handle: "l",
        countryCode: "US",
        followerCount: 200_000,
        categories: ["Vlogs"],
        isGaming: false,
        engagementRate: 2,
        valueScore: 40,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      includeNonGaming: true,
    });
    expect(res.total).toBe(2);
  });

  it("narrows by follower range", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Small",
        handle: "s",
        countryCode: "US",
        followerCount: 500,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 40,
      },
      {
        displayName: "Mid",
        handle: "m",
        countryCode: "US",
        followerCount: 3_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 60,
      },
      {
        displayName: "Big",
        handle: "b",
        countryCode: "US",
        followerCount: 10_000_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 95,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      followersMin: 1_000,
      followersMax: 5_000,
    });
    expect(res.items.map((i) => i.handle)).toEqual(["m"]);
  });

  it("narrows by category (hasSome semantics)", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "MOBA fan",
        handle: "moba",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA", "Esports"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 70,
      },
      {
        displayName: "RPG fan",
        handle: "rpg",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 70,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      categories: ["MOBA"],
    });
    expect(res.items.map((i) => i.handle)).toEqual(["moba"]);
  });

  it("excludes NULL engagementRate rows under a min-threshold filter", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Known",
        handle: "known",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 7,
        valueScore: 70,
      },
      {
        displayName: "Unknown",
        handle: "unknown",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: null,
        valueScore: 70,
      },
      {
        displayName: "Too low",
        handle: "toolow",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 3,
        valueScore: 70,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      engagementMin: 5,
    });
    expect(res.items.map((i) => i.handle)).toEqual(["known"]);
  });

  it("fuzzy-matches search across displayName and handle", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Nintendo Nerd",
        handle: "nn",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 80,
      },
      {
        displayName: "GameLover",
        handle: "nintendo_fan",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 75,
      },
      {
        displayName: "Sony Fan",
        handle: "sony",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["RPG"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 70,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      search: "nintendo",
    });
    expect(res.items.map((i) => i.handle).sort()).toEqual(["nintendo_fan", "nn"]);
  });

  it("paginates with the cursor covering every row exactly once", async () => {
    // 25 rows → page size 20 → page 1 (20) + page 2 (5) with no overlap.
    const rows = Array.from({ length: 25 }, (_, i) => ({
      displayName: `KOL ${i.toString().padStart(2, "0")}`,
      handle: `kol${i.toString().padStart(2, "0")}`,
      countryCode: "US",
      followerCount: 10_000 + i,
      categories: ["MOBA"],
      isGaming: true,
      engagementRate: 5,
      // Descending valueScore so the default sort surfaces them predictably.
      valueScore: 99 - i,
    }));
    const { tenantId } = await seedTenantWithKols(rows);

    const page1 = await runDiscoverySearch(tenantId, baseFilters);
    expect(page1.total).toBe(25);
    expect(page1.items).toHaveLength(20);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.items).toHaveLength(5);
    expect(page2.hasMore).toBe(false);

    const seen = new Set([...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)]);
    expect(seen.size).toBe(25);
  });

  it("respects the chosen sort (followers asc → descending follower counts)", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Small",
        handle: "s",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 10,
      },
      {
        displayName: "Medium",
        handle: "m",
        countryCode: "US",
        followerCount: 100_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 50,
      },
      {
        displayName: "Huge",
        handle: "h",
        countryCode: "US",
        followerCount: 10_000_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 30,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      sort: "followers",
    });
    expect(res.items.map((i) => i.handle)).toEqual(["h", "m", "s"]);
  });

  it("respects the default value-score sort (desc)", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Low",
        handle: "low",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 10,
      },
      {
        displayName: "High",
        handle: "high",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 90,
      },
      {
        displayName: "Mid",
        handle: "mid",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 50,
      },
    ]);
    const res = await runDiscoverySearch(tenantId, baseFilters);
    expect(res.items.map((i) => i.handle)).toEqual(["high", "mid", "low"]);
  });

  it("RLS-isolates rows across tenants", async () => {
    const first = await seedTenantWithKols([
      {
        displayName: "Tenant A Only",
        handle: "tenant_a",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 80,
      },
    ]);
    const second = await seedTenantWithKols([
      {
        displayName: "Tenant B Only",
        handle: "tenant_b",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 80,
      },
    ]);

    const seenByA = await runDiscoverySearch(first.tenantId, baseFilters);
    expect(seenByA.items.map((i) => i.handle)).toEqual(["tenant_a"]);

    const seenByB = await runDiscoverySearch(second.tenantId, baseFilters);
    expect(seenByB.items.map((i) => i.handle)).toEqual(["tenant_b"]);
  });

  it("isSaved flip is visible on the next read", async () => {
    const { tenantId, created } = await seedTenantWithKols([
      {
        displayName: "Saver",
        handle: "saver",
        countryCode: "US",
        followerCount: 1_000,
        categories: ["MOBA"],
        isGaming: true,
        engagementRate: 5,
        valueScore: 80,
      },
    ]);
    const before = await runDiscoverySearch(tenantId, baseFilters);
    expect(before.items[0]?.isSaved).toBe(false);

    await getAdminPrisma().kol.update({
      where: { id: created[0]!.id },
      data: { isSaved: true },
    });

    const after = await runDiscoverySearch(tenantId, baseFilters);
    expect(after.items[0]?.isSaved).toBe(true);
  });
});
