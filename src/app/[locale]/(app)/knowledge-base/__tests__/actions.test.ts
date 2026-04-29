import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn<(path: string, type?: "page" | "layout") => void>();
vi.mock("next/cache", () => ({ revalidatePath }));

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenant = vi.fn<
  (tenantId: string, fn: (tx: unknown) => unknown) => Promise<unknown>
>();
vi.mock("@/lib/db", () => ({ withTenant }));

const logEvent = vi.fn();
vi.mock("@/lib/events/log", () => ({ logEvent }));

const generateAiAssets = vi.fn();
const markAiAssetsPending = vi.fn();
vi.mock("@/lib/products/generateAiAssets", () => ({
  generateAiAssets,
  markAiAssetsPending,
}));

const { deleteProduct, updateProduct } = await import("../actions");

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
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { update },
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

  it("allows a cuid productId through deleteProduct and reaches Prisma", async () => {
    const del = vi.fn().mockResolvedValue({ id: PRODUCT_ID });
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)({
        product: { delete: del },
      })
    );

    const res = await deleteProduct(PRODUCT_ID);

    expect(res).toEqual({ ok: true });
    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(del).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
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

    expect(res).toEqual({ ok: false });
    expect(withTenant).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a blank productId on update without reaching Prisma", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await updateProduct(
      { ok: false },
      buildFormData({ productId: "   " })
    );

    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(withTenant).not.toHaveBeenCalled();
  });
});
