import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countUserTemplates,
  createUserTemplate,
  deleteUserTemplate,
  duplicateUserTemplate,
  loadOutreachTemplates,
  updateUserTemplate,
  type EmailTemplateDraftInput,
} from "../templates";
import { createAsset, deleteAsset, updateAsset } from "@/lib/assets/mutations";
import type { AssetDetail } from "@/lib/assets/types";

// BL-099-F001 — the template write path now delegates to the unified
// Asset write helpers (createAsset / updateAsset / deleteAsset, which
// dual-write the email_template mirror until F005). Their internals are
// covered by mutations.test.ts; here we mock them to assert the
// templates layer's own contract: tenant/source guards, the published
// status that keeps new templates visible, and the AssetDetail →
// EmailTemplateOption adapter.
vi.mock("@/lib/assets/mutations", () => ({
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
}));

const createAssetMock = vi.mocked(createAsset);
const updateAssetMock = vi.mocked(updateAsset);
const deleteAssetMock = vi.mocked(deleteAsset);

type TemplateTx = Prisma.TransactionClient & {
  asset: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

function makeTx(): TemplateTx {
  return {
    asset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as TemplateTx;
}

/** Composer row shape returned by loadAssetsForComposer (test 1). */
function makeAssetRow(opts: {
  id?: string;
  name?: string;
  source?: "ai_generated" | "user_created" | "imported" | "system_seed";
  productId?: string | null;
  productName?: string | null;
  content?: { subject?: string; body?: string; locale?: string; variables?: unknown };
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const at = opts.createdAt ?? new Date("2026-04-30T00:00:00Z");
  return {
    id: opts.id ?? "11111111-1111-1111-1111-111111111111",
    name: opts.name ?? "Base template",
    source: opts.source ?? "system_seed",
    productId: opts.productId ?? null,
    product: opts.productName ? { name: opts.productName } : null,
    content: {
      subject: opts.content?.subject ?? "Hi {{kol.name}}",
      body: opts.content?.body ?? "Hello {{kol.handle}}",
      locale: opts.content?.locale ?? "en",
      variables: opts.content?.variables ?? [],
    },
    createdAt: at,
    updatedAt: opts.updatedAt ?? at,
  };
}

/** AssetDetail shape returned by createAsset / updateAsset (mocked). */
function makeAssetDetail(opts: {
  id?: string;
  tenantId?: string | null;
  name?: string;
  source?: "ai_generated" | "user_created" | "imported" | "system_seed";
  content?: { subject?: string; body?: string; locale?: string; variables?: unknown };
}): AssetDetail {
  const at = new Date("2026-06-09T00:00:00Z");
  return {
    id: opts.id ?? "asset-1",
    tenantId: opts.tenantId ?? "tenant-a",
    productId: null,
    productName: null,
    type: "email",
    name: opts.name ?? "Template",
    source: opts.source ?? "user_created",
    status: "published",
    parentId: null,
    versionIndex: 1,
    totalVariants: 1,
    contentPreview: "",
    updatedAt: at,
    createdAt: at,
    content: {
      subject: opts.content?.subject ?? "Hello",
      body: opts.content?.body ?? "Body",
      locale: opts.content?.locale ?? "en",
      variables: opts.content?.variables ?? [],
    } as Prisma.JsonValue,
    metadata: {},
    createdBy: null,
  };
}

const draft: EmailTemplateDraftInput = {
  name: "Working draft",
  subject: "Hello",
  body: "Body",
  locale: "en",
  variables: [],
};

describe("email templates helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads system and user templates with locale fallback for system rows", async () => {
    const tx = makeTx();
    tx.asset.findMany
      .mockResolvedValueOnce([
        makeAssetRow({
          id: "user-1",
          name: "My Draft",
          source: "user_created",
          content: { subject: "Hi {{kol.name}}", body: "Body", locale: "zh", variables: [] },
        }),
      ])
      .mockResolvedValueOnce([
        makeAssetRow({
          id: "sys-1",
          name: "Fallback EN",
          source: "system_seed",
          content: { subject: "Hi {{kol.name}}", body: "Body", locale: "en", variables: [] },
        }),
      ]);

    const result = await loadOutreachTemplates(tx, "tenant-a", "zh");

    expect(tx.asset.findMany).toHaveBeenCalledTimes(2);
    expect(result.map((r) => r.name)).toEqual(["Fallback EN", "My Draft"]);
    expect(result[0]?.scope).toBe("system");
    expect(result[1]?.scope).toBe("user");
  });

  it("createUserTemplate writes a published user_created email Asset (止活血) and adapts the result", async () => {
    const tx = makeTx();
    createAssetMock.mockResolvedValueOnce(
      makeAssetDetail({
        id: "asset-new",
        source: "user_created",
        name: "Working draft",
        content: { subject: "Hello", body: "Body", locale: "en", variables: [] },
      })
    );

    const created = await createUserTemplate(tx, "tenant-a", draft);

    expect(createAssetMock).toHaveBeenCalledWith(
      tx,
      "tenant-a",
      expect.objectContaining({
        type: "email",
        source: "user_created",
        // published is the fix — without it the new template would be
        // invisible to the composer (status=published filter).
        status: "published",
        name: "Working draft",
        content: { subject: "Hello", body: "Body", locale: "en", variables: [] },
      })
    );
    expect(created.id).toBe("asset-new");
    expect(created.scope).toBe("user");
    expect(created.subject).toBe("Hello");
  });

  it("updateUserTemplate guards system_seed / cross-tenant (→ null) and delegates valid edits to updateAsset", async () => {
    const tx = makeTx();
    // guard miss → null, updateAsset never called
    tx.asset.findFirst.mockResolvedValueOnce(null);
    await expect(updateUserTemplate(tx, "tenant-a", "tpl-x", draft)).resolves.toBeNull();
    expect(updateAssetMock).not.toHaveBeenCalled();

    // guard hit → delegate
    tx.asset.findFirst.mockResolvedValueOnce({ id: "tpl-1" });
    updateAssetMock.mockResolvedValueOnce(
      makeAssetDetail({
        id: "tpl-1",
        source: "user_created",
        name: "Updated",
        content: { subject: "Updated subject", body: "Updated body", locale: "en", variables: [] },
      })
    );
    const updated = await updateUserTemplate(tx, "tenant-a", "tpl-1", draft);
    expect(updated?.name).toBe("Updated");
    const guardWhere = tx.asset.findFirst.mock.calls[1]![0].where;
    expect(guardWhere).toEqual({ id: "tpl-1", type: "email", source: { not: "system_seed" } });
  });

  it("deleteUserTemplate guards then delegates to deleteAsset", async () => {
    const tx = makeTx();
    tx.asset.findFirst.mockResolvedValueOnce(null);
    await expect(deleteUserTemplate(tx, "tenant-a", "tpl-x")).resolves.toBe(false);
    expect(deleteAssetMock).not.toHaveBeenCalled();

    tx.asset.findFirst.mockResolvedValueOnce({ id: "tpl-1" });
    deleteAssetMock.mockResolvedValueOnce(true);
    await expect(deleteUserTemplate(tx, "tenant-a", "tpl-1")).resolves.toBe(true);
    expect(deleteAssetMock).toHaveBeenCalledWith(tx, "tpl-1");
  });

  it("duplicateUserTemplate copies any visible template into a published user_created Asset", async () => {
    const tx = makeTx();
    tx.asset.findFirst.mockResolvedValueOnce({
      name: "System base",
      content: { subject: "Hello {{kol.name}}", body: "Body {{product.name}}", locale: "zh", variables: [] },
    });
    createAssetMock.mockResolvedValueOnce(
      makeAssetDetail({
        id: "dup-1",
        source: "user_created",
        name: "System base Copy",
        content: { subject: "Hello {{kol.name}}", body: "Body {{product.name}}", locale: "zh", variables: [] },
      })
    );

    const duplicated = await duplicateUserTemplate(tx, "tenant-a", "system-1");

    expect(duplicated?.name).toBe("System base Copy");
    expect(duplicated?.locale).toBe("zh");
    expect(createAssetMock).toHaveBeenCalledWith(
      tx,
      "tenant-a",
      expect.objectContaining({
        type: "email",
        source: "user_created",
        status: "published",
        name: "System base Copy",
      })
    );
  });

  it("duplicateUserTemplate returns null when the source template isn't visible", async () => {
    const tx = makeTx();
    tx.asset.findFirst.mockResolvedValueOnce(null);
    await expect(duplicateUserTemplate(tx, "tenant-a", "missing")).resolves.toBeNull();
    expect(createAssetMock).not.toHaveBeenCalled();
  });

  it("countUserTemplates counts published non-system email Assets (matches the composer list)", async () => {
    const tx = makeTx();
    tx.asset.count.mockResolvedValueOnce(3);
    const n = await countUserTemplates(tx);
    expect(n).toBe(3);
    expect(tx.asset.count).toHaveBeenCalledWith({
      where: { type: "email", source: { not: "system_seed" }, status: "published" },
    });
  });
});
