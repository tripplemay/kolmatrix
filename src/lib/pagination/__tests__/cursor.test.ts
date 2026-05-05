/**
 * BL-035-F012 — cursor paginator orderBy + nulls modifier specs.
 *
 * The paginator now accepts both the bare-string orderBy (back-compat)
 * and the `{ field, nulls }` object form. These specs lock the wire
 * shape of the `findMany` orderBy argument so a future Prisma upgrade
 * cannot silently change NULL handling for value-sorted KOL lists.
 */
import { describe, expect, it, vi } from "vitest";

import { createCursorPaginator } from "@/lib/pagination/cursor";

function createMockModel() {
  const findMany =
    vi.fn<(args: Record<string, unknown>) => Promise<unknown[]>>(async () => []);
  return { model: { findMany }, findMany };
}

describe("createCursorPaginator orderBy shape", () => {
  it("string orderBy stays in the legacy `{ [field]: direction }` shape", async () => {
    const { model, findMany } = createMockModel();
    const paginator = createCursorPaginator({ model, defaultOrderBy: "createdAt" });

    await paginator.query({ orderBy: "createdAt", direction: "desc" });

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("`{ field, nulls: 'last' }` emits Prisma's `{ [field]: { sort, nulls } }` shape", async () => {
    const { model, findMany } = createMockModel();
    const paginator = createCursorPaginator({ model, defaultOrderBy: "valueScore" });

    await paginator.query({
      orderBy: { field: "valueScore", nulls: "last" },
      direction: "desc",
    });

    const args = findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([
      { valueScore: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ]);
  });

  it("`{ field }` (no nulls) collapses to the legacy direction shape", async () => {
    const { model, findMany } = createMockModel();
    const paginator = createCursorPaginator({ model, defaultOrderBy: "valueScore" });

    await paginator.query({
      orderBy: { field: "valueScore" },
      direction: "asc",
    });

    const args = findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([{ valueScore: "asc" }, { id: "asc" }]);
  });

  it("falls back to defaultOrderBy when no orderBy is passed", async () => {
    const { model, findMany } = createMockModel();
    const paginator = createCursorPaginator({ model, defaultOrderBy: "createdAt" });

    await paginator.query({});

    const args = findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("encodes the cursor using the field name regardless of orderBy shape", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${i}`,
      valueScore: 100 - i,
    }));
    const findMany = vi.fn(async () => rows);
    const paginator = createCursorPaginator({
      model: { findMany },
      defaultLimit: 20,
    });

    const page = await paginator.query({
      orderBy: { field: "valueScore", nulls: "last" },
      direction: "desc",
      limit: 20,
    });

    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    // The decoded cursor should reference `valueScore`, not the
    // serialised `{field, nulls}` blob.
    const decoded = JSON.parse(
      Buffer.from(page.nextCursor as string, "base64url").toString("utf8"),
    );
    expect(decoded.sortField).toBe("valueScore");
    expect(decoded.id).toBe("id-19");
  });
});
