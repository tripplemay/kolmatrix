import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn<(path: string, type?: "page" | "layout") => void>();
vi.mock("next/cache", () => ({ revalidatePath }));

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenant = vi.fn<(tenantId: string, fn: (tx: unknown) => unknown) => Promise<unknown>>();
vi.mock("@/lib/db", () => ({ withTenant }));

const logEvent = vi.fn();
vi.mock("@/lib/events/log", () => ({ logEvent }));

const generateAiAssets = vi.fn();
const markAiAssetsPending = vi.fn();
vi.mock("@/lib/products/generateAiAssets", () => ({
  generateAiAssets,
  markAiAssetsPending,
}));

const { deleteProduct, updateProduct, triggerAiGeneration } = await import("../actions");

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PRODUCT_ID = "cmab12cd30001g8l5h3n2q9rs";

function buildFormData(
  overrides: Partial<
    Record<
      | "productId"
      | "name"
      | "category"
      | "targetAudience"
      | "uniqueSellingPoints"
      | "downloadUrl"
      | "launchDate",
      string
    >
  > = {}
): FormData {
  const fd = new FormData();
  fd.set("productId", overrides.productId ?? PRODUCT_ID);
  fd.set("name", overrides.name ?? "Honor of Kings");
  fd.set("category", overrides.category ?? "MOBA");
  fd.set("targetAudience", overrides.targetAudience ?? "Mobile gamers");
  fd.set("uniqueSellingPoints", overrides.uniqueSellingPoints ?? "Daily tournaments");
  fd.set("downloadUrl", overrides.downloadUrl ?? "https://example.com/download");
  fd.set("launchDate", overrides.launchDate ?? "2026-04-29");
  return fd;
}

beforeEach(() => {
  revalidatePath.mockReset();
  authMock.mockReset();
  withTenant.mockReset();
  logEvent.mockReset();
  generateAiAssets.mockReset();
  markAiAssetsPending.mockReset();
});

