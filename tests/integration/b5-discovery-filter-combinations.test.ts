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

beforeEach(async () => {
  await cleanDb();
});

interface SeedRow {
  displayName: string;
  handle: string;
  countryCode: string;
  language: string;
  followerCount: number;
  engagementRate: number | null;
  valueScore: number;
  categories: string[];
  channelCreatedAt?: Date | null;
  uploadsPerMonth?: number | null;
}

async function seedTenantWithKols(
  rows: SeedRow[],
  slug = `b5-disco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): Promise<{ tenantId: string }> {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: { name: `B5 Discovery ${slug}`, slug },
  });

  for (const row of rows) {
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: row.handle,
        displayName: row.displayName,
        countryCode: row.countryCode,
        language: row.language,
        followerCount: row.followerCount,
        engagementRate: row.engagementRate,
        valueScore: row.valueScore,
        categories: row.categories,
        isGaming: true,
        channelCreatedAt: row.channelCreatedAt ?? null,
        uploadsPerMonth: row.uploadsPerMonth ?? null,
      },
    });
  }

  return { tenantId: tenant.id };
}

function yearsAgo(years: number): Date {
  return new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000);
}

describe("B5-F005 discovery filter combinations", () => {
  it("combines channelAge with existing category and engagement filters", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Target Veteran MOBA",
        handle: "@target-veteran",
        countryCode: "US",
        language: "en",
        followerCount: 250_000,
        engagementRate: 5.2,
        valueScore: 90,
        categories: ["MOBA"],
        channelCreatedAt: yearsAgo(4),
      },
      {
        displayName: "Too New",
        handle: "@too-new",
        countryCode: "US",
        language: "en",
        followerCount: 250_000,
        engagementRate: 5.2,
        valueScore: 89,
        categories: ["MOBA"],
        channelCreatedAt: yearsAgo(0.5),
      },
      {
        displayName: "Wrong Category",
        handle: "@wrong-category",
        countryCode: "US",
        language: "en",
        followerCount: 250_000,
        engagementRate: 5.2,
        valueScore: 88,
        categories: ["RPG"],
        channelCreatedAt: yearsAgo(4),
      },
      {
        displayName: "Low Engagement",
        handle: "@low-engagement",
        countryCode: "US",
        language: "en",
        followerCount: 250_000,
        engagementRate: 2.1,
        valueScore: 87,
        categories: ["MOBA"],
        channelCreatedAt: yearsAgo(4),
      },
    ]);

    const result = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      channelAge: ["veteran"],
      categories: ["MOBA"],
      engagementMin: 4,
    });

    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.handle)).toEqual(["@target-veteran"]);
  });

  it("combines uploadFrequency with existing follower-range filters", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Target Active",
        handle: "@target-active",
        countryCode: "GB",
        language: "en",
        followerCount: 120_000,
        engagementRate: 4.8,
        valueScore: 86,
        categories: ["FPS"],
        uploadsPerMonth: 6,
      },
      {
        displayName: "Too Inactive",
        handle: "@too-inactive",
        countryCode: "GB",
        language: "en",
        followerCount: 120_000,
        engagementRate: 4.8,
        valueScore: 85,
        categories: ["FPS"],
        uploadsPerMonth: 2,
      },
      {
        displayName: "Too Small",
        handle: "@too-small",
        countryCode: "GB",
        language: "en",
        followerCount: 40_000,
        engagementRate: 4.8,
        valueScore: 84,
        categories: ["FPS"],
        uploadsPerMonth: 8,
      },
    ]);

    const result = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      uploadFrequency: ["active"],
      followersMin: 100_000,
      followersMax: 200_000,
    });

    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.handle)).toEqual(["@target-active"]);
  });

  it("combines regionGroup with existing regions and language filters", async () => {
    const { tenantId } = await seedTenantWithKols([
      {
        displayName: "Target Japan",
        handle: "@target-jp",
        countryCode: "JP",
        language: "ja",
        followerCount: 180_000,
        engagementRate: 5.4,
        valueScore: 83,
        categories: ["Action"],
      },
      {
        displayName: "Wrong Language",
        handle: "@wrong-language",
        countryCode: "KR",
        language: "ko",
        followerCount: 180_000,
        engagementRate: 5.4,
        valueScore: 82,
        categories: ["Action"],
      },
      {
        displayName: "Wrong Region Group",
        handle: "@wrong-region",
        countryCode: "US",
        language: "ja",
        followerCount: 180_000,
        engagementRate: 5.4,
        valueScore: 81,
        categories: ["Action"],
      },
    ]);

    const result = await runDiscoverySearch(tenantId, {
      ...baseFilters,
      regionGroup: ["asia"],
      regions: ["JP", "KR"],
      languages: ["ja"],
    });

    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.handle)).toEqual(["@target-jp"]);
  });
});
