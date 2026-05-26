/**
 * BL-065-F001 · Tenant-pool KOL loader for the unified /match workbench.
 *
 * Returns a single row shape (`MatchKolRow`) that is a strict superset of
 * the fields needed by both the card grid (former /discovery
 * KolResultCard — engagementRate, language, tags, isGaming) and the
 * dense table (former /database DatabaseTableClient — relationshipStatus,
 * createdAt). One query → both views → no double round-trip.
 *
 * Pool definition (spec §1 + acceptance #4): apify-kol single-source full
 * pool, valueScore desc default, no isSaved filter. Concretely:
 *   - `includeNonGaming=true` is FORCED here (Match page lists every
 *     non-deleted KOL the tenant has, gaming or not). Any caller-supplied
 *     `includeNonGaming` is ignored on purpose so a stray URL param
 *     cannot silently shrink the workbench.
 *   - All other DiscoveryFilters dimensions (search / regions /
 *     categories / etc.) still flow through `buildKolWhere` unchanged.
 *
 * BL-035-F012 NULL-sink semantic for valueScore sort is preserved via
 * sortToOrderBy (KOLs without a score sink to the bottom).
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import {
  buildKolWhere,
  getDataCoverage,
  getDataFillRates,
  sortToOrderBy,
  type DataCoverage,
  type DataFillRates,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { createCursorPaginator, type OrderBySpec } from "@/lib/pagination/cursor";

export interface MatchKolRow {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
  engagementRate: number | null;
  valueScore: number | null;
  categories: string[];
  tags: string[];
  isGaming: boolean;
  relationshipStatus: string;
  createdAt: string;
}

export interface MatchSearchResult {
  items: MatchKolRow[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

const PAGE_SIZE = 20;

type KolRowShape = {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
  engagementRate: Prisma.Decimal | null;
  valueScore: number | null;
  categories: string[];
  tags: string[];
  isGaming: boolean;
  relationshipStatus: string;
  createdAt: Date;
};

export async function runMatchSearch(
  tenantId: string,
  filters: DiscoveryFilters,
  _coverage?: DataCoverage,
): Promise<MatchSearchResult> {
  // BL-075-F005: the BL-073-F006 early-return (skip SQL when filter
  // touches zero-coverage dim) is withdrawn now that the sidebar
  // surfaces a "Coverage: N%" hint instead of greying the chips out.
  // The marketer reads the hint, understands the partial coverage, and
  // selects the filter on purpose — running the SQL and returning a
  // possibly-small result is the correct UX. `_coverage` kept on the
  // signature so existing call sites stay typed; ignored at runtime.
  void _coverage;

  const baseWhere = buildKolWhere({ ...filters, includeNonGaming: true });
  const andClauses = Array.isArray(baseWhere.AND)
    ? (baseWhere.AND as Prisma.KolWhereInput[])
    : [];
  const where: Prisma.KolWhereInput = {
    AND: [...andClauses, { deletedAt: null }],
  };
  const { field, direction, nulls } = sortToOrderBy(filters.sort);
  const orderBy: OrderBySpec = nulls ? { field, nulls } : field;

  return withTenant(tenantId, async (tx) => {
    const paginator = createCursorPaginator<KolRowShape, Prisma.KolWhereInput>({
      model: tx.kol as unknown as Parameters<typeof createCursorPaginator>[0]["model"],
      defaultOrderBy: field,
      defaultLimit: PAGE_SIZE,
      maxLimit: PAGE_SIZE,
    });

    const [page, total] = await Promise.all([
      paginator.query({
        where,
        cursor: filters.cursor,
        orderBy,
        direction,
        limit: PAGE_SIZE,
      }),
      tx.kol.count({ where }),
    ]);

    const items: MatchKolRow[] = page.items.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      handle: r.handle,
      platform: r.platform,
      avatarUrl: r.avatarUrl,
      countryCode: r.countryCode,
      language: r.language,
      followerCount: r.followerCount,
      engagementRate:
        r.engagementRate == null ? null : Number(r.engagementRate.toString()),
      valueScore: r.valueScore,
      categories: r.categories,
      tags: r.tags,
      isGaming: r.isGaming,
      relationshipStatus: r.relationshipStatus,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total,
    };
  });
}

/**
 * BL-073-F006 — server-side data coverage snapshot for the filter
 * sidebar UX defense. Thin wrapper around `getDataCoverage` so the
 * page only imports from `./search` (match-route locality), and the
 * RLS-aware `withTenant` boundary stays consistent with the rest of
 * the page's DB calls.
 */
export async function loadMatchDataCoverage(tenantId: string) {
  return withTenant(tenantId, (tx) => getDataCoverage(tx));
}

/**
 * BL-075-F005 — per-dimension fill-rate snapshot used by the filter
 * sidebar to render "Coverage: N%" hints. Returned alongside the
 * existing coverage struct so the page can keep the both in one
 * Promise.all without two extra round-trips.
 */
export async function loadMatchDataFillRates(tenantId: string): Promise<DataFillRates> {
  return withTenant(tenantId, (tx) => getDataFillRates(tx));
}
