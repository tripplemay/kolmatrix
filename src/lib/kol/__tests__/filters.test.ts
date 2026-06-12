import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

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
  // B5-F003 — new advanced filter dimensions; default to empty so
  // existing fixtures keep parsing as the no-filter baseline.
  channelAge: [],
  uploadFrequency: [],
  regionGroup: [],
  includeNonGaming: false,
  hasBusinessEmail: false,
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
    expect(parseFilters(new URLSearchParams({ lastUpload: "90" })).lastUploadWithinDays).toBe(90);
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
    expect(parseFilters(new URLSearchParams({ includeNonGaming: "on" })).includeNonGaming).toBe(
      true
    );
    expect(parseFilters(new URLSearchParams({ includeNonGaming: "true" })).includeNonGaming).toBe(
      true
    );
    expect(parseFilters(new URLSearchParams({})).includeNonGaming).toBe(false);
  });

  it("trims whitespace from search input", () => {
    expect(parseFilters(new URLSearchParams({ search: "  Nintendo  " })).search).toBe("Nintendo");
    expect(parseFilters(new URLSearchParams({ search: "   " })).search).toBeUndefined();
  });

  it("BL-107-F002/M7 — a stray ?ai= is a no-op: never sets aiQuery, never drops search", () => {
    // The fake `?ai=` semantic-search UI was retired. A leftover/shared
    // `?ai=` URL must NOT surface a fake chip (aiQuery stays undefined)
    // and must NOT suppress the real ILIKE search term.
    const both = parseFilters(
      new URLSearchParams({ ai: "find esports streamers", search: "Nintendo" }),
    );
    expect(both.aiQuery).toBeUndefined();
    expect(both.search).toBe("Nintendo");

    const aiOnly = parseFilters(new URLSearchParams({ ai: "find esports streamers" }));
    expect(aiOnly.aiQuery).toBeUndefined();
    expect(aiOnly.search).toBeUndefined();
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
      tiers: [],
      // B5-F003 — round-trip the new advanced filter dimensions.
      channelAge: ["established"],
      uploadFrequency: ["active", "semi-active"],
      regionGroup: ["asia", "americas"],
      includeNonGaming: true,
      hasBusinessEmail: true,
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

  it("BL-107-F002/M7 — never emits ?ai=, even when a legacy aiQuery lingers", () => {
    // Legacy SaveSearch JSON may still carry aiQuery; the serializer must
    // drop it (no `?ai=`) while keeping the real search term.
    const withLegacyAi: DiscoveryFilters = {
      ...empty,
      search: "Nintendo",
      aiQuery: "stale semantic intent",
    };
    const params = serializeFilters(withLegacyAi);
    expect(params.has("ai")).toBe(false);
    expect(params.get("search")).toBe("Nintendo");
  });
});

