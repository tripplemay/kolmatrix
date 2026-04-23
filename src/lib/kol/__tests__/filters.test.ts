import { describe, expect, it } from "vitest";

import {
  BRAND_SAFETY_RATINGS,
  buildKolWhere,
  DISCOVERY_CATEGORIES,
  DISCOVERY_REGIONS,
  LAST_UPLOAD_WINDOWS,
  MONETIZATION_STATUSES,
  parseFilters,
  RELATIONSHIP_STATUSES,
  serializeFilters,
  sortToOrderBy,
  type DiscoveryFilters,
} from "../filters";

const empty: DiscoveryFilters = {
  regions: [],
  categories: [],
  languages: [],
  platforms: [],
  monetizationStatuses: [],
  brandSafety: [],
  relationshipStatuses: [],
  knownCollabs: [],
  tags: [],
  includeNonGaming: false,
  sort: "value",
};

describe("parseFilters()", () => {
  it("defaults every field to empty / value-sort for an empty input", () => {
    const parsed = parseFilters(new URLSearchParams(""));
    expect(parsed).toMatchObject(empty);
    expect(parsed.search).toBeUndefined();
    expect(parsed.followersMin).toBeUndefined();
    expect(parsed.cursor).toBeUndefined();
  });

  it("parses repeated array keys", () => {
    const u = new URLSearchParams();
    u.append("regions", "US");
    u.append("regions", "GB");
    u.append("categories", "MOBA");
    const parsed = parseFilters(u);
    expect(parsed.regions).toEqual(["US", "GB"]);
    expect(parsed.categories).toEqual(["MOBA"]);
  });

  it("parses comma-separated array values as an alternative", () => {
    const u = new URLSearchParams({ regions: "US,GB,JP" });
    expect(parseFilters(u).regions).toEqual(["US", "GB", "JP"]);
  });

  it("coerces numeric strings and drops garbage", () => {
    const parsed = parseFilters(
      new URLSearchParams({
        followersMin: "1000",
        followersMax: "abc",
        engagementMin: "5.5",
        avgViewsMin: "-3",
      })
    );
    expect(parsed.followersMin).toBe(1000);
    expect(parsed.followersMax).toBeUndefined();
    expect(parsed.engagementMin).toBe(5.5);
    expect(parsed.avgViewsMin).toBeUndefined();
  });

  it("rejects unknown sort values and falls back to 'value'", () => {
    const p = parseFilters(new URLSearchParams({ sort: "nonsense" }));
    expect(p.sort).toBe("value");
  });

  it("accepts a valid lastUpload window and drops others", () => {
    expect(
      parseFilters(new URLSearchParams({ lastUpload: "90" })).lastUploadWithinDays
    ).toBe(90);
    expect(
      parseFilters(new URLSearchParams({ lastUpload: "7" })).lastUploadWithinDays
    ).toBeUndefined();
  });

  it("filters relationshipStatus against the 6-value enum", () => {
    const u = new URLSearchParams();
    u.append("relationshipStatus", "prospect");
    u.append("relationshipStatus", "long_term");
    u.append("relationshipStatus", "ghost_status");
    const p = parseFilters(u);
    expect(p.relationshipStatuses).toEqual(["prospect", "long_term"]);
  });

  it("filters monetization + brandSafety arrays against the enum", () => {
    const u = new URLSearchParams();
    u.append("monetization", "VERIFIED");
    u.append("monetization", "NOT_REAL");
    u.append("brandSafety", "PG13");
    u.append("brandSafety", "ZZ");
    const p = parseFilters(u);
    expect(p.monetizationStatuses).toEqual(["VERIFIED"]);
    expect(p.brandSafety).toEqual(["PG13"]);
  });

  it("treats includeNonGaming truthy values", () => {
    expect(
      parseFilters(new URLSearchParams({ includeNonGaming: "on" }))
        .includeNonGaming
    ).toBe(true);
    expect(
      parseFilters(new URLSearchParams({ includeNonGaming: "true" }))
        .includeNonGaming
    ).toBe(true);
    expect(parseFilters(new URLSearchParams({})).includeNonGaming).toBe(false);
  });

  it("trims whitespace from search input", () => {
    expect(
      parseFilters(new URLSearchParams({ search: "  Nintendo  " })).search
    ).toBe("Nintendo");
    expect(parseFilters(new URLSearchParams({ search: "   " })).search).toBeUndefined();
  });

  it("accepts Next.js page searchParams shape (record of string | string[])", () => {
    const parsed = parseFilters({
      regions: ["US", "GB"],
      categories: "MOBA,RPG",
      search: "Nintendo",
      cursor: "opaque-token-xyz",
    });
    expect(parsed.regions).toEqual(["US", "GB"]);
    expect(parsed.categories).toEqual(["MOBA", "RPG"]);
    expect(parsed.search).toBe("Nintendo");
    expect(parsed.cursor).toBe("opaque-token-xyz");
  });
});

