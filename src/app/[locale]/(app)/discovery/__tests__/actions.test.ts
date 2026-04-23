/**
 * BM1-F004 · toggleKolSaved cache-invalidation contract.
 *
 * Regression guard for the F009 staging flake: Next prefetches the
 * sidebar /database link while the user browses /discovery, so if the
 * save action does not include the /database page in its
 * revalidatePath calls the client Router Cache keeps serving a stale
 * copy and the newly-saved KOL is missing from /database on the next
 * visit.
 */
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

const { toggleKolSaved } = await import("../actions");

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const KOL_ID = "99999999-8888-7777-6666-555555555555";

beforeEach(() => {
  revalidatePath.mockReset();
  authMock.mockReset();
  withTenant.mockReset();
  logEvent.mockReset();
});

function buildFormData(overrides: Partial<Record<"kolId" | "nextSaved", string>> = {}): FormData {
  const fd = new FormData();
  fd.set("kolId", overrides.kolId ?? KOL_ID);
  fd.set("nextSaved", overrides.nextSaved ?? "true");
  return fd;
}

describe("toggleKolSaved()", () => {
  it("revalidates /discovery, /kols AND /database on a successful save", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tid, fn) =>
      (fn as (tx: unknown) => unknown)({
        kol: {
          update: vi
            .fn()
            .mockResolvedValue({ id: KOL_ID, isSaved: true }),
        },
      })
    );

    const res = await toggleKolSaved({ ok: false }, buildFormData());

    expect(res).toEqual({ ok: true, kolId: KOL_ID, saved: true });
    const revalidatedPaths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(revalidatedPaths).toContain("/[locale]/discovery");
    expect(revalidatedPaths).toContain("/[locale]/kols");
    // Regression: /database was missing before BM1-F009 fix round 2,
    // causing the sidebar-prefetched Router Cache to serve a stale
    // /database that omitted the newly-saved row.
    expect(revalidatedPaths).toContain("/[locale]/database");
    // All three revalidations use the "page" type.
    for (const call of revalidatePath.mock.calls) {
      expect(call[1]).toBe("page");
    }
  });

  it("also revalidates /database when un-saving", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockImplementation(async (_tid, fn) =>
      (fn as (tx: unknown) => unknown)({
        kol: {
          update: vi
            .fn()
            .mockResolvedValue({ id: KOL_ID, isSaved: false }),
        },
      })
    );

    const res = await toggleKolSaved(
      { ok: false },
      buildFormData({ nextSaved: "false" })
    );

    expect(res).toEqual({ ok: true, kolId: KOL_ID, saved: false });
    const revalidatedPaths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(revalidatedPaths).toContain("/[locale]/database");
  });

  it("skips revalidation when the tenant session is missing", async () => {
    authMock.mockResolvedValue({ user: {} });

    const res = await toggleKolSaved({ ok: false }, buildFormData());

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("skips revalidation when the form data fails zod validation", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });

    const res = await toggleKolSaved(
      { ok: false },
      buildFormData({ kolId: "not-a-uuid" })
    );

    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("skips revalidation when the DB update throws", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    withTenant.mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await toggleKolSaved({ ok: false }, buildFormData());
      expect(res).toEqual({ ok: false, error: "generic" });
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
