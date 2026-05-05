/**
 * BL-035-F002 (AUTH-H5) — updateUserLocale narrowed-scope specs.
 *
 * The legacy fallback ran the locale write through `withPlatformAdmin`
 * when the session lacked a UUID-shaped tenantId/userId. That works
 * because `email` is globally unique, but it's a weakened-scope shape:
 * any future regression in the `select` clause or in
 * `withPlatformAdmin` callers could leak beyond locale.
 *
 * Hardened contract:
 *   1. Valid UUID tenantId + userId → withTenant write (unchanged).
 *   2. Invalid IDs but valid email → resolve user via platform-admin
 *      read, then perform the WRITE inside withTenant (RLS scope).
 *   3. Email present but unknown to the DB → throw Unauthorized.
 *   4. Resolved user with a non-UUID tenantId → throw Unauthorized.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenantMock = vi.fn();
const withPlatformAdminMock = vi.fn();
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) => withTenantMock(...args),
  withPlatformAdmin: (...args: unknown[]) => withPlatformAdminMock(...args),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "zh", "ja", "ko", "es"] as const, defaultLocale: "en" },
}));

const { updateUserLocale } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  authMock.mockReset();
  withTenantMock.mockReset();
  withPlatformAdminMock.mockReset();
});

describe("updateUserLocale (BL-035-F002 / AUTH-H5)", () => {
  it("uses withTenant when tenantId + userId are valid UUIDs", async () => {
    authMock.mockResolvedValue({
      user: { tenantId: TENANT, id: USER, email: "user@example.com" },
    });
    withTenantMock.mockImplementation(async (_tid, fn) =>
      (fn as (tx: unknown) => unknown)({ user: { update: vi.fn().mockResolvedValue({}) } }),
    );

    await updateUserLocale("zh");

    expect(withTenantMock).toHaveBeenCalledWith(TENANT, expect.any(Function));
    expect(withPlatformAdminMock).not.toHaveBeenCalled();
  });

  it("resolves user via platform-admin read and writes via withTenant when IDs are not UUIDs", async () => {
    authMock.mockResolvedValue({
      user: { tenantId: "not-a-uuid", id: "not-a-uuid", email: "user@example.com" },
    });
    withPlatformAdminMock.mockImplementation(async (fn) =>
      (fn as (tx: unknown) => unknown)({
        user: { findUnique: vi.fn().mockResolvedValue({ id: USER, tenantId: TENANT }) },
      }),
    );
    withTenantMock.mockImplementation(async (_tid, fn) =>
      (fn as (tx: unknown) => unknown)({ user: { update: vi.fn().mockResolvedValue({}) } }),
    );

    await updateUserLocale("zh");

    expect(withPlatformAdminMock).toHaveBeenCalled();
    expect(withTenantMock).toHaveBeenCalledWith(TENANT, expect.any(Function));
  });

  it("throws Unauthorized when email lookup returns null", async () => {
    authMock.mockResolvedValue({
      user: { tenantId: "not-a-uuid", id: "not-a-uuid", email: "ghost@example.com" },
    });
    withPlatformAdminMock.mockImplementation(async (fn) =>
      (fn as (tx: unknown) => unknown)({
        user: { findUnique: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(updateUserLocale("zh")).rejects.toThrow("Unauthorized");
    expect(withTenantMock).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when the resolved user has a non-UUID tenantId", async () => {
    authMock.mockResolvedValue({
      user: { tenantId: "not-a-uuid", id: "not-a-uuid", email: "user@example.com" },
    });
    withPlatformAdminMock.mockImplementation(async (fn) =>
      (fn as (tx: unknown) => unknown)({
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: USER, tenantId: "not-a-uuid-either" }),
        },
      }),
    );

    await expect(updateUserLocale("zh")).rejects.toThrow("Unauthorized");
    expect(withTenantMock).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when neither IDs nor email are usable", async () => {
    authMock.mockResolvedValue({
      user: { tenantId: "not-a-uuid", id: "not-a-uuid", email: "" },
    });

    await expect(updateUserLocale("zh")).rejects.toThrow("Unauthorized");
    expect(withTenantMock).not.toHaveBeenCalled();
    expect(withPlatformAdminMock).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(updateUserLocale("en")).rejects.toThrow("Unauthorized");
  });
});