describe("serializeFilters()", () => {
  it("omits defaults so URLs stay clean", () => {
    const out = serializeFilters(empty).toString();
    expect(out).toBe("");
  });

  it("round-trips a full filter object", () => {
    const full: DiscoveryFilters = {
      search: "Nintendo",
      followersMin: 1000,
      followersMax: 50000,
      regions: ["US", "GB"],
      categories: ["MOBA", "RPG"],
      languages: ["en"],
      platforms: ["youtube"],
      engagementMin: 5,
      avgViewsMin: 10000,
      uploadsPerMonthMin: 4,
      lastUploadWithinDays: 90,
      monetizationStatuses: ["VERIFIED"],
      brandSafety: ["PG13"],
      relationshipStatuses: ["negotiating", "long_term"],
      knownCollabs: ["Razer"],
      tags: ["esports"],
      includeNonGaming: true,
      sort: "followers",
      cursor: "abc",
    };
    const url = serializeFilters(full);
    const back = parseFilters(url);
    expect(back).toEqual(full);
  });

  it("honors overrides for cursor without dropping filters", () => {
    const full: DiscoveryFilters = {
      ...empty,
      search: "Nintendo",
      regions: ["US"],
      cursor: "first",
    };
    const next = serializeFilters(full, { cursor: "second" });
    const back = parseFilters(next);
    expect(back.cursor).toBe("second");
    expect(back.search).toBe("Nintendo");
    expect(back.regions).toEqual(["US"]);
  });
});

describe("buildKolWhere()", () => {
  it("applies the gaming default + soft-delete guard", () => {
    const where = buildKolWhere(empty);
    expect(Array.isArray(where.AND)).toBe(true);
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses[0]).toEqual({ deletedAt: null });
    expect(clauses[1]).toEqual({ isGaming: true });
    expect(clauses.length).toBe(2);
  });

  it("drops the is_gaming filter when includeNonGaming=true", () => {
    const where = buildKolWhere({ ...empty, includeNonGaming: true });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses.some((c) => "isGaming" in c)).toBe(false);
    expect(clauses[0]).toEqual({ deletedAt: null });
  });

  it("adds an OR on displayName + handle for search", () => {
    const where = buildKolWhere({ ...empty, search: "Nintendo" });
    const clauses = where.AND as Record<string, unknown>[];
    const searchClause = clauses.find(
      (c) => "OR" in c
    ) as { OR: Record<string, unknown>[] };
    expect(searchClause.OR).toEqual([
      { displayName: { contains: "Nintendo", mode: "insensitive" } },
      { handle: { contains: "Nintendo", mode: "insensitive" } },
    ]);
  });

  it("maps each filter dimension to the correct predicate", () => {
    const where = buildKolWhere({
      ...empty,
      followersMin: 1000,
      followersMax: 50000,
      regions: ["US"],
      categories: ["MOBA", "FPS"],
      languages: ["en"],
      platforms: ["youtube"],
      engagementMin: 5,
      avgViewsMin: 100,
      uploadsPerMonthMin: 3,
      lastUploadWithinDays: 30,
      monetizationStatuses: ["VERIFIED"],
      brandSafety: ["PG13"],
      relationshipStatuses: ["negotiating"],
      knownCollabs: ["Razer"],
      tags: ["esports"],
    });
    const clauses = where.AND as Record<string, unknown>[];
    const findOne = (key: string) => clauses.find((c) => key in c);
    expect(findOne("followerCount")).toBeDefined();
    expect(findOne("countryCode")).toEqual({ countryCode: { in: ["US"] } });
    expect(findOne("categories")).toEqual({
      categories: { hasSome: ["MOBA", "FPS"] },
    });
    expect(findOne("language")).toEqual({ language: { in: ["en"] } });
    expect(findOne("platform")).toEqual({ platform: { in: ["youtube"] } });
    expect(findOne("engagementRate")).toEqual({ engagementRate: { gte: 5 } });
    expect(findOne("avgViews")).toEqual({ avgViews: { gte: 100 } });
    expect(findOne("uploadsPerMonth")).toEqual({
      uploadsPerMonth: { gte: 3 },
    });
    expect(findOne("monetizationStatus")).toEqual({
      monetizationStatus: { in: ["VERIFIED"] },
    });
    expect(findOne("brandSafetyRating")).toEqual({
      brandSafetyRating: { in: ["PG13"] },
    });
    expect(findOne("relationshipStatus")).toEqual({
      relationshipStatus: { in: ["negotiating"] },
    });
    expect(findOne("knownBrandCollabs")).toEqual({
      knownBrandCollabs: { hasSome: ["Razer"] },
    });
    expect(findOne("tags")).toEqual({ tags: { hasSome: ["esports"] } });
    expect(findOne("lastUploadAt")).toBeDefined();
  });
});

describe("sortToOrderBy()", () => {
  it("maps the three sort options to indexed columns", () => {
    expect(sortToOrderBy("value")).toEqual({ field: "valueScore", direction: "desc" });
    expect(sortToOrderBy("followers")).toEqual({ field: "followerCount", direction: "desc" });
    expect(sortToOrderBy("recent")).toEqual({ field: "createdAt", direction: "desc" });
  });
});

describe("discovery enum constants", () => {
  it("defines stable sets the UI + tests rely on", () => {
    expect(DISCOVERY_REGIONS.length).toBe(11);
    expect(DISCOVERY_CATEGORIES.length).toBe(10);
    expect(MONETIZATION_STATUSES.length).toBe(3);
    expect(BRAND_SAFETY_RATINGS.length).toBe(4);
    expect(LAST_UPLOAD_WINDOWS).toEqual([30, 90, 180]);
    expect(RELATIONSHIP_STATUSES.length).toBe(6);
  });
});
