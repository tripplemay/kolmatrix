// BI4-F004 · Cursor pagination utility.
//
// Why cursor over offset: KOL / email_log tables will cross 10^5 rows
// and offset-pagination degrades to O(n) for later pages. Cursor
// pagination uses an index seek (orderBy + >/<) so performance is flat.
//
// Cursor envelope format (base64url of JSON):
//   { id: string; sortField: string; sortValue: string | number | null }
//
// The cursor is deliberately opaque to the frontend — clients copy it
// back verbatim into the next request. Keeping decoding server-side
// means we can change the internal shape without a client migration.

/**
 * BL-035-F012: orderBy may be a bare column name (back-compat) or an
 * object that also pins NULL placement. Postgres defaults `ORDER BY ...
 * DESC` to `NULLS FIRST`, which surfaces incomplete rows (e.g. mock
 * KOLs with `valueScore = NULL`) at the top of value-sorted lists.
 * Pass `{ field, nulls: 'last' }` to push NULLs out of view without
 * mutating the WHERE clause.
 */
export type OrderBySpec = string | { field: string; nulls?: "first" | "last" };

export interface CursorPaginationParams {
  /** Opaque URL-safe base64 token from the previous page's nextCursor. */
  cursor?: string;
  /** Page size. Clamped to [1, maxLimit]. */
  limit?: number;
  /** Column to sort by; must be stable + indexed. */
  orderBy?: OrderBySpec;
  /** Sort direction. */
  direction?: "asc" | "desc";
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

type PrismaLikeModel = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
};

interface CursorEnvelope {
  id: string;
  sortField: string;
  sortValue: string | number | null;
}

interface PaginatorConfig {
  model: PrismaLikeModel;
  defaultOrderBy?: string;
  defaultLimit?: number;
  maxLimit?: number;
}

interface QueryArgs<TWhere> extends CursorPaginationParams {
  where?: TWhere;
}

export function encodeCursor(envelope: CursorEnvelope): string {
  const json = JSON.stringify(envelope);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorEnvelope | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as CursorEnvelope).id === "string" &&
      typeof (parsed as CursorEnvelope).sortField === "string"
    ) {
      return parsed as CursorEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

export function createCursorPaginator<TModel, TWhere = Record<string, unknown>>(
  config: PaginatorConfig
): {
  query: (args?: QueryArgs<TWhere>) => Promise<CursorPaginationResult<TModel>>;
} {
  const defaultOrderBy = config.defaultOrderBy ?? "createdAt";
  const defaultLimit = config.defaultLimit ?? 20;
  const maxLimit = config.maxLimit ?? 100;

  return {
    async query(args: QueryArgs<TWhere> = {}): Promise<CursorPaginationResult<TModel>> {
      const requestedLimit = args.limit ?? defaultLimit;
      const limit = Math.max(1, Math.min(requestedLimit, maxLimit));
      const orderBy = args.orderBy ?? defaultOrderBy;
      const direction: "asc" | "desc" = args.direction ?? "desc";

      // BL-035-F012: when caller passes the {field, nulls?} object form,
      // emit Prisma's `{ [field]: { sort, nulls } }` shape (Prisma 6+).
      // String form remains unchanged so existing callers keep working.
      const orderField = typeof orderBy === "string" ? orderBy : orderBy.field;
      const orderClause: Record<string, unknown> =
        typeof orderBy === "string"
          ? { [orderBy]: direction }
          : {
              [orderBy.field]: orderBy.nulls
                ? { sort: direction, nulls: orderBy.nulls }
                : direction,
            };

      const findManyArgs: Record<string, unknown> = {
        where: args.where ?? {},
        // +1 so we can detect hasMore without a separate count query.
        take: limit + 1,
        orderBy: [orderClause, { id: direction }],
      };

      if (args.cursor) {
        const envelope = decodeCursor(args.cursor);
        if (envelope) {
          findManyArgs.cursor = { id: envelope.id };
          // skip:1 is required to exclude the cursor row itself.
          findManyArgs.skip = 1;
        }
      }

      const rows = (await config.model.findMany(findManyArgs)) as TModel[];

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const last = items[items.length - 1] as Record<string, unknown>;
        const lastId = String(last.id);
        const rawSortValue = last[orderField];
        const sortValue =
          rawSortValue instanceof Date
            ? rawSortValue.toISOString()
            : typeof rawSortValue === "number" || typeof rawSortValue === "string"
              ? rawSortValue
              : rawSortValue == null
                ? null
                : String(rawSortValue);
        nextCursor = encodeCursor({
          id: lastId,
          sortField: orderField,
          sortValue,
        });
      }

      return { items, nextCursor, hasMore };
    },
  };
}
