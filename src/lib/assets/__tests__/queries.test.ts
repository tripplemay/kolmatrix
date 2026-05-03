/**
 * BL-025-F002 · Asset query helper specs (mock-tx layer).
 *
 * Mirrors the email/templates.test.ts pattern: stub the Prisma
 * transaction client, assert the query shape we send + how we map
 * the rows back. Real RLS enforcement is covered end-to-end by
 * tests/integration/asset-rls.test.ts (F001) so we don't reseed a
 * Postgres container per query helper.
 */
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  loadAssetDetail,
  loadAssetsForComposer,
  loadAssetsForListing,
  loadProductAssetCounts,
  loadUsedIn,
  loadVariantTree,
  __TEST_ONLY__,
} from "../queries";

type AssetTx = Prisma.TransactionClient & {
  asset: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  emailLog: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

function makeTx(): AssetTx {
  return {
    asset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    emailLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as AssetTx;
}

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "aaaaaaaa-0000-0000-0000-000000000001",
  productId: null,
  type: "email" as const,
  name: "Welcome Email",
  source: "ai_generated" as const,
  status: "published" as const,
  parentId: null,
  content: {
    subject: "Hi {{kol.name}}",
    body: "Body text",
    locale: "en",
    variables: [],
  },
  metadata: {},
  createdBy: null,
  createdAt: new Date("2026-04-30T00:00:00Z"),
  updatedAt: new Date("2026-05-01T00:00:00Z"),
  product: null,
};

describe("loadAssetsForListing", () => {
  it("clamps an oversized limit to MAX_PAGE_SIZE and orders by updatedAt desc by default", async () => {
    const tx = makeTx();
    tx.asset.findMany
      .mockResolvedValueOnce([baseRow]) // listing query
      .mockResolvedValueOnce([{ id: baseRow.id, parentId: null, createdAt: baseRow.createdAt }]); // variant info
    tx.asset.count.mockResolvedValueOnce(1);

    const result = await loadAssetsForListing(tx, {}, { limit: 9999 });

    const findManyArgs = tx.asset.findMany.mock.calls[0]![0];
    expect(findManyArgs.take).toBe(__TEST_ONLY__.MAX_PAGE_SIZE + 1);
    expect(findManyArgs.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(baseRow.id);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("translates filter combos (productId / types / status / sources / search) into a Prisma where", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    tx.asset.count.mockResolvedValueOnce(0);

    await loadAssetsForListing(
      tx,
      {
        productId: "prod-1",
        types: ["email", "video_script"],
        status: "draft",
        sources: ["ai_generated", "user_created"],
        search: "  Welcome  ",
      },
      {}
    );

    const where = tx.asset.findMany.mock.calls[0]![0].where;
    expect(where).toEqual({
      productId: "prod-1",
      type: { in: ["email", "video_script"] },
      status: "draft",
      source: { in: ["ai_generated", "user_created"] },
      name: { contains: "Welcome", mode: "insensitive" },
    });
  });

  it("emits a nextCursor + hasMore=true when the page is full", async () => {
    const tx = makeTx();
    const limit = 2;
    const rows = Array.from({ length: limit + 1 }, (_, i) => ({
      ...baseRow,
      id: `00000000-0000-0000-0000-00000000000${i}`,
      updatedAt: new Date(`2026-05-0${i + 1}T00:00:00Z`),
    }));
    tx.asset.findMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(
        rows.map((r) => ({ id: r.id, parentId: null, createdAt: r.createdAt }))
      );
    tx.asset.count.mockResolvedValueOnce(rows.length);

    const result = await loadAssetsForListing(tx, {}, { limit, sort: "recent" });

    expect(result.items).toHaveLength(limit);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTypeOf("string");
    expect(result.nextCursor).not.toBe("");
  });

  it("supports name + type sort variants", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValue([]);
    tx.asset.count.mockResolvedValue(0);

    await loadAssetsForListing(tx, {}, { sort: "name" });
    const nameOrderBy = tx.asset.findMany.mock.calls[0]![0].orderBy;
    expect(nameOrderBy).toEqual([{ name: "asc" }, { id: "asc" }]);

    tx.asset.findMany.mockClear();
    tx.asset.count.mockClear();
    tx.asset.findMany.mockResolvedValue([]);
    tx.asset.count.mockResolvedValue(0);

    await loadAssetsForListing(tx, {}, { sort: "type" });
    const typeOrderBy = tx.asset.findMany.mock.calls[0]![0].orderBy;
    expect(typeOrderBy).toEqual([{ type: "asc" }, { updatedAt: "desc" }, { id: "desc" }]);
  });

  it("annotates versionIndex / totalVariants from the sibling chain", async () => {
    const tx = makeTx();
    const rootId = "20000000-0000-0000-0000-000000000001";
    const childA = "20000000-0000-0000-0000-000000000002";
    const childB = "20000000-0000-0000-0000-000000000003";
    const childRow = {
      ...baseRow,
      id: childB,
      parentId: rootId,
      createdAt: new Date("2026-05-01T03:00:00Z"),
    };
    tx.asset.findMany.mockResolvedValueOnce([childRow]).mockResolvedValueOnce([
      { id: rootId, parentId: null, createdAt: new Date("2026-05-01T01:00:00Z") },
      { id: childA, parentId: rootId, createdAt: new Date("2026-05-01T02:00:00Z") },
      { id: childB, parentId: rootId, createdAt: new Date("2026-05-01T03:00:00Z") },
    ]);
    tx.asset.count.mockResolvedValueOnce(1);

    const result = await loadAssetsForListing(tx, {}, {});

    expect(result.items[0]!.totalVariants).toBe(3);
    expect(result.items[0]!.versionIndex).toBe(3);
  });
});

describe("loadAssetDetail", () => {
  it("returns null when the asset id is unknown", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);

    const result = await loadAssetDetail(tx, "missing-id");
    expect(result).toBeNull();
  });

  it("hydrates content + metadata + a content preview for an existing row", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(baseRow);
    tx.asset.findMany.mockResolvedValueOnce([
      { id: baseRow.id, parentId: null, createdAt: baseRow.createdAt },
    ]);

    const result = await loadAssetDetail(tx, baseRow.id);
    expect(result).not.toBeNull();
    expect(result!.content).toBe(baseRow.content);
    expect(result!.metadata).toBe(baseRow.metadata);
    expect(result!.contentPreview).toContain("Hi {{kol.name}}");
  });
});

