/**
 * BM1-F005 · Saved-KOL loader for the /database page.
 *
 * Reuses BM1-F004's buildKolWhere so any filter dim (basic 4 in UI +
 * relationshipStatus bar) automatically composes. We force isSaved=true
 * and drop the isGaming default (saved KOLs may mix gaming + non-gaming
 * creators once the marketer starts curating) by flipping
 * includeNonGaming on in the override. includeNonGaming surfaces in the
 * URL only when the user toggles it on /discovery; /database always
 * shows whatever the tenant has saved.
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import { buildKolWhere, sortToOrderBy, type DiscoveryFilters } from "@/lib/kol/filters";
import { createCursorPaginator } from "@/lib/pagination/cursor";

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
  // Saved candidates span gaming + non-gaming creators; drop the MVP
  // "gaming only" default when composing the where.
  const baseWhere = buildKolWhere({ ...filters, includeNonGaming: true });
  const andClauses = Array.isArray(baseWhere.AND)
    ? (baseWhere.AND as Prisma.KolWhereInput[])
    : [];
  const where: Prisma.KolWhereInput = {
    AND: [...andClauses, { isSaved: true }],
  };
  const { field, direction } = sortToOrderBy(filters.sort);

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
        orderBy: field,
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
