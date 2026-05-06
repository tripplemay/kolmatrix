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

import { runSemanticKolSearch } from "@/lib/discovery/semantic-search";
import { withTenant } from "@/lib/db";
import {
  buildKolWhere,
  sortToOrderBy,
  type DiscoveryFilters,
} from "@/lib/kol/filters";
import { createCursorPaginator, type OrderBySpec } from "@/lib/pagination/cursor";

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
  const { field, direction, nulls } = sortToOrderBy(filters.sort);
  // BL-035-F012: pass `{ field, nulls: 'last' }` when the sort column
  // can be NULL (valueScore on mock KOL seeds). Other sorts pass the
  // bare string so the paginator's existing shape stays unchanged.
  const orderBy: OrderBySpec = nulls ? { field, nulls } : field;

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
        orderBy,
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

/**
 * BL-044 F002 · Semantic search variant.
 *
 * Runs `runSemanticKolSearch` to get a cosine-ordered list of KOL ids,
 * then hydrates them to `DiscoveryKolCard[]` while preserving the
 * cosine order (Prisma `IN (kolIds)` returns rows in arbitrary order,
 * so we re-sort client-side via a Map<id, row> lookup).
 *
 * Pre-impl audit decisions applied here:
 *   - #4:B Soft override — sidebar filters do NOT participate in the
 *     cosine query; the SQL has only `embedding IS NOT NULL AND
 *     deleted_at IS NULL AND is_suspicious=false` filters, which means
 *     categories/regions/etc. are *visually* present in the URL but
 *     functionally bypassed during AI search. Sidebar UI greys them out
 *     in step 8 so the user understands why they have no effect.
 *   - First iteration returns the full top-K (no pagination): nextCursor
 *     null, hasMore false, total = items.length. SaveSearch (D9 / #11:A)
 *     does not persist aiQuery so this branch is reached only via a fresh
 *     `?ai=` URL.
 *
 * Throws `SemanticSearchError` (from semantic-search.ts) on validation /
 * rate-limit / embed / DB failures. Callers (page.tsx) catch
 * `code=EMBED_FAILED` and fall through to ILIKE per pre-impl #12:B.
 */
export async function runSemanticDiscoverySearch(
  tenantId: string,
  filters: DiscoveryFilters,
): Promise<DiscoverySearchResult> {
  if (!filters.aiQuery) {
    throw new Error("runSemanticDiscoverySearch requires filters.aiQuery to be set");
  }

  const search = await runSemanticKolSearch({
    tenantId,
    queryText: filters.aiQuery,
  });

  if (search.kolIds.length === 0) {
    return { items: [], nextCursor: null, hasMore: false, total: 0 };
  }

  return withTenant(tenantId, async (tx) => {
    const rows = await tx.kol.findMany({
      where: {
        id: { in: search.kolIds },
        // Defense-in-depth: the cosine SQL already filters these but
        // the hydration query repeats them so a subsequent schema
        // tweak in semantic-search.ts cannot leak hidden rows here.
        deletedAt: null,
        isSuspicious: false,
      },
      select: {
        id: true,
        displayName: true,
        handle: true,
        platform: true,
        avatarUrl: true,
        countryCode: true,
        language: true,
        followerCount: true,
        engagementRate: true,
        valueScore: true,
        categories: true,
        tags: true,
        isSaved: true,
        isGaming: true,
      },
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    const items: DiscoveryKolCard[] = [];
    for (const id of search.kolIds) {
      const r = byId.get(id);
      if (!r) continue; // hydration filter dropped the row (e.g. tenant boundary)
      items.push({
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
      });
    }

    return {
      items,
      nextCursor: null,
      hasMore: false,
      total: items.length,
    };
  });
}
