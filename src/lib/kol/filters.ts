/**
 * BM1-F004 · KOL Discovery filter schema + URL ↔ filter ↔ Prisma.where mapping.
 *
 * Lives in /lib so both the server component (page.tsx reads searchParams
 * and calls buildWhere) and the unit tests can import it. URL params are
 * the source of truth so the filter state is shareable + back-button
 * friendly; the client form submits with `method="get"` and the page
 * re-renders from the URL.
 *
 * 15 dimensions per BM1 spec §F004:
 *   Basic 4 (shown flat):
 *     1. search          — fuzzy across displayName / handle (ILIKE)
 *     2. followersMin/Max — range on follower_count
 *     3. regions         — multi-select ISO-2 country codes
 *     4. categories      — multi-select gaming category strings
 *   Advanced 11 (collapsed):
 *     5. languages       — multi-select ISO-639 codes
 *     6. engagementMin   — engagement_rate >= N (percent, 0-100)
 *     7. avgViewsMin     — avg_views >= N
 *     8. uploadsPerMonthMin
 *     9. lastUploadWithinDays — 30 / 90 / 180 (or undefined = any)
 *    10. monetizationStatuses — multi: VERIFIED / MONETIZED / NONE
 *    11. brandSafety     — multi: G / PG / PG13 / R
 *    12. knownCollabs    — multi substring match on known_brand_collabs[]
 *    13. tags            — multi substring match on tags[]
 *    14. platforms       — multi-select platform strings
 *    15. includeNonGaming — boolean (default false → is_gaming=true filter)
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const MONETIZATION_STATUSES = ["VERIFIED", "MONETIZED", "NONE"] as const;
export const BRAND_SAFETY_RATINGS = ["G", "PG", "PG13", "R"] as const;
export const LAST_UPLOAD_WINDOWS = [30, 90, 180] as const;
export const SORT_OPTIONS = ["value", "followers", "recent"] as const;

// B5-F003 — channel age tiers, derived at query time from
// kol.channel_created_at. Boundaries are inclusive on the upper end:
//   new          channelCreatedAt >= now - 1y
//   established  now - 3y <= channelCreatedAt < now - 1y
//   veteran      channelCreatedAt < now - 3y
// Rows with NULL channel_created_at are excluded from any of the three
// buckets — same semantic as the existing engagement / avgViews filters.
export const CHANNEL_AGE_TIERS = ["new", "established", "veteran"] as const;
export type ChannelAgeTier = (typeof CHANNEL_AGE_TIERS)[number];

// B5-F003 — upload frequency tiers, mapped onto the existing
// kol.uploads_per_month column (BM1).
//   active       uploads_per_month >= 4
//   semi-active  1 <= uploads_per_month < 4
//   inactive     uploads_per_month < 1
export const UPLOAD_FREQUENCY_TIERS = ["active", "semi-active", "inactive"] as const;
export type UploadFrequencyTier = (typeof UPLOAD_FREQUENCY_TIERS)[number];

// B5-F003 — coarse region groups. Country codes that don't map to one
// of the five buckets (e.g. AE, ZA) just fall outside any group filter
// — the row is still visible when no regionGroup filter is set, and
// hidden when one is set, identical to the existing `regions` filter
// semantic.
export const REGION_GROUPS = ["asia", "europe", "americas", "latam", "oceania"] as const;
export type RegionGroup = (typeof REGION_GROUPS)[number];

export const REGION_GROUP_COUNTRIES: Record<RegionGroup, readonly string[]> = {
  asia: [
    "CN",
    "HK",
    "TW",
    "JP",
    "KR",
    "SG",
    "ID",
    "VN",
    "TH",
    "MY",
    "PH",
    "IN",
    "BD",
    "PK",
    "LK",
    "MM",
    "KH",
    "LA",
    "MN",
    "NP",
    "IQ",
    "IR",
    "AE",
    "SA",
    "IL",
    "JO",
  ],
  europe: [
    "GB",
    "IE",
    "DE",
    "FR",
    "IT",
    "ES",
    "PT",
    "NL",
    "BE",
    "LU",
    "AT",
    "CH",
    "SE",
    "NO",
    "DK",
    "FI",
    "IS",
    "PL",
    "CZ",
    "SK",
    "HU",
    "RO",
    "BG",
    "GR",
    "EE",
    "LV",
    "LT",
    "SI",
    "HR",
    "RS",
    "BA",
    "AL",
    "MK",
    "ME",
    "MD",
    "UA",
    "BY",
    "RU",
    "TR",
    "CY",
    "MT",
  ],
  americas: ["US", "CA"],
  latam: [
    "MX",
    "BR",
    "AR",
    "CO",
    "PE",
    "CL",
    "VE",
    "EC",
    "BO",
    "PY",
    "UY",
    "CR",
    "PA",
    "GT",
    "HN",
    "SV",
    "NI",
    "DO",
    "PR",
    "CU",
    "JM",
    "TT",
  ],
  oceania: ["AU", "NZ", "FJ", "PG", "WS", "TO"],
};

// BM1-F005/F006 relationship lifecycle. Default for newly-seeded KOLs is
// "prospect"; /database surfaces the dropdown so marketers can move a
// creator through the funnel. BM2 will upgrade this to an event-sourced
// CRM timeline, but the enum stays identical.
export const RELATIONSHIP_STATUSES = [
  "prospect",
  "first_contact",
  "negotiating",
  "long_term",
  "paused",
  "terminated",
] as const;

export type MonetizationStatus = (typeof MONETIZATION_STATUSES)[number];
export type BrandSafetyRating = (typeof BRAND_SAFETY_RATINGS)[number];
export type LastUploadWindow = (typeof LAST_UPLOAD_WINDOWS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** The full filter state, after parsing + defaulting. */
export interface DiscoveryFilters {
  search?: string;
  /**
   * BL-107-F002/M7 — DORMANT. The `?ai=` semantic-search UI was never
   * wired (`buildKolWhere` never read this, `runSemanticKolSearch` had
   * zero callers), so it rendered a fake "AI: …" chip that filtered
   * nothing. The misleading UI is removed; `parseFilters` no longer
   * reads `?ai=` and `serializeFilters` never emits it (stray `?ai=`
   * is a no-op). The field is retained — not deleted — so legacy
   * SaveSearch JSON that still carries `aiQuery` deserializes without a
   * type break, and BL-112 can re-wire real semantic search onto it.
   */
  aiQuery?: string;
  followersMin?: number;
  followersMax?: number;
  regions: string[];
  categories: string[];
  languages: string[];
  platforms: string[];
  engagementMin?: number;
  avgViewsMin?: number;
  uploadsPerMonthMin?: number;
  lastUploadWithinDays?: LastUploadWindow;
  monetizationStatuses: MonetizationStatus[];
  brandSafety: BrandSafetyRating[];
  knownCollabs: string[];
  tags: string[];
  tiers?: Array<"high" | "medium" | "low" | "unrated">;
  /** B5-F003 — multi-select channel age bucket. Undefined / empty
   *  means no filter; an empty array is also the no-filter case. */
  channelAge: ChannelAgeTier[];
  /** B5-F003 — multi-select upload-frequency bucket. */
  uploadFrequency: UploadFrequencyTier[];
  /** B5-F003 — multi-select coarse region group; combined with the
   *  fine-grained `regions` filter via AND. */
  regionGroup: RegionGroup[];
  /**
   * BM1-F005: /database uses this for the "Relationship status" column
   * filter. /discovery does not expose the dim in the UI but the schema
   * tolerates it arriving via URL so filter links stay portable across
   * the two pages.
   */
  relationshipStatuses: RelationshipStatus[];
  includeNonGaming: boolean;
  /** BL-083-F004 — when true, restrict to KOLs the fork unlocked a
   *  business email for (`kol.emails` JSONB present). The write path
   *  (F003) + backfill (F006) only ever store a non-empty array, so a
   *  present `emails` column always means ≥1 business email — the
   *  buildKolWhere clause filters on `emails IS NOT NULL`. */
  hasBusinessEmail: boolean;
  sort: SortOption;
  cursor?: string;
}

