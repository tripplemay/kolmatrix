/**
 * BM1-F004 · Server-side KOL search loader.
 *
 * Called from page.tsx inside a request-scoped tenant transaction.
 * Wraps BI4-F004 createCursorPaginator with the Kol model inside the
 * transaction handle so RLS stays in effect. Returns a plain DTO that
 * the client grid can render without pulling Prisma types into the
 * client bundle.
 *
 * The shape is deliberately boring: `items + nextCursor + hasMore + total`.
 * `total` is a parallel countDocuments call — OK at 2-3k rows; swap to
 * an estimated count once the kol table crosses 10^5 rows.
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";
import {
  buildKolWhere,
  sortToOrderBy,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { createCursorPaginator } from "@/lib/pagination/cursor";

export interface DiscoveryKolCard {
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
  isSaved: boolean;
  isGaming: boolean;
}

export interface DiscoverySearchResult {
  items: DiscoveryKolCard[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

const PAGE_SIZE = 20;

type KolRow = {
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
  isSaved: boolean;
  isGaming: boolean;
  createdAt: Date;
};

export async function runDiscoverySearch(
  tenantId: string,
  filters: DiscoveryFilters
): Promise<DiscoverySearchResult> {
  const where = buildKolWhere(filters);
  const { field, direction } = sortToOrderBy(filters.sort);

  return withTenant(tenantId, async (tx) => {
    const paginator = createCursorPaginator<KolRow, Prisma.KolWhereInput>({
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

    const items: DiscoveryKolCard[] = page.items.map((r) => ({
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
      isSaved: r.isSaved,
      isGaming: r.isGaming,
    }));

    return {
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total,
    };
  });
}
