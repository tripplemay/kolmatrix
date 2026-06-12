/**
 * BL-107-F001 (M4) · loadKol soft-delete / suspicious filter口径.
 *
 * Mocks @/lib/db.withTenant (same pattern as the BL-065 bulk-soft-delete
 * action tests) so we exercise the where-clause construction without a
 * real DB. The contract under test: the KOL detail-page loader must hide
 * soft-deleted AND suspicious KOLs via direct link, matching the /match
 * list口径 (`filters.ts`: { deletedAt: null } + { isSuspicious: false }).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const withTenantMock = vi.fn(
  async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ kol: { findFirst: findFirstMock } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) =>
    withTenantMock(
      args[0] as string,
      args[1] as (tx: unknown) => Promise<unknown>,
    ),
}));

const { loadKol } = await import("../load-kol");

const TENANT = "11111111-2222-3333-4444-555555555555";
const KOL_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  findFirstMock.mockReset();
  withTenantMock.mockClear();
});

describe("loadKol (BL-107-F001 M4)", () => {
  it("queries with findFirst guarded by deletedAt:null AND isSuspicious:false", async () => {
    findFirstMock.mockResolvedValueOnce({ id: KOL_ID, displayName: "Live KOL" });

    const kol = await loadKol(TENANT, KOL_ID);

    expect(kol).toEqual({ id: KOL_ID, displayName: "Live KOL" });
    expect(withTenantMock).toHaveBeenCalledWith(TENANT, expect.any(Function));
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const args = findFirstMock.mock.calls[0][0];
    // Mirrors the canonical /match list口径 exactly.
    expect(args.where).toEqual({
      id: KOL_ID,
      deletedAt: null,
      isSuspicious: false,
    });
  });

  it("resolves null for a soft-deleted / suspicious KOL (direct-link → notFound)", async () => {
    // A tombstoned or suspicious KOL no longer matches the where clause,
    // so Prisma returns null — the page then calls notFound().
    findFirstMock.mockResolvedValueOnce(null);

    const kol = await loadKol(TENANT, KOL_ID);

    expect(kol).toBeNull();
  });

  it("scopes the read to the caller's tenant", async () => {
    findFirstMock.mockResolvedValueOnce({ id: KOL_ID });

    await loadKol(TENANT, KOL_ID);

    expect(withTenantMock.mock.calls[0][0]).toBe(TENANT);
  });
});