describe("knowledge-base product actions", () => {
  it("allows a cuid productId through updateProduct and reaches Prisma", async () => {
    const update = vi.fn().mockResolvedValue({
      id: PRODUCT_ID,
      name: "Honor of Kings",
      category: "MOBA",
      targetAudience: "Mobile gamers",
      uniqueSellingPoints: "Daily tournaments",
      downloadUrl: "https://example.com/download",
    });
    // BL-035-F005 + BL-051a-F007: ownership preflight runs `findFirst`
    // (with deletedAt: null guard) before update.
    const findFirst = vi
      .fn()
      .mockResolvedValue({ id: PRODUCT_ID, tenantId: TENANT_ID });
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst, update },
      })
    );

    const res = await updateProduct({ ok: false }, buildFormData());

    expect(res).toEqual({ ok: true, productId: PRODUCT_ID });
    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: {
        name: "Honor of Kings",
        category: "MOBA",
        targetAudience: "Mobile gamers",
        uniqueSellingPoints: "Daily tournaments",
        downloadUrl: "https://example.com/download",
        launchDate: new Date("2026-04-29"),
      },
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "product.updated",
        tenantId: TENANT_ID,
        actorId: USER_ID,
        resourceId: PRODUCT_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/knowledge-base", "page");
    expect(markAiAssetsPending).not.toHaveBeenCalled();
    expect(generateAiAssets).not.toHaveBeenCalled();
  });

  it("allows a cuid productId through deleteProduct and soft-deletes the row", async () => {
    // BL-051a-F008 — deleteProduct now performs UPDATE deletedAt=NOW()
    // instead of DELETE; a no-references row passes straight through.
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi
      .fn()
      .mockResolvedValue({
        id: PRODUCT_ID,
        tenantId: TENANT_ID,
        name: "Honor of Kings",
      });
    const campaignCount = vi.fn().mockResolvedValue(0);
    const assetCount = vi.fn().mockResolvedValue(0);
    const kolCampaignCount = vi.fn().mockResolvedValue(0);
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst, update },
        campaign: { count: campaignCount },
        asset: { count: assetCount },
        kolCampaign: { count: kolCampaignCount },
      })
    );

    const res = await deleteProduct(PRODUCT_ID);

    expect(res).toEqual({
      ok: true,
      cascadeCount: { campaign: 0, asset: 0, kolCampaign: 0 },
    });
    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "product.deleted",
        tenantId: TENANT_ID,
        actorId: USER_ID,
        resourceId: PRODUCT_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/knowledge-base", "page");
  });

  it("still rejects updateProduct when tenantId is not a UUID", async () => {
    authMock.mockResolvedValue({ user: { tenantId: "not-a-uuid", id: USER_ID } });

    const res = await updateProduct({ ok: false }, buildFormData());

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still rejects deleteProduct when tenantId is not a UUID", async () => {
    authMock.mockResolvedValue({ user: { tenantId: "not-a-uuid", id: USER_ID } });

    const res = await deleteProduct(PRODUCT_ID);

    // BL-051a-F008 — error code is now explicit ("unauthorized") so
    // the UI can distinguish input-validation vs ownership failures
    // from has_references / not_found / generic.
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a blank productId on update without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await updateProduct({ ok: false }, buildFormData({ productId: "   " }));

    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  // ----- triggerAiGeneration (MVP-vf C-05.2) -----------------------------

  it("triggerAiGeneration fires generateAiAssets for a known product", async () => {
    // BL-051a-F007: triggerAiGeneration now uses findFirst with a
    // deletedAt: null guard so soft-deleted products can't trigger AI
    // spend.
    const findFirst = vi.fn().mockResolvedValue({
      id: PRODUCT_ID,
      name: "Pokemon Go",
      category: "AR/Casual",
      targetAudience: "All ages",
      uniqueSellingPoints: "AR-first gameplay",
      downloadUrl: null,
    });
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst },
      })
    );

    const res = await triggerAiGeneration(PRODUCT_ID);

    expect(res).toEqual({ ok: true });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PRODUCT_ID, deletedAt: null },
      })
    );
    expect(markAiAssetsPending).toHaveBeenCalledWith(TENANT_ID, PRODUCT_ID);
    expect(generateAiAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT_ID,
        tenantId: TENANT_ID,
        name: "Pokemon Go",
      })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "product.ai_generate_requested",
        tenantId: TENANT_ID,
        actorId: USER_ID,
        resourceId: PRODUCT_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/knowledge-base", "page");
  });

  it("triggerAiGeneration returns not_found when the product is missing or soft-deleted", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst: vi.fn().mockResolvedValue(null) },
      })
    );

    const res = await triggerAiGeneration(PRODUCT_ID);

    expect(res).toEqual({ ok: false, error: "not_found" });
    expect(generateAiAssets).not.toHaveBeenCalled();
    expect(markAiAssetsPending).not.toHaveBeenCalled();
  });

  it("triggerAiGeneration rejects when tenantId is not a UUID", async () => {
    authMock.mockResolvedValue({ user: { tenantId: "not-a-uuid", id: USER_ID } });

    const res = await triggerAiGeneration(PRODUCT_ID);

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
    expect(generateAiAssets).not.toHaveBeenCalled();
  });

  // ----- BL-020-F001: PRODUCT_ID_RE (CUID format) negative cases ------

  it("updateProduct rejects a non-CUID productId without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await updateProduct(
      { ok: false },
      buildFormData({ productId: "xxx-not-a-cuid" })
    );

    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("deleteProduct rejects a path-traversal productId without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await deleteProduct("../../../etc/passwd");

    // BL-051a-F008: invalid input now collapses into the unauthorized
    // branch (input validation runs alongside auth so the same shape
    // covers both classes of pre-Prisma rejections).
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("triggerAiGeneration rejects a SQL-injection-shaped productId without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await triggerAiGeneration(
      "cmab12cd30001g8l5h3n2q9r'; DROP TABLE product; --"
    );

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
    expect(generateAiAssets).not.toHaveBeenCalled();
  });

  it("deleteProduct rejects a non-string productId (number coerced) without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await deleteProduct(12345 as unknown as string);

    // BL-051a-F008: see path-traversal case above; non-string input
    // takes the same unauthorized branch.
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  // BL-035-F005 (API-H3) — ownership preflight defence-in-depth.
  // BL-051a-F007 — preflight now uses findFirst with deletedAt: null.
  it("updateProduct returns not_found when findFirst surfaces a row owned by another tenant", async () => {
    const update = vi.fn();
    const findFirst = vi
      .fn()
      .mockResolvedValue({ id: PRODUCT_ID, tenantId: "00000000-1111-2222-3333-444444444444" });
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst, update },
      }),
    );

    const res = await updateProduct({ ok: false }, buildFormData());

    expect(res).toEqual({ ok: false, error: "not_found" });
    expect(update).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("deleteProduct returns not_found when findFirst surfaces a row owned by another tenant", async () => {
    const update = vi.fn();
    const findFirst = vi.fn().mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: "00000000-1111-2222-3333-444444444444",
      name: "Cross Tenant",
    });
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst, update },
        campaign: { count: vi.fn() },
        asset: { count: vi.fn() },
        kolCampaign: { count: vi.fn() },
      }),
    );

    const res = await deleteProduct(PRODUCT_ID);

    expect(res).toEqual({ ok: false, error: "not_found" });
    expect(update).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("deleteProduct returns not_found when findFirst returns null (RLS hides the row OR already soft-deleted)", async () => {
    const update = vi.fn();
    const findFirst = vi.fn().mockResolvedValue(null);
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { findFirst, update },
        campaign: { count: vi.fn() },
        asset: { count: vi.fn() },
        kolCampaign: { count: vi.fn() },
      }),
    );

    const res = await deleteProduct(PRODUCT_ID);

    expect(res).toEqual({ ok: false, error: "not_found" });
    expect(update).not.toHaveBeenCalled();
  });
});