/**
 * Parse a URLSearchParams (or a plain record) into DiscoveryFilters.
 *
 * Array fields accept either repeated keys (`?regions=US&regions=GB`) or
 * a single comma-separated value (`?regions=US,GB`). Both produce the
 * same `regions: ["US","GB"]`. Integers / decimals that don't parse are
 * silently dropped so a stale/bookmarked URL never 500s — empty-state
 * handling is the fallback for garbage input.
 */
export function parseFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): DiscoveryFilters {
  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) {
      const v = input.get(key);
      return v === null ? undefined : v;
    }
    const v = input[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const getAll = (key: string): string[] => {
    const raw: string[] = [];
    if (input instanceof URLSearchParams) {
      for (const v of input.getAll(key)) raw.push(v);
    } else {
      const v = input[key];
      if (Array.isArray(v)) raw.push(...v);
      else if (typeof v === "string") raw.push(v);
    }
    return raw
      .flatMap((chunk) => chunk.split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const asInt = (v: string | undefined): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const asFloat = (v: string | undefined): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const last = get("lastUpload");
  const lastParsed = last === "30" ? 30 : last === "90" ? 90 : last === "180" ? 180 : undefined;

  const sortRaw = get("sort");
  const sort: SortOption = sortRaw === "followers" || sortRaw === "recent" ? sortRaw : "value";

  const monetizationStatuses = getAll("monetization").filter((v): v is MonetizationStatus =>
    (MONETIZATION_STATUSES as readonly string[]).includes(v)
  );
  const brandSafety = getAll("brandSafety").filter((v): v is BrandSafetyRating =>
    (BRAND_SAFETY_RATINGS as readonly string[]).includes(v)
  );
  const relationshipStatusesRaw = getAll("relationshipStatus");
  // BM2-F007: also accept the shorter `?status=X` alias used by
  // cross-page deep links from /crm Pipeline bars (Planner adjudication
  // §13.4 #8). Aliased value is appended after the existing list, then
  // de-duped, so explicit `relationshipStatus` URL params still win.
  const statusAlias = get("status");
  const aliasedList =
    statusAlias && (RELATIONSHIP_STATUSES as readonly string[]).includes(statusAlias)
      ? [statusAlias]
      : [];
  const relationshipStatuses = Array.from(
    new Set([...relationshipStatusesRaw, ...aliasedList])
  ).filter((v): v is RelationshipStatus =>
    (RELATIONSHIP_STATUSES as readonly string[]).includes(v)
  );

  const searchRaw = get("search");
  const searchTrimmed = searchRaw && searchRaw.trim() ? searchRaw.trim() : undefined;

  // BL-107-F002/M7 — `?ai=` is no longer parsed. The semantic-search UI
  // was never wired (it filtered nothing), so a stray `?ai=` must NOT
  // drop the real `search` term nor surface a fake chip. aiQuery stays
  // permanently undefined here; BL-112 will re-introduce a real parse.
  const search = searchTrimmed;
  const aiQuery = undefined;

  return {
    search,
    aiQuery,
    followersMin: asInt(get("followersMin")),
    followersMax: asInt(get("followersMax")),
    regions: getAll("regions"),
    categories: getAll("categories"),
    languages: getAll("languages"),
    platforms: getAll("platforms"),
    engagementMin: asFloat(get("engagementMin")),
    avgViewsMin: asInt(get("avgViewsMin")),
    uploadsPerMonthMin: asInt(get("uploadsPerMonthMin")),
    lastUploadWithinDays: lastParsed,
    monetizationStatuses,
    brandSafety,
    relationshipStatuses,
    knownCollabs: getAll("knownCollabs"),
    tags: getAll("tags"),
    tiers: getAll("tiers").filter(
      (v): v is "high" | "medium" | "low" | "unrated" =>
        v === "high" || v === "medium" || v === "low" || v === "unrated"
    ),
    channelAge: getAll("channelAge").filter((v): v is ChannelAgeTier =>
      (CHANNEL_AGE_TIERS as readonly string[]).includes(v)
    ),
    uploadFrequency: getAll("uploadFrequency").filter((v): v is UploadFrequencyTier =>
      (UPLOAD_FREQUENCY_TIERS as readonly string[]).includes(v)
    ),
    regionGroup: getAll("regionGroup").filter((v): v is RegionGroup =>
      (REGION_GROUPS as readonly string[]).includes(v)
    ),
    includeNonGaming: get("includeNonGaming") === "on" || get("includeNonGaming") === "true",
    hasBusinessEmail:
      get("hasBusinessEmail") === "on" || get("hasBusinessEmail") === "true",
    sort,
    cursor: get("cursor") || undefined,
  };
}

/**
 * Serialize DiscoveryFilters back to a URLSearchParams so pagination
 * links can keep the current filter state while flipping the cursor.
 * Defaults are omitted to keep URLs short. Array keys repeat.
 */
export function serializeFilters(
  filters: DiscoveryFilters,
  overrides: Partial<DiscoveryFilters> = {}
): URLSearchParams {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  // BL-107-F002/M7 — never emit `?ai=`; the semantic-search UI is
  // retired (see DiscoveryFilters.aiQuery). Only the deterministic
  // `?search=` free-text term is serialized.
  if (merged.search) {
    params.set("search", merged.search);
  }
  if (merged.followersMin != null) params.set("followersMin", String(merged.followersMin));
  if (merged.followersMax != null) params.set("followersMax", String(merged.followersMax));
  for (const v of merged.regions) params.append("regions", v);
  for (const v of merged.categories) params.append("categories", v);
  for (const v of merged.languages) params.append("languages", v);
  for (const v of merged.platforms) params.append("platforms", v);
  if (merged.engagementMin != null) params.set("engagementMin", String(merged.engagementMin));
  if (merged.avgViewsMin != null) params.set("avgViewsMin", String(merged.avgViewsMin));
  if (merged.uploadsPerMonthMin != null)
    params.set("uploadsPerMonthMin", String(merged.uploadsPerMonthMin));
  if (merged.lastUploadWithinDays) params.set("lastUpload", String(merged.lastUploadWithinDays));
  for (const v of merged.monetizationStatuses) params.append("monetization", v);
  for (const v of merged.brandSafety) params.append("brandSafety", v);
  for (const v of merged.relationshipStatuses) params.append("relationshipStatus", v);
  for (const v of merged.knownCollabs) params.append("knownCollabs", v);
  for (const v of merged.tags) params.append("tags", v);
  for (const v of merged.tiers ?? []) params.append("tiers", v);
  for (const v of merged.channelAge) params.append("channelAge", v);
  for (const v of merged.uploadFrequency) params.append("uploadFrequency", v);
  for (const v of merged.regionGroup) params.append("regionGroup", v);
  if (merged.includeNonGaming) params.set("includeNonGaming", "on");
  if (merged.hasBusinessEmail) params.set("hasBusinessEmail", "on");
  if (merged.sort !== "value") params.set("sort", merged.sort);
  if (merged.cursor) params.set("cursor", merged.cursor);
  return params;
}

/**
 * Build the Prisma.KolWhereInput that realizes a DiscoveryFilters value.
 *
 * Notes:
 *  - `isGaming` defaults to true so MVP gaming-only view is always the
 *    starting point; `includeNonGaming` drops the filter so non-gaming
 *    creators appear mixed-in (sparse but present).
 *  - Search is a case-insensitive `contains` (ILIKE) on displayName +
 *    handle, which supports cursor pagination — the path the product
 *    uses. (BL-107-F001/M5: the dormant tsvector `searchKols()` helper
 *    was deleted as dead code; the DB `search_vector` column + trigger
 *    are retained for BL-112's real semantic search.)
 *  - Nullable numeric thresholds (engagement etc.) use `gte` which
 *    naturally excludes NULL rows in Postgres. This is the expected
 *    behavior — a KOL with unknown engagement cannot satisfy "≥ 5%".
 */
export function buildKolWhere(filters: DiscoveryFilters): Prisma.KolWhereInput {
  const and: Prisma.KolWhereInput[] = [
    { deletedAt: null },
    // B6-F005: hide rows the daily-sync quality module flagged as
    // suspicious_growth (likely fake-follower buy). The canonical
    // bit lives on `kol.is_suspicious` (default false) — the JSONB
    // audit trail in `metadata.flags` is preserved for forensics.
    { isSuspicious: false },
  ];
  // BL-020-F008: prod env hides demo_seed mock KOLs (12 rows) from the
  // Discovery list. Staging keeps them visible so the demo flow remains
  // exercisable. Cannot delete the seeds themselves — 300 EmailLog +
  // 10 KolCampaign rows reference them under FK.
  if (process.env.HIDE_DEMO_SEED_KOLS === "true") {
    and.push({ emailSource: { not: "demo_seed" } });
  }
  if (!filters.includeNonGaming) {
    and.push({ isGaming: true });
  }

  // BL-083-F004 — "has business email" facet. The fork-unlocked emails
  // live in the nullable `kol.emails` JSONB column; the write path (F003)
  // + backfill (F006) only ever store a non-empty array, so "column is
  // not null" is equivalent to "≥1 business email". `Prisma.AnyNull`
  // matches both SQL NULL and a JSON `null` literal, so `not: AnyNull`
  // selects rows carrying a real array value.
  if (filters.hasBusinessEmail) {
    and.push({ emails: { not: Prisma.AnyNull } });
  }

  if (filters.search) {
    and.push({
      OR: [
        { displayName: { contains: filters.search, mode: "insensitive" } },
        { handle: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.followersMin != null) {
    and.push({ followerCount: { gte: filters.followersMin } });
  }
  if (filters.followersMax != null) {
    and.push({ followerCount: { lte: filters.followersMax } });
  }

  if (filters.regions.length > 0) {
    and.push({ countryCode: { in: filters.regions } });
  }
  if (filters.categories.length > 0) {
    and.push({ categories: { hasSome: filters.categories } });
  }
  if (filters.languages.length > 0) {
    and.push({ language: { in: filters.languages } });
  }
  if (filters.platforms.length > 0) {
    and.push({ platform: { in: filters.platforms } });
  }

  if (filters.engagementMin != null) {
    and.push({ engagementRate: { gte: filters.engagementMin } });
  }
  if (filters.avgViewsMin != null) {
    and.push({ avgViews: { gte: filters.avgViewsMin } });
  }
  if (filters.uploadsPerMonthMin != null) {
    and.push({ uploadsPerMonth: { gte: filters.uploadsPerMonthMin } });
  }
  if (filters.lastUploadWithinDays) {
    const cutoff = new Date(Date.now() - filters.lastUploadWithinDays * 86_400_000);
    and.push({ lastUploadAt: { gte: cutoff } });
  }

  if (filters.monetizationStatuses.length > 0) {
    and.push({ monetizationStatus: { in: filters.monetizationStatuses } });
  }
  if (filters.brandSafety.length > 0) {
    and.push({ brandSafetyRating: { in: filters.brandSafety } });
  }

  if (filters.relationshipStatuses.length > 0) {
    and.push({ relationshipStatus: { in: filters.relationshipStatuses } });
  }

  if (filters.knownCollabs.length > 0) {
    and.push({ knownBrandCollabs: { hasSome: filters.knownCollabs } });
  }
  if (filters.tags.length > 0) {
    and.push({ tags: { hasSome: filters.tags } });
  }
  if ((filters.tiers?.length ?? 0) > 0) {
    const tierClauses: Prisma.KolWhereInput[] = [];
    for (const tier of filters.tiers ?? []) {
      if (tier === "high") {
        tierClauses.push({ valueScore: { gte: 80 } });
      } else if (tier === "medium") {
        tierClauses.push({ valueScore: { gte: 60, lt: 80 } });
      } else if (tier === "low") {
        tierClauses.push({ valueScore: { lt: 60 } });
      } else {
        tierClauses.push({ valueScore: null });
      }
    }
    and.push({ OR: tierClauses });
  }

  // B5-F003 — channel age. Multi-select uses OR across the picked
  // tiers; combined with the rest of the filters via AND.
  if (filters.channelAge.length > 0) {
    const now = Date.now();
    const oneYearMs = 365 * 86_400_000;
    const threeYearMs = 3 * oneYearMs;
    const ageClauses: Prisma.KolWhereInput[] = [];
    for (const tier of filters.channelAge) {
      if (tier === "new") {
        ageClauses.push({
          channelCreatedAt: { gte: new Date(now - oneYearMs) },
        });
      } else if (tier === "established") {
        ageClauses.push({
          AND: [
            { channelCreatedAt: { gte: new Date(now - threeYearMs) } },
            { channelCreatedAt: { lt: new Date(now - oneYearMs) } },
          ],
        });
      } else {
        ageClauses.push({
          channelCreatedAt: { lt: new Date(now - threeYearMs) },
        });
      }
    }
    and.push({ OR: ageClauses });
  }

  // B5-F003 — upload frequency. Maps onto the BM1 uploads_per_month
  // column. NULL rows are excluded from any tier (same semantic as
  // the existing engagementRate / avgViews filters).
  if (filters.uploadFrequency.length > 0) {
    const freqClauses: Prisma.KolWhereInput[] = [];
    for (const tier of filters.uploadFrequency) {
      if (tier === "active") {
        freqClauses.push({ uploadsPerMonth: { gte: 4 } });
      } else if (tier === "semi-active") {
        freqClauses.push({ uploadsPerMonth: { gte: 1, lt: 4 } });
      } else {
        freqClauses.push({ uploadsPerMonth: { lt: 1 } });
      }
    }
    and.push({ OR: freqClauses });
  }

  // B5-F003 — coarse region group, ANDed with the existing fine-
  // grained `regions` filter. The country list per group is a static
  // mapping; selecting multiple groups unions their countries.
  if (filters.regionGroup.length > 0) {
    const countries = new Set<string>();
    for (const grp of filters.regionGroup) {
      for (const c of REGION_GROUP_COUNTRIES[grp]) countries.add(c);
    }
    if (countries.size > 0) {
      and.push({ countryCode: { in: Array.from(countries) } });
    }
  }

  return { AND: and };
}

/**
 * Map a sort option to the Prisma orderBy field name used by the cursor
 * paginator. The paginator auto-appends `{ id: direction }` as a stable
 * tie-breaker, so we only return the primary column name.
 *
 * BL-035-F012: `value` returns `nulls: 'last'` so KOLs without a
 * computed valueScore (mock seeds, freshly imported rows) sink to the
 * bottom of the discovery / database lists instead of crowning the
 * first page (Postgres' default for `DESC` is `NULLS FIRST`).
 * `followers` and `recent` map to non-nullable columns and stay
 * unchanged.
 */
export function sortToOrderBy(sort: SortOption): {
  field: string;
  direction: "asc" | "desc";
  nulls?: "first" | "last";
} {
  switch (sort) {
    case "followers":
      return { field: "followerCount", direction: "desc" };
    case "recent":
      return { field: "createdAt", direction: "desc" };
    case "value":
    default:
      return { field: "valueScore", direction: "desc", nulls: "last" };
  }
}

export const DISCOVERY_REGIONS = [
  "US",
  "GB",
  "CA",
  "DE",
  "JP",
  "VN",
  "TW",
  "UA",
  "IQ",
  "DO",
  "PK",
] as const;

export const DISCOVERY_CATEGORIES = [
  "MOBA",
  "RPG",
  "FPS",
  "Mobile",
  "Casual",
  "Shooter",
  "Sandbox",
  "Racing",
  "Simulation",
  "Fighting",
] as const;

export const DISCOVERY_PLATFORMS = [
  "youtube",
  "tiktok",
  "twitch",
  "bilibili",
  "twitter",
  "instagram",
] as const;

// Zod schema exposed for Server-Action validation (e.g. toggleKolSaved).
export const kolIdSchema = z
  .string()
  .uuid({ message: "kolIdInvalid" })
  .or(z.string().min(1).max(200));

// ────────────────────────────────────────────────────────────────────
// BL-073-F006 — data coverage (filter UX defense).
//
// Issue #4B root cause: prod KOL data has country_code / language fully
// NULL across the tenant's pool. The filter sidebar still rendered
// these dimensions as click-able, so a marketer narrowing by country
// got an empty match result that read as "search is broken" rather
// than "this dimension has no data yet".
//
// `getDataCoverage` returns, per facet dimension, the number of
// distinct non-NULL / non-empty values in the tenant's live KOLs.
// Callers (MatchFilterSidebar + runMatchSearch) treat `0` as
// "dimension unavailable" — UI greys the chips out + page.tsx
// short-circuits the SQL when a 0-coverage facet is requested.
// ────────────────────────────────────────────────────────────────────

export interface DataCoverage {
  regions: number;
  languages: number;
  platforms: number;
  categories: number;
  monetizationStatuses: number;
  brandSafety: number;
}

/**
 * BL-073 fix-round 1 — Reviewer caught the original `tx.kol.findMany +
 * distinct + select` pipeline returning wrong counts on staging (region
 * showed `(暂无数据)` despite 26 distinct country codes in the tenant
 * pool). Rewriting on top of `$queryRawUnsafe` is the safer path:
 *   - The SQL is plainly auditable and identical to the psql probes we
 *     ran during the F006 root-cause hunt.
 *   - It bypasses any Prisma `distinct`-with-nullable-column edge case.
 *   - It still runs inside the open `withTenant` transaction so RLS
 *     applies the same way.
 *
 * `categories` is a `text[]` column — `unnest` flattens then `COUNT
 * DISTINCT` dedupes; empty / whitespace-only strings are dropped.
 *
 * `brandSafety` is not directly a column — it lives on the JSON
 * `audienceGeoDist` / ai-score breakdown. We treat it as "always
 * available" (count = 1) so the UI never disables it; if a future
 * audit shows it's truly unpopulated, swap in a proper query.
 */
export async function getDataCoverage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
): Promise<DataCoverage> {
  // One round-trip, six COUNT(DISTINCT) buckets. Inline because the
  // values are aggregate counts (not row data), so cursor-paginate /
  // typed Prisma client adds no value here. RLS is in effect via the
  // surrounding withTenant `SET LOCAL app.tenant_id`.
  const rows = (await tx.$queryRawUnsafe(
    `
    SELECT
      COUNT(DISTINCT country_code) FILTER (
        WHERE country_code IS NOT NULL AND length(btrim(country_code)) > 0
      )::int                                                              AS regions,
      COUNT(DISTINCT language) FILTER (
        WHERE language IS NOT NULL AND length(btrim(language)) > 0
      )::int                                                              AS languages,
      COUNT(DISTINCT platform) FILTER (
        WHERE platform IS NOT NULL AND length(btrim(platform)) > 0
      )::int                                                              AS platforms,
      (
        SELECT COUNT(DISTINCT cat)::int
        FROM kol k2, unnest(k2.categories) AS cat
        WHERE k2.deleted_at IS NULL
          AND cat IS NOT NULL
          AND length(btrim(cat)) > 0
      )                                                                   AS categories,
      COUNT(DISTINCT monetization_status) FILTER (
        WHERE monetization_status IS NOT NULL
          AND length(btrim(monetization_status)) > 0
      )::int                                                              AS monetization_statuses
    FROM kol
    WHERE deleted_at IS NULL
    `,
  )) as Array<{
    regions: number;
    languages: number;
    platforms: number;
    categories: number;
    monetization_statuses: number;
  }>;

  const r = rows[0] ?? {
    regions: 0,
    languages: 0,
    platforms: 0,
    categories: 0,
    monetization_statuses: 0,
  };

  return {
    regions: Number(r.regions ?? 0),
    languages: Number(r.languages ?? 0),
    platforms: Number(r.platforms ?? 0),
    categories: Number(r.categories ?? 0),
    monetizationStatuses: Number(r.monetization_statuses ?? 0),
    // BrandSafety lives outside the Kol columns (BL-066 ai-score breakdown JSON);
    // treat as always-available until a separate audit shows otherwise.
    brandSafety: 1,
  };
}

// ────────────────────────────────────────────────────────────────────
// BL-075-F005 — data fill-rate snapshot.
//
// Companion to `getDataCoverage` (which counts distinct values per
// dimension). `getDataFillRates` returns the share of active gaming
// rows that have a non-NULL / non-blank value per dimension — the
// number the filter sidebar now surfaces as "Coverage: N%" to
// replace the BL-073-F006 hard disable. Threshold semantics intentionally
// match `getDataCoverage` (deleted_at IS NULL filter; brand-safety is
// outside the kol column set so we omit it).
// ────────────────────────────────────────────────────────────────────

export interface DataFillRates {
  /** Share of active KOLs with a non-blank country_code (0-1). */
  country: number;
  /** Share of active KOLs with a non-blank language (0-1). */
  language: number;
  /** Share of active KOLs with a non-blank platform (0-1). */
  platform: number;
  /** Share of active KOLs with at least one non-blank category (0-1). */
  category: number;
  /** Share of active KOLs with a non-blank monetization_status (0-1). */
  monetization: number;
  /** Total active KOLs counted (handy when total === 0 means we
   *  should hide the hint entirely rather than render "0%"). */
  total: number;
}

export async function getDataFillRates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
): Promise<DataFillRates> {
  const rows = (await tx.$queryRawUnsafe(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE country_code IS NOT NULL AND length(btrim(country_code)) > 0
      )::int AS country_filled,
      COUNT(*) FILTER (
        WHERE language IS NOT NULL AND length(btrim(language)) > 0
      )::int AS language_filled,
      COUNT(*) FILTER (
        WHERE platform IS NOT NULL AND length(btrim(platform)) > 0
      )::int AS platform_filled,
      COUNT(*) FILTER (
        WHERE categories IS NOT NULL
          AND array_length(categories, 1) IS NOT NULL
          AND array_length(categories, 1) > 0
      )::int AS category_filled,
      COUNT(*) FILTER (
        WHERE monetization_status IS NOT NULL
          AND length(btrim(monetization_status)) > 0
      )::int AS monetization_filled
    FROM kol
    WHERE deleted_at IS NULL AND is_suspicious = false
    `,
  )) as Array<{
    total: number;
    country_filled: number;
    language_filled: number;
    platform_filled: number;
    category_filled: number;
    monetization_filled: number;
  }>;

  const r = rows[0] ?? {
    total: 0,
    country_filled: 0,
    language_filled: 0,
    platform_filled: 0,
    category_filled: 0,
    monetization_filled: 0,
  };
  const total = Number(r.total ?? 0);
  const ratio = (n: number): number => (total > 0 ? Number(n) / total : 0);
  return {
    total,
    country: ratio(r.country_filled),
    language: ratio(r.language_filled),
    platform: ratio(r.platform_filled),
    category: ratio(r.category_filled),
    monetization: ratio(r.monetization_filled),
  };
}

/**
 * Returns true if the filters touch any dimension whose coverage is 0.
 * `runMatchSearch` callers short-circuit to an empty result when this
 * fires — saves an unnecessary SQL round-trip and prevents the user
 * from blaming the search when the underlying data is the issue.
 *
 * BL-075-F005: no longer called by `runMatchSearch` (we always run
 * the SQL now that the sidebar shows a "Coverage: N%" hint). Kept as
 * a public helper for any future caller that still wants the cheap
 * skip — and so the unit test contract stays valid.
 */
export function filterTouchesZeroCoverage(
  filters: DiscoveryFilters,
  coverage: DataCoverage,
): boolean {
  if (filters.regions.length > 0 && coverage.regions === 0) return true;
  if (filters.languages.length > 0 && coverage.languages === 0) return true;
  if (filters.platforms.length > 0 && coverage.platforms === 0) return true;
  if (filters.categories.length > 0 && coverage.categories === 0) return true;
  if (
    filters.monetizationStatuses.length > 0 &&
    coverage.monetizationStatuses === 0
  )
    return true;
  return false;
}
