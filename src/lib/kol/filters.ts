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
  /**
   * BM1-F005: /database uses this for the "Relationship status" column
   * filter. /discovery does not expose the dim in the UI but the schema
   * tolerates it arriving via URL so filter links stay portable across
   * the two pages.
   */
  relationshipStatuses: RelationshipStatus[];
  includeNonGaming: boolean;
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
  const lastParsed =
    last === "30" ? 30 : last === "90" ? 90 : last === "180" ? 180 : undefined;

  const sortRaw = get("sort");
  const sort: SortOption =
    sortRaw === "followers" || sortRaw === "recent" ? sortRaw : "value";

  const monetizationStatuses = getAll("monetization").filter(
    (v): v is MonetizationStatus =>
      (MONETIZATION_STATUSES as readonly string[]).includes(v)
  );
  const brandSafety = getAll("brandSafety").filter(
    (v): v is BrandSafetyRating =>
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
  const search = searchRaw && searchRaw.trim() ? searchRaw.trim() : undefined;

  return {
    search,
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
    includeNonGaming: get("includeNonGaming") === "on" || get("includeNonGaming") === "true",
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
  if (merged.search) params.set("search", merged.search);
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
  if (merged.lastUploadWithinDays)
    params.set("lastUpload", String(merged.lastUploadWithinDays));
  for (const v of merged.monetizationStatuses) params.append("monetization", v);
  for (const v of merged.brandSafety) params.append("brandSafety", v);
  for (const v of merged.relationshipStatuses)
    params.append("relationshipStatus", v);
  for (const v of merged.knownCollabs) params.append("knownCollabs", v);
  for (const v of merged.tags) params.append("tags", v);
  if (merged.includeNonGaming) params.set("includeNonGaming", "on");
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
 *  - Search is a case-insensitive `contains` on displayName + handle.
 *    tsvector-backed search is available via searchKols() but is not
 *    compatible with cursor pagination; BM1 stays on ILIKE until the
 *    BI4-F005 helper gains pagination support.
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
  if (!filters.includeNonGaming) {
    and.push({ isGaming: true });
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
    const cutoff = new Date(
      Date.now() - filters.lastUploadWithinDays * 86_400_000
    );
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

  return { AND: and };
}

/**
 * Map a sort option to the Prisma orderBy field name used by the cursor
 * paginator. The paginator auto-appends `{ id: direction }` as a stable
 * tie-breaker, so we only return the primary column name.
 */
export function sortToOrderBy(sort: SortOption): {
  field: string;
  direction: "asc" | "desc";
} {
  switch (sort) {
    case "followers":
      return { field: "followerCount", direction: "desc" };
    case "recent":
      return { field: "createdAt", direction: "desc" };
    case "value":
    default:
      return { field: "valueScore", direction: "desc" };
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