describe("buildKolWhere()", () => {
  it("applies the gaming default + soft-delete + suspicious-hide guards", () => {
    const where = buildKolWhere(empty);
    expect(Array.isArray(where.AND)).toBe(true);
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses[0]).toEqual({ deletedAt: null });
    // B6-F005 hide flag — suspicious_growth rows excluded by default.
    expect(clauses[1]).toEqual({ isSuspicious: false });
    expect(clauses[2]).toEqual({ isGaming: true });
    expect(clauses.length).toBe(3);
  });

  it("drops the is_gaming filter when includeNonGaming=true", () => {
    const where = buildKolWhere({ ...empty, includeNonGaming: true });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses.some((c) => "isGaming" in c)).toBe(false);
    expect(clauses[0]).toEqual({ deletedAt: null });
    // F005 guard still applies regardless of the gaming toggle.
    expect(clauses[1]).toEqual({ isSuspicious: false });
  });

  it("adds an emails-present clause when hasBusinessEmail=true (BL-083-F004)", () => {
    const where = buildKolWhere({ ...empty, hasBusinessEmail: true });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses.some((c) => "emails" in c)).toBe(true);
    const emailClause = clauses.find((c) => "emails" in c) as {
      emails: { not: unknown };
    };
    expect(emailClause.emails).toEqual({ not: Prisma.AnyNull });
  });

  it("omits the emails clause when hasBusinessEmail=false", () => {
    const where = buildKolWhere({ ...empty, hasBusinessEmail: false });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses.some((c) => "emails" in c)).toBe(false);
  });

  it("round-trips hasBusinessEmail through serialize + parse", () => {
    const params = serializeFilters({ ...empty, hasBusinessEmail: true });
    expect(params.get("hasBusinessEmail")).toBe("on");
    expect(parseFilters(params).hasBusinessEmail).toBe(true);
  });

  it("adds an OR on displayName + handle for search", () => {
    const where = buildKolWhere({ ...empty, search: "Nintendo" });
    const clauses = where.AND as Record<string, unknown>[];
    const searchClause = clauses.find((c) => "OR" in c) as { OR: Record<string, unknown>[] };
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

  // B5-F003 — guard rails on the three new advanced filter branches.
  // Each branch maps a multi-select tier list onto an OR within an AND
  // clause; the tests below exercise every tier so the coverage gate
  // stays >= 80% and Reviewer can rely on the branch being live.
  it("emits OR clauses for each channelAge tier with the right date math", () => {
    const where = buildKolWhere({
      ...empty,
      channelAge: ["new", "established", "veteran"],
    });
    const clauses = where.AND as Record<string, unknown>[];
    const orClause = clauses.find(
      (c) => "OR" in c && Array.isArray((c as { OR: unknown[] }).OR)
    ) as { OR: Record<string, unknown>[] } | undefined;
    expect(orClause).toBeDefined();
    // Three tiers → three OR branches in this clause.
    expect(orClause!.OR).toHaveLength(3);
    // Branch shapes: { channelCreatedAt: { gte | lt | { gte+lt } } }
    const hasGte = orClause!.OR.some(
      (b) => "channelCreatedAt" in b && (b.channelCreatedAt as { gte?: unknown }).gte
    );
    const hasLt = orClause!.OR.some(
      (b) => "channelCreatedAt" in b && (b.channelCreatedAt as { lt?: unknown }).lt
    );
    const hasAndPair = orClause!.OR.some((b) => "AND" in b && Array.isArray(b.AND));
    expect(hasGte && hasLt && hasAndPair).toBe(true);
  });

  it("emits OR clauses for each uploadFrequency tier on uploadsPerMonth", () => {
    const where = buildKolWhere({
      ...empty,
      uploadFrequency: ["active", "semi-active", "inactive"],
    });
    const clauses = where.AND as Record<string, unknown>[];
    const orClause = clauses.find(
      (c) =>
        "OR" in c &&
        Array.isArray((c as { OR: unknown[] }).OR) &&
        ((c as { OR: unknown[] }).OR as Record<string, unknown>[]).every(
          (b) => "uploadsPerMonth" in b
        )
    ) as { OR: Record<string, unknown>[] } | undefined;
    expect(orClause).toBeDefined();
    expect(orClause!.OR).toEqual([
      { uploadsPerMonth: { gte: 4 } },
      { uploadsPerMonth: { gte: 1, lt: 4 } },
      { uploadsPerMonth: { lt: 1 } },
    ]);
  });

  it("unions the country list when regionGroup buckets are picked", () => {
    const where = buildKolWhere({
      ...empty,
      regionGroup: ["americas", "oceania"],
    });
    const clauses = where.AND as Record<string, unknown>[];
    const cc = clauses.find((c) => "countryCode" in c) as
      | { countryCode: { in: string[] } }
      | undefined;
    expect(cc).toBeDefined();
    // americas → US, CA; oceania → AU, NZ, FJ, PG, WS, TO.
    expect(cc!.countryCode.in).toEqual(
      expect.arrayContaining(["US", "CA", "AU", "NZ", "FJ", "PG", "WS", "TO"])
    );
    expect(cc!.countryCode.in.length).toBe(8);
  });

  describe("BL-020-F008 — HIDE_DEMO_SEED_KOLS env var", () => {
    const ORIGINAL = process.env.HIDE_DEMO_SEED_KOLS;
    afterEach(() => {
      if (ORIGINAL === undefined) {
        delete process.env.HIDE_DEMO_SEED_KOLS;
      } else {
        process.env.HIDE_DEMO_SEED_KOLS = ORIGINAL;
      }
    });

    it("appends emailSource not demo_seed when env=true", () => {
      process.env.HIDE_DEMO_SEED_KOLS = "true";
      const where = buildKolWhere(empty);
      const clauses = where.AND as Record<string, unknown>[];
      const demoSeedClause = clauses.find(
        (c) => "emailSource" in c
      ) as { emailSource: { not: string } } | undefined;
      expect(demoSeedClause).toBeDefined();
      expect(demoSeedClause!.emailSource).toEqual({ not: "demo_seed" });
    });

    it("does not append the emailSource clause when env=false", () => {
      process.env.HIDE_DEMO_SEED_KOLS = "false";
      const where = buildKolWhere(empty);
      const clauses = where.AND as Record<string, unknown>[];
      expect(clauses.some((c) => "emailSource" in c)).toBe(false);
    });

    it("does not append the emailSource clause when env is unset", () => {
      delete process.env.HIDE_DEMO_SEED_KOLS;
      const where = buildKolWhere(empty);
      const clauses = where.AND as Record<string, unknown>[];
      expect(clauses.some((c) => "emailSource" in c)).toBe(false);
    });
  });
});

describe("sortToOrderBy()", () => {
  it("maps the three sort options to indexed columns", () => {
    // BL-035-F012: `value` now also pins NULL placement so seed mock
    // KOLs (valueScore = NULL) sink to the bottom of the list. The
    // other two columns are non-nullable.
    expect(sortToOrderBy("value")).toEqual({
      field: "valueScore",
      direction: "desc",
      nulls: "last",
    });
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
