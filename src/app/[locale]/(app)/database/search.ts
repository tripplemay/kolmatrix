/**
 * BM1-F005 · Tenant-pool KOL loader for the /database page.
 *
 * BL-063 F003: pool widened from "isSaved=true" to all non-soft-deleted
 * KOLs (ADR-013 deprecates the saved/discovered split). /database is
 * scheduled for removal in BL-064 IA rework; until then it lists the
 * full tenant pool. Drops the isGaming default by flipping
 * includeNonGaming on (non-gaming creators belong in the pool too);
 * other filters compose via BM1-F004's buildKolWhere.
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import { buildKolWhere, sortToOrderBy, type DiscoveryFilters } from "@/lib/kol/filters";
import { createCursorPaginator, type OrderBySpec } from "@/lib/pagination/cursor";

export interface DatabaseKolRow {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  countryCode: string | null;
  followerCount: number;
  categories: string[];
  valueScore: number | null;
  relationshipStatus: string;
  createdAt: string;
}

export interface DatabaseSearchResult {
  items: DatabaseKolRow[];
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
  followerCount: number;
  categories: string[];
  valueScore: number | null;
  relationshipStatus: string;
  createdAt: Date;
};

export async function runDatabaseSearch(
  tenantId: string,
  filters: DiscoveryFilters
): Promise<DatabaseSearchResult> {
  // Tenant pool spans gaming + non-gaming creators; drop the MVP
  // "gaming only" default when composing the where.
  const baseWhere = buildKolWhere({ ...filters, includeNonGaming: true });
  const andClauses = Array.isArray(baseWhere.AND)
    ? (baseWhere.AND as Prisma.KolWhereInput[])
    : [];
  const where: Prisma.KolWhereInput = {
    AND: [...andClauses, { deletedAt: null }],
  };
  const { field, direction, nulls } = sortToOrderBy(filters.sort);
  // BL-035-F012: same NULL-sink fix as discovery — saved KOLs without a
  // valueScore should not crown the database list when sort='value'.
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

    const items: DatabaseKolRow[] = page.items.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      handle: r.handle,
      platform: r.platform,
      avatarUrl: r.avatarUrl,
      countryCode: r.countryCode,
      followerCount: r.followerCount,
      categories: r.categories,
      valueScore: r.valueScore,
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
