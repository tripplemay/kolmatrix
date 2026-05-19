/**
 * BL-051a-F010 · Unit tests for the soft-delete contract introduced
 * in F008 — exercises `deleteProduct` against a mocked Prisma tx so
 * the test stays jsdom-only and doesn't need a Postgres pool.
 *
 * Covered cases (≥4 per spec acceptance):
 *   1. No references + no confirmCascade → soft delete + audit_log row
 *   2. Has references without confirmCascade → 'has_references' result
 *      with full count breakdown, NO product mutation
 *   3. Has references WITH confirmCascade → soft delete proceeds + audit
 *   4. Already-deleted product (deletedAt non-null) reads as not_found
 *      (idempotent surface)
 *   5. Audit row payload carries soft_delete: true + cascade counts so
 *      F011's "audit log permanence" test has stable shape to assert on
 *
 * The mocked tx is a plain object whose methods return promises;
 * `withTenant` is replaced with a passthrough that immediately invokes
 * the callback. logAudit / logEvent / revalidatePath are spies so
 * we can assert side-effect contracts without DB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

interface MockTx {
  product: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  campaign: { count: ReturnType<typeof vi.fn> };
  asset: { count: ReturnType<typeof vi.fn> };
  kolCampaign: { count: ReturnType<typeof vi.fn> };
}

let mockTx: MockTx;

vi.mock("@/lib/db", () => ({
  withTenant: async <T,>(_tenantId: string, cb: (tx: MockTx) => Promise<T>) =>
    cb(mockTx),
}));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

vi.mock("@/lib/assets/queries", () => ({
  loadProductAssets: vi.fn(),
}));

vi.mock("@/lib/products/generateAiAssets", () => ({
  generateAiAssets: vi.fn(),
  markAiAssetsPending: vi.fn(),
}));

const { deleteProduct } = await import("@/app/[locale]/(app)/brief/actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
// Product.id uses cuid (`c` + 24+ lowercase alphanum), per the
// PRODUCT_ID_RE in actions.ts. UUIDs would be rejected at normalisation.
const PRODUCT_ID = "claaaaaaaaaaaaaaaaaaaaaaaaaa";

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({
    user: { tenantId: TENANT, id: USER },
  });
  mockTx = {
    product: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    campaign: { count: vi.fn().mockResolvedValue(0) },
    asset: { count: vi.fn().mockResolvedValue(0) },
    kolCampaign: { count: vi.fn().mockResolvedValue(0) },
  };
  logAuditMock.mockReset().mockResolvedValue(undefined);
  logEventMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("deleteProduct (BL-051a-F008)", () => {
  it("soft-deletes a referenced-by-nothing product and writes audit_log", async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: TENANT,
      name: "Honor of Kings",
    });

    const result = await deleteProduct(PRODUCT_ID);
    expect(result).toEqual({
      ok: true,
      cascadeCount: { campaign: 0, asset: 0, kolCampaign: 0 },
    });
    // Soft delete = update with deletedAt, NOT delete().
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { deletedAt: expect.any(Date) },
    });
    // findFirst (not findUnique) so the deletedAt: null guard layers
    // on top of the unique id constraint.
    expect(mockTx.product.findFirst).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, deletedAt: null },
      select: { id: true, tenantId: true, name: true },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.deleted",
        targetType: "product",
        targetId: PRODUCT_ID,
        after: {
          productName: "Honor of Kings",
          cascadeCount: { campaign: 0, asset: 0, kolCampaign: 0 },
          softDelete: true,
        },
      })
    );
  });

  it("returns has_references when refs exist and the caller did not confirm cascade", async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: TENANT,
      name: "Valorant",
    });
    mockTx.campaign.count.mockResolvedValue(2);
    mockTx.asset.count.mockResolvedValue(5);
    mockTx.kolCampaign.count.mockResolvedValue(7);

    const result = await deleteProduct(PRODUCT_ID);
    expect(result).toEqual({
      ok: false,
      error: "has_references",
      counts: { campaign: 2, asset: 5, kolCampaign: 7 },
    });
    // Crucially, NO soft delete fired and NO audit row written.
    expect(mockTx.product.update).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("proceeds with the soft delete when confirmCascade=true even with refs", async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: TENANT,
      name: "Project X",
    });
    mockTx.campaign.count.mockResolvedValue(1);
    mockTx.asset.count.mockResolvedValue(3);

    const result = await deleteProduct(PRODUCT_ID, { confirmCascade: true });
    expect(result).toEqual({
      ok: true,
      cascadeCount: { campaign: 1, asset: 3, kolCampaign: 0 },
    });
    expect(mockTx.product.update).toHaveBeenCalledTimes(1);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          cascadeCount: { campaign: 1, asset: 3, kolCampaign: 0 },
          softDelete: true,
        }),
      })
    );
  });

  it("treats an already-soft-deleted product as not_found (idempotent surface)", async () => {
    mockTx.product.findFirst.mockResolvedValue(null);

    const result = await deleteProduct(PRODUCT_ID);
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(mockTx.product.update).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("does not mutate campaign / asset / kol_campaign on cascade (D2: only product gets deleted_at)", async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: TENANT,
      name: "League Cup",
    });
    mockTx.campaign.count.mockResolvedValue(4);
    mockTx.asset.count.mockResolvedValue(8);
    mockTx.kolCampaign.count.mockResolvedValue(12);

    const result = await deleteProduct(PRODUCT_ID, { confirmCascade: true });
    expect(result.ok).toBe(true);
    // Spec D2 hedge: cascade counts go into the audit payload, but no
    // mutation runs against the related tables. Only the product
    // table gets an `update` call.
    expect(mockTx.product.update).toHaveBeenCalledTimes(1);
    // Verify no other write methods are reachable on the mocked tx —
    // we only mocked count + findFirst + update on the product, so a
    // missing mock would surface as a TypeError if anything else was
    // touched.
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "product.deleted" })
    );
  });
});
