/**
 * BI4-F004 · createCursorPaginator unit spec
 *
 * Contract covered:
 *   1. First page returns requested limit, hasMore=true, nextCursor set
 *   2. Subsequent page decodes the cursor and skips the cursor row
 *   3. Last page returns hasMore=false, nextCursor=null
 *   4. limit clamped to maxLimit
 *   5. orderBy + direction overrides are passed to the underlying model
 *   6. where filter is forwarded unchanged
 *   7. malformed cursor is ignored (treated as no cursor)
 *   8. encode/decode round-trips a CursorEnvelope
 */
import { describe, expect, it, vi } from "vitest";

import {
  createCursorPaginator,
  decodeCursor,
  encodeCursor,
} from "@/lib/pagination/cursor";

type Row = { id: string; createdAt: Date; followers: number };

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row-${i + 1}`,
    createdAt: new Date(Date.UTC(2026, 0, i + 1)),
    followers: (n - i) * 100,
  }));
}

describe("createCursorPaginator", () => {
  it("returns the first page with hasMore + nextCursor when more rows exist", async () => {
    const data = makeRows(5);
    const model = {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        const take = args.take as number;
        return data.slice(0, take);
      }),
    };

    const paginator = createCursorPaginator<Row>({ model, defaultLimit: 3 });
    const page = await paginator.query();

    expect(model.findMany).toHaveBeenCalledWith({
      where: {},
      take: 4, // limit + 1
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();

    const envelope = decodeCursor(page.nextCursor!);
    expect(envelope).not.toBeNull();
    expect(envelope!.id).toBe("row-3");
    expect(envelope!.sortField).toBe("createdAt");
  });

  it("decodes cursor on subsequent page and sends skip:1 + cursor.id to the model", async () => {
    const data = makeRows(5);
    const model = {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        const cursor = args.cursor as { id: string } | undefined;
        if (cursor) {
          const start = data.findIndex((r) => r.id === cursor.id) + 1;
          return data.slice(start, start + (args.take as number));
        }
        return data.slice(0, args.take as number);
      }),
    };

    const paginator = createCursorPaginator<Row>({ model, defaultLimit: 2 });
    const first = await paginator.query();
    const second = await paginator.query({ cursor: first.nextCursor! });

    // Second page model call carried cursor + skip:1.
    const secondCallArgs = model.findMany.mock.calls[1]![0]!;
    expect(secondCallArgs).toMatchObject({
      cursor: { id: "row-2" },
      skip: 1,
      take: 3,
    });

    expect(second.items.map((r) => r.id)).toEqual(["row-3", "row-4"]);
    expect(second.hasMore).toBe(true);
  });

  it("returns hasMore=false and nextCursor=null when reaching the end", async () => {
    const data = makeRows(3);
    const model = {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        return data.slice(0, args.take as number);
      }),
    };

    const paginator = createCursorPaginator<Row>({ model, defaultLimit: 5 });
    const page = await paginator.query();

    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("caps requested limit at maxLimit", async () => {
    const model = {
      findMany: vi.fn<(args: Record<string, unknown>) => Promise<Row[]>>(async () => []),
    };
    const paginator = createCursorPaginator<Row>({
      model,
      defaultLimit: 20,
      maxLimit: 50,
    });

    await paginator.query({ limit: 9999 });

    // take = clamped-limit + 1 = 50 + 1 = 51
    expect(model.findMany.mock.calls[0]![0]!.take).toBe(51);
  });

  it("forwards orderBy + direction overrides to the model", async () => {
    const model = {
      findMany: vi.fn<(args: Record<string, unknown>) => Promise<Row[]>>(async () => []),
    };
    const paginator = createCursorPaginator<Row>({ model });

    await paginator.query({ orderBy: "followers", direction: "asc", limit: 10 });

    expect(model.findMany.mock.calls[0]![0]!.orderBy).toEqual([
      { followers: "asc" },
      { id: "asc" },
    ]);
  });

  it("forwards the where clause unchanged", async () => {
    const model = {
      findMany: vi.fn<(args: Record<string, unknown>) => Promise<Row[]>>(async () => []),
    };
    const paginator = createCursorPaginator<Row, { tenantId: string }>({ model });

    await paginator.query({ where: { tenantId: "t-1" } });

    expect(model.findMany.mock.calls[0]![0]!.where).toEqual({ tenantId: "t-1" });
  });

  it("ignores a malformed cursor instead of throwing", async () => {
    const model = {
      findMany: vi.fn<(args: Record<string, unknown>) => Promise<Row[]>>(async () => []),
    };
    const paginator = createCursorPaginator<Row>({ model });

    await paginator.query({ cursor: "!!!not-valid-base64!!!" });

    // No cursor / skip reached the model.
    const args = model.findMany.mock.calls[0]![0]!;
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it("encode/decode round-trips a CursorEnvelope", () => {
    const encoded = encodeCursor({
      id: "row-42",
      sortField: "createdAt",
      sortValue: "2026-04-23T00:00:00.000Z",
    });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe base64
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({
      id: "row-42",
      sortField: "createdAt",
      sortValue: "2026-04-23T00:00:00.000Z",
    });
  });
});
