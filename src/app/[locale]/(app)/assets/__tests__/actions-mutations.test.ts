/**
 * BL-025-F005 patch · /assets server-action specs for the
 * archive / duplicate / delete / discard / load-more actions.
 *
 * Same mocking shape as actions.test.ts (auth + withTenant +
 * mutations + audit). Each case covers the auth gate + the success
 * branch + the not-found branch so the discriminated-union return
 * shape is exercised end-to-end without spinning up Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenantMock = vi.fn();
vi.mock("@/lib/db", () => ({ withTenant: (...args: unknown[]) => withTenantMock(...args) }));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({ logAudit: (...args: unknown[]) => logAuditMock(...args) }));

const archiveAssetMock = vi.fn();
const duplicateAssetMock = vi.fn();
const deleteAssetMock = vi.fn();
const updateAssetMock = vi.fn();
const createAssetMock = vi.fn();
vi.mock("@/lib/assets/mutations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assets/mutations")>(
    "@/lib/assets/mutations"
  );
  return {
    ...actual,
    archiveAsset: (...args: unknown[]) => archiveAssetMock(...args),
    duplicateAsset: (...args: unknown[]) => duplicateAssetMock(...args),
    deleteAsset: (...args: unknown[]) => deleteAssetMock(...args),
    updateAsset: (...args: unknown[]) => updateAssetMock(...args),
    createAsset: (...args: unknown[]) => createAssetMock(...args),
  };
});

const loadAssetDetailMock = vi.fn();
const loadAssetsForListingMock = vi.fn();
vi.mock("@/lib/assets/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assets/queries")>(
    "@/lib/assets/queries"
  );
  return {
    ...actual,
    loadAssetDetail: (...args: unknown[]) => loadAssetDetailMock(...args),
    loadAssetsForListing: (...args: unknown[]) => loadAssetsForListingMock(...args),
  };
});

const {
  archiveAssetAction,
  deleteAssetAction,
  discardGeneratedAssetAction,
  duplicateAssetAction,
  loadMoreAssetsAction,
} = await import("../actions");

const TENANT_ID = "11111111-2222-4333-8444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ASSET_ID = "f0eeb4b5-1111-4222-8333-444455556666";
const COPY_ID = "99990000-1111-4222-8333-444455556666";

const baseAsset = {
  id: ASSET_ID,
  tenantId: TENANT_ID,
  productId: "p-1",
  productName: "Honor of Kings",
  type: "email" as const,
  name: "Welcome v1",
  source: "user_created" as const,
  status: "draft" as const,
  parentId: null,
  versionIndex: 1,
  totalVariants: 1,
  contentPreview: "",
  updatedAt: new Date(),
  createdAt: new Date(),
  content: { subject: "", body: "", locale: "en", variables: [] },
  metadata: { traceId: "trace-1", model: "claude-haiku-4.5", tokensUsed: 100 },
  createdBy: USER_ID,
};

beforeEach(() => {
  authMock.mockReset();
  withTenantMock.mockReset();
  logAuditMock.mockReset().mockResolvedValue(undefined);
  archiveAssetMock.mockReset();
  duplicateAssetMock.mockReset();
  deleteAssetMock.mockReset();
  updateAssetMock.mockReset();
  createAssetMock.mockReset();
  loadAssetDetailMock.mockReset();
  loadAssetsForListingMock.mockReset();
});

function authedSession() {
  authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
}

function withTenantPasses() {
  withTenantMock.mockImplementation(
    async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({})
  );
}

describe("archiveAssetAction", () => {
  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    const res = await archiveAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("rejects malformed assetId (Zod fail)", async () => {
    authedSession();
    const res = await archiveAssetAction({ assetId: "not-a-uuid" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("validation");
  });

  it("returns asset_not_found when loadAssetDetail comes back null", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(null);
    const res = await archiveAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "asset_not_found" });
    expect(archiveAssetMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("archives the asset and writes asset.archived audit", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue({ ...baseAsset, status: "published" });
    archiveAssetMock.mockResolvedValue({ ...baseAsset, status: "archived" });

    const res = await archiveAssetAction({ assetId: ASSET_ID });
    expect(res.ok).toBe(true);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0]![0].action).toBe("asset.archived");
  });
});

describe("duplicateAssetAction", () => {
  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    const res = await duplicateAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("returns asset_not_found when source asset is missing", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(null);
    const res = await duplicateAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "asset_not_found" });
    expect(duplicateAssetMock).not.toHaveBeenCalled();
  });

  it("clones and writes asset.duplicated audit including sourceAssetId", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(baseAsset);
    duplicateAssetMock.mockResolvedValue({ ...baseAsset, id: COPY_ID, name: "Welcome v1 (copy)" });

    const res = await duplicateAssetAction({ assetId: ASSET_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.asset.id).toBe(COPY_ID);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const audit = logAuditMock.mock.calls[0]![0];
    expect(audit.action).toBe("asset.duplicated");
    expect(audit.after.sourceAssetId).toBe(ASSET_ID);
  });
});

describe("deleteAssetAction", () => {
  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    const res = await deleteAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("returns asset_not_found when source asset is missing", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(null);
    const res = await deleteAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "asset_not_found" });
    expect(deleteAssetMock).not.toHaveBeenCalled();
  });

  it("deletes the asset and writes asset.deleted audit", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(baseAsset);
    deleteAssetMock.mockResolvedValue(true);

    const res = await deleteAssetAction({ assetId: ASSET_ID });
    expect(res.ok).toBe(true);
    expect(logAuditMock.mock.calls[0]![0].action).toBe("asset.deleted");
  });
});

describe("discardGeneratedAssetAction", () => {
  it("audit-tags the discard with asset.generated_discarded (not asset.deleted)", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(baseAsset);
    deleteAssetMock.mockResolvedValue(true);

    const res = await discardGeneratedAssetAction({ assetId: ASSET_ID });
    expect(res.ok).toBe(true);
    const audit = logAuditMock.mock.calls[0]![0];
    expect(audit.action).toBe("asset.generated_discarded");
    expect(audit.before.traceId).toBe("trace-1");
    expect(audit.before.tokensUsed).toBe(100);
  });

  it("returns asset_not_found when source asset already gone", async () => {
    authedSession();
    withTenantPasses();
    loadAssetDetailMock.mockResolvedValue(null);
    const res = await discardGeneratedAssetAction({ assetId: ASSET_ID });
    expect(res).toMatchObject({ ok: false, code: "asset_not_found" });
  });
});

describe("loadMoreAssetsAction", () => {
  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    const res = await loadMoreAssetsAction({
      filter: {},
      cursor: "abc",
      sort: "recent",
      limit: 24,
    });
    expect(res).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("rejects empty cursor (Zod fail)", async () => {
    authedSession();
    const res = await loadMoreAssetsAction({
      filter: {},
      cursor: "",
      sort: "recent",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("validation");
  });

  it("delegates to loadAssetsForListing with cursor + sort", async () => {
    authedSession();
    withTenantPasses();
    const fakePage = { items: [], nextCursor: null, hasMore: false, total: 0 };
    loadAssetsForListingMock.mockResolvedValue(fakePage);

    const res = await loadMoreAssetsAction({
      filter: { types: ["email"] },
      cursor: "cursor-abc",
      sort: "name",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.page).toEqual(fakePage);
    const callArgs = loadAssetsForListingMock.mock.calls[0]!;
    expect(callArgs[1]).toEqual({ types: ["email"] });
    expect(callArgs[2]).toMatchObject({ cursor: "cursor-abc", sort: "name", limit: 24 });
  });
});
