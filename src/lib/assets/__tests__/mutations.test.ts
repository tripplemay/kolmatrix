/**
 * BL-025-F002 · Asset write helper specs (mock-tx layer).
 *
 * Each case exercises one Zod content shape rule, one variant-tree
 * guard, or one mutation flow against a stub Prisma transaction
 * client. The DB-level RLS / FK behaviour is covered by the
 * tests/integration/asset-rls.test.ts (F001) suite.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  archiveAsset,
  AssetNotFoundError,
  AssetVariantDepthError,
  createAsset,
  deleteAsset,
  duplicateAsset,
  updateAsset,
  __TEST_ONLY__,
} from "../mutations";

type AssetTx = Prisma.TransactionClient & {
  asset: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  // BL-025-F006 dual-write target — every email-typed mutation
  // mirrors into email_template so the mocks must absorb the call.
  emailTemplate: {
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

function makeTx(): AssetTx {
  return {
    asset: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailTemplate: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as AssetTx;
}

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";

const validEmail = {
  subject: "Hi",
  body: "Body",
  locale: "en" as const,
  variables: [],
};

const validVideo = {
  title: "Trailer Script",
  script: "Scene 1: Open on the title card",
};

function createdRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    tenantId: TENANT_A,
    productId: null,
    type: "email",
    name: "Test",
    source: "user_created",
    status: "draft",
    parentId: null,
    content: validEmail,
    metadata: {},
    createdBy: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    product: null,
    ...overrides,
  };
}

describe("createAsset", () => {
  it("persists an email asset whose content matches EmailContentSchema", async () => {
    const tx = makeTx();
    tx.asset.create.mockResolvedValueOnce(createdRow());

    const result = await createAsset(tx, TENANT_A, {
      type: "email",
      name: "Welcome",
      content: validEmail,
      source: "user_created",
    });

    expect(result.id).toBe("11111111-1111-1111-1111-111111111111");
    const args = tx.asset.create.mock.calls[0]![0];
    expect(args.data.tenantId).toBe(TENANT_A);
    expect(args.data.content).toEqual(validEmail);
    expect(args.data.status).toBe("draft");
  });

  it("rejects an email asset with the wrong content shape (missing required field)", async () => {
    const tx = makeTx();

    await expect(
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Bad",
        content: { subject: "missing-body", locale: "en" },
        source: "user_created",
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it("persists a video_script asset whose content matches VideoScriptContentSchema", async () => {
    const tx = makeTx();
    tx.asset.create.mockResolvedValueOnce(
      createdRow({ type: "video_script", content: validVideo })
    );

    const result = await createAsset(tx, TENANT_A, {
      type: "video_script",
      name: "Trailer",
      content: validVideo,
      source: "ai_generated",
    });

    expect(result.type).toBe("video_script");
    const args = tx.asset.create.mock.calls[0]![0];
    expect(args.data.content).toEqual(validVideo);
  });

  it("walks the parent chain when parentAssetId is set and persists parentId on the new row", async () => {
    const tx = makeTx();
    const parent = "20000000-0000-0000-0000-000000000001";
    tx.asset.findUnique.mockResolvedValueOnce({ id: parent, parentId: null });
    tx.asset.create.mockResolvedValueOnce(createdRow({ parentId: parent }));

    const result = await createAsset(tx, TENANT_A, {
      type: "email",
      name: "v2",
      content: validEmail,
      source: "user_created",
      parentAssetId: parent,
    });

    expect(tx.asset.findUnique).toHaveBeenCalledWith({
      where: { id: parent },
      select: { id: true, parentId: true },
    });
    expect(tx.asset.create.mock.calls[0]![0].data.parentId).toBe(parent);
    expect(result.parentId).toBe(parent);
  });

  it("throws AssetNotFoundError when parentAssetId references a missing row", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);

    await expect(
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Orphan",
        content: validEmail,
        source: "user_created",
        parentAssetId: "ghost-id",
      })
    ).rejects.toBeInstanceOf(AssetNotFoundError);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it("throws AssetVariantDepthError when the parent chain exceeds MAX_VARIANT_DEPTH", async () => {
    const tx = makeTx();
    // Each lookup returns a row whose parentId is the next id, forming
    // an infinite chain that should bail at MAX_VARIANT_DEPTH + 1.
    tx.asset.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, parentId: `${where.id}-next` })
    );

    await expect(
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Too deep",
        content: validEmail,
        source: "user_created",
        parentAssetId: "deep-0",
      })
    ).rejects.toBeInstanceOf(AssetVariantDepthError);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it("treats a self-referential parent chain as a depth violation (cycle)", async () => {
    const tx = makeTx();
    const id = "deadbeef-0000-0000-0000-000000000000";
    tx.asset.findUnique.mockResolvedValue({ id, parentId: id });

    await expect(
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Cycle",
        content: validEmail,
        source: "user_created",
        parentAssetId: id,
      })
    ).rejects.toBeInstanceOf(AssetVariantDepthError);
    expect(tx.asset.create).not.toHaveBeenCalled();
  });
});

describe("updateAsset", () => {
  it("re-validates content against the existing row's type before update", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "email",
      status: "draft",
    });

    await expect(
      updateAsset(tx, "asset-1", { content: { title: "wrong type" } })
    ).rejects.toBeInstanceOf(ZodError);
    expect(tx.asset.update).not.toHaveBeenCalled();
  });

  it("applies a partial patch (name + status) and returns the hydrated detail", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "email",
      status: "draft",
    });
    tx.asset.update.mockResolvedValueOnce(
      createdRow({ id: "asset-1", name: "Renamed", status: "published" })
    );

    const result = await updateAsset(tx, "asset-1", {
      name: "Renamed",
      status: "published",
    });

    const args = tx.asset.update.mock.calls[0]![0];
    expect(args.data.name).toBe("Renamed");
    expect(args.data.status).toBe("published");
    expect(args.data.content).toBeUndefined();
    expect(result.name).toBe("Renamed");
  });

  it("throws AssetNotFoundError on update for a missing row", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);

    await expect(updateAsset(tx, "ghost", { name: "x" })).rejects.toBeInstanceOf(
      AssetNotFoundError
    );
  });
});

describe("archiveAsset", () => {
  it("delegates to updateAsset with status=archived", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "email",
      status: "published",
    });
    tx.asset.update.mockResolvedValueOnce(createdRow({ id: "asset-1", status: "archived" }));

    const result = await archiveAsset(tx, "asset-1");

    expect(tx.asset.update.mock.calls[0]![0].data.status).toBe("archived");
    expect(result.status).toBe("archived");
  });
});

describe("deleteAsset", () => {
  it("returns true when the row was deleted (and drops the email_template mirror first)", async () => {
    const tx = makeTx();
    // F006 dual-write: deleteAsset reads metadata before deleting.
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "email",
      metadata: {},
    });
    tx.asset.delete.mockResolvedValueOnce({ id: "asset-1" });

    expect(await deleteAsset(tx, "asset-1")).toBe(true);
    expect(tx.emailTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: "asset-1" },
    });
  });

  it("returns false when the asset is already gone and skips email_template delete", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);
    expect(await deleteAsset(tx, "missing")).toBe(false);
    expect(tx.emailTemplate.deleteMany).not.toHaveBeenCalled();
    expect(tx.asset.delete).not.toHaveBeenCalled();
  });

  it("rethrows non-P2025 errors from asset.delete (race-condition path)", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "email",
      metadata: {},
    });
    tx.asset.delete.mockRejectedValueOnce(new Error("boom"));
    await expect(deleteAsset(tx, "asset-1")).rejects.toThrow("boom");
  });

  it("returns false when asset.delete races on P2025 even though findUnique saw the row", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "asset-1",
      type: "video_script",
      metadata: {},
    });
    const p2025 = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "test",
    });
    tx.asset.delete.mockRejectedValueOnce(p2025);
    expect(await deleteAsset(tx, "asset-1")).toBe(false);
  });
});

describe("duplicateAsset", () => {
  it("clones an email asset to a new draft root with a (copy) suffix and mirrors to email_template", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "source-1",
      productId: "prod-1",
      type: "email",
      name: "Welcome v3",
      content: validEmail,
      metadata: { traceId: "trace-x", model: "claude-haiku-4.5" },
    });
    tx.asset.create.mockResolvedValueOnce(
      createdRow({
        id: "copy-1",
        productId: "prod-1",
        name: "Welcome v3 (copy)",
        content: validEmail,
        metadata: {
          traceId: "trace-x",
          model: "claude-haiku-4.5",
          duplicatedFromAssetId: "source-1",
        },
      })
    );

    const result = await duplicateAsset(tx, TENANT_A, "source-1", { createdBy: "user-1" });

    expect(result.name).toBe("Welcome v3 (copy)");
    expect(result.parentId).toBeNull();
    const createCall = tx.asset.create.mock.calls[0]![0];
    expect(createCall.data.parentId).toBeNull();
    expect(createCall.data.source).toBe("user_created");
    expect(createCall.data.status).toBe("draft");
    expect(createCall.data.productId).toBe("prod-1");
    expect(createCall.data.metadata.duplicatedFromAssetId).toBe("source-1");
    expect(createCall.data.metadata.traceId).toBe("trace-x");
    expect(createCall.data.createdBy).toBe("user-1");
    expect(tx.emailTemplate.create).toHaveBeenCalledTimes(1);
  });

  it("clones a video_script asset and skips the email_template mirror", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "source-2",
      productId: "prod-2",
      type: "video_script",
      name: "TikTok hook",
      content: validVideo,
      metadata: {},
    });
    tx.asset.create.mockResolvedValueOnce(
      createdRow({
        id: "copy-2",
        productId: "prod-2",
        type: "video_script",
        name: "TikTok hook (copy)",
        content: validVideo,
      })
    );

    const result = await duplicateAsset(tx, TENANT_A, "source-2");

    expect(result.type).toBe("video_script");
    expect(tx.emailTemplate.create).not.toHaveBeenCalled();
  });

  it("collapses repeated (copy) suffixes so a duplicate-of-a-duplicate stays single-suffixed", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce({
      id: "source-3",
      productId: null,
      type: "email",
      name: "Welcome (copy)",
      content: validEmail,
      metadata: {},
    });
    tx.asset.create.mockResolvedValueOnce(createdRow({ id: "copy-3", name: "Welcome (copy)" }));

    await duplicateAsset(tx, TENANT_A, "source-3");

    const createCall = tx.asset.create.mock.calls[0]![0];
    expect(createCall.data.name).toBe("Welcome (copy)");
  });

  it("throws AssetNotFoundError when the source asset is missing", async () => {
    const tx = makeTx();
    tx.asset.findUnique.mockResolvedValueOnce(null);
    await expect(duplicateAsset(tx, TENANT_A, "missing-source")).rejects.toBeInstanceOf(
      AssetNotFoundError
    );
  });
});

describe("__TEST_ONLY__.parseContent", () => {
  it("invokes the AssetType-keyed schema and surfaces ZodError for the wrong type", () => {
    expect(__TEST_ONLY__.parseContent("email", validEmail)).toEqual(validEmail);
    expect(() => __TEST_ONLY__.parseContent("video_script", validEmail)).toThrow(ZodError);
  });
});