describe("loadAssetsForComposer", () => {
  it("queries published email assets, includes locale JSON path filter, caps at COMPOSER_MAX_RESULTS, orders by source then updatedAt", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValueOnce([
      {
        id: baseRow.id,
        name: baseRow.name,
        content: baseRow.content,
        source: "system_seed" as const,
        productId: null,
        product: null,
      },
    ]);

    const rows = await loadAssetsForComposer(tx, "email", "en");

    const args = tx.asset.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({
      type: "email",
      status: "published",
      content: { path: ["locale"], equals: "en" },
    });
    expect(args.take).toBe(__TEST_ONLY__.COMPOSER_MAX_RESULTS);
    expect(args.orderBy).toEqual([{ source: "asc" }, { updatedAt: "desc" }]);
    expect(rows[0]).toMatchObject({
      id: baseRow.id,
      subject: "Hi {{kol.name}}",
      body: "Body text",
      locale: "en",
      source: "system_seed",
    });
  });

  it("omits the content.locale predicate when no locale is passed (cross-locale composer call)", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValueOnce([]);

    await loadAssetsForComposer(tx, "email");

    const where = tx.asset.findMany.mock.calls[0]![0].where;
    expect(where).toEqual({ type: "email", status: "published" });
  });

  // BL-027-F006.D · S4 Soft-watch backfill — search + productId filter
  // params reach the Prisma where as ILIKE name match + exact productId.
  it("translates a search arg into ILIKE name match (insensitive contains, trimmed)", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValueOnce([]);

    await loadAssetsForComposer(tx, "email", "en", "  Welcome  ");

    const where = tx.asset.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      type: "email",
      status: "published",
      name: { contains: "Welcome", mode: "insensitive" },
    });
    expect(where.content).toEqual({ path: ["locale"], equals: "en" });
  });

  it("translates a productId arg into an exact productId predicate (compound with locale + search)", async () => {
    const tx = makeTx();
    tx.asset.findMany.mockResolvedValueOnce([]);

    await loadAssetsForComposer(tx, "email", "en", "intro", "prod-42");

    const where = tx.asset.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      type: "email",
      status: "published",
      productId: "prod-42",
      name: { contains: "intro", mode: "insensitive" },
    });
  });
});

describe("loadVariantTree", () => {
  it("returns [] when the asset id does not exist", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);

    const tree = await loadVariantTree(tx, "missing");
    expect(tree).toEqual([]);
  });

  it("walks parentId to the root + collects descendants and returns versionIndex by createdAt", async () => {
    const tx = makeTx();
    const root = "30000000-0000-0000-0000-000000000001";
    const child1 = "30000000-0000-0000-0000-000000000002";
    const child2 = "30000000-0000-0000-0000-000000000003";

    // walkUp: child2 → root
    tx.asset.findUnique
      .mockResolvedValueOnce({ id: child2, parentId: root })
      .mockResolvedValueOnce({ id: root, parentId: null });

    // collect: layer 1 (root only), then children of root
    tx.asset.findMany
      .mockResolvedValueOnce([
        {
          id: root,
          parentId: null,
          name: "Root v1",
          source: "ai_generated",
          status: "published",
          createdAt: new Date("2026-04-30T00:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([{ id: child1 }, { id: child2 }])
      .mockResolvedValueOnce([
        {
          id: child1,
          parentId: root,
          name: "Child A",
          source: "user_created",
          status: "published",
          createdAt: new Date("2026-05-01T00:00:00Z"),
        },
        {
          id: child2,
          parentId: root,
          name: "Child B",
          source: "ai_generated",
          status: "draft",
          createdAt: new Date("2026-05-02T00:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    const tree = await loadVariantTree(tx, child2);
    expect(tree.map((n) => n.id)).toEqual([root, child1, child2]);
    expect(tree.map((n) => n.versionIndex)).toEqual([1, 2, 3]);
  });
});

describe("loadUsedIn", () => {
  it("counts email_log refs by both the asset's id and its migrated_from_email_template_id", async () => {
    const tx = makeTx();
    const assetId = "40000000-0000-0000-0000-000000000001";
    const legacyId = "40000000-0000-0000-0000-000000000099";
    tx.asset.findUnique.mockResolvedValueOnce({
      id: assetId,
      metadata: { migrated_from_email_template_id: legacyId },
    });
    tx.emailLog.count.mockResolvedValueOnce(7);
    tx.emailLog.findMany.mockResolvedValueOnce([
      {
        id: "log-1",
        createdAt: new Date("2026-05-01T00:00:00Z"),
        campaignId: "campaign-1",
        kolId: "kol-1",
      },
    ]);

    const result = await loadUsedIn(tx, assetId);

    const countWhere = tx.emailLog.count.mock.calls[0]![0].where;
    expect(countWhere.templateId.in.sort()).toEqual([assetId, legacyId].sort());
    expect(result.total).toBe(7);
    expect(result.recent[0]!.resourceId).toBe("log-1");
    expect(result.recent[0]!.resourceType).toBe("email_log");
  });

  it("returns the empty summary for an unknown asset id (no email_log fan-out)", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);

    const result = await loadUsedIn(tx, "missing");
    expect(result).toEqual({ total: 0, recent: [] });
    expect(tx.emailLog.count).not.toHaveBeenCalled();
    expect(tx.emailLog.findMany).not.toHaveBeenCalled();
  });
});

describe("__TEST_ONLY__ helpers", () => {
  it("previewFromContent collapses email subject + body, video title + script, and ignores garbage shapes", () => {
    expect(
      __TEST_ONLY__.previewFromContent("email", {
        subject: "S",
        body: "B",
      })
    ).toBe("S — B");
    expect(
      __TEST_ONLY__.previewFromContent("video_script", {
        title: "T",
        script: "Sc",
      })
    ).toBe("T — Sc");
    expect(__TEST_ONLY__.previewFromContent("email", null)).toBe("");
    expect(__TEST_ONLY__.previewFromContent("email", [])).toBe("");
  });
});

// BL-030-F002 — loadProductAssetCounts powers the KB grid chips. The
// helper runs a single Prisma groupBy and shapes the result into a
// Map<productId, {emailCount, videoCount}>. Mock the tx so we can
// assert: (a) the where clause filters status=published + productId
// in the input list; (b) every productId in the input lands in the
// returned Map even when no Asset rows match (default {0,0}); (c)
// types collapse correctly when both email + video_script rows exist
// for the same product.
describe("loadProductAssetCounts", () => {
  it("returns an empty Map and skips the DB roundtrip when productIds is empty", async () => {
    const tx = makeTx();

    const result = await loadProductAssetCounts(tx, []);

    expect(result.size).toBe(0);
    expect(tx.asset.groupBy).not.toHaveBeenCalled();
  });

  it("aggregates email + video_script counts per product and zero-fills missing rows", async () => {
    const tx = makeTx();
    tx.asset.groupBy.mockResolvedValueOnce([
      { productId: "p1", type: "email", _count: { _all: 3 } },
      { productId: "p1", type: "video_script", _count: { _all: 2 } },
      { productId: "p2", type: "email", _count: { _all: 1 } },
      // p3 has no rows — should still appear in the Map with {0,0}.
    ]);

    const result = await loadProductAssetCounts(tx, ["p1", "p2", "p3"]);

    expect(result.get("p1")).toEqual({ emailCount: 3, videoCount: 2 });
    expect(result.get("p2")).toEqual({ emailCount: 1, videoCount: 0 });
    expect(result.get("p3")).toEqual({ emailCount: 0, videoCount: 0 });

    const args = tx.asset.groupBy.mock.calls[0]![0];
    expect(args.by).toEqual(["productId", "type"]);
    expect(args.where).toEqual({
      productId: { in: ["p1", "p2", "p3"] },
      status: "published",
    });
  });

  it("ignores groupBy rows whose productId is null (system_seed without product binding)", async () => {
    const tx = makeTx();
    tx.asset.groupBy.mockResolvedValueOnce([
      { productId: null, type: "email", _count: { _all: 5 } },
      { productId: "p1", type: "email", _count: { _all: 1 } },
    ]);

    const result = await loadProductAssetCounts(tx, ["p1"]);

    // Only p1 entry exists; the null-productId row didn't bleed in.
    expect(result.size).toBe(1);
    expect(result.get("p1")).toEqual({ emailCount: 1, videoCount: 0 });
  });
});
