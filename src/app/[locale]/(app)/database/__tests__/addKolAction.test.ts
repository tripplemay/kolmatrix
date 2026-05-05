/**
 * BL-024-F001-3 — addKolAction unit tests.
 *
 * Mocks @/auth + @/lib/db.withTenant + @/lib/rate-limit-batch +
 * @/lib/events/log so we exercise the validation + rate-limit + Prisma
 * P2002 (duplicate) handling paths without a real DB.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const kolCreateMock = vi.fn();
const withTenantMock = vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
  fn({ kol: { create: kolCreateMock } })
);
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) =>
    withTenantMock(args[0] as string, args[1] as (tx: unknown) => Promise<unknown>),
}));

const rateLimitBatchMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { addKolAction } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { tenantId: TENANT, id: USER } });
  kolCreateMock.mockReset();
  rateLimitBatchMock.mockReset().mockResolvedValue({ ok: true, remaining: 19 });
  logEventMock.mockReset().mockResolvedValue(undefined);
});

describe("addKolAction", () => {
  it("creates a KOL with isSaved=true on valid input", async () => {
    kolCreateMock.mockResolvedValueOnce({ id: "new-kol-id" });
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha Streams",
      followerCount: 1000,
    });
    expect(res).toEqual({ ok: true, kolId: "new-kol-id" });
    expect(kolCreateMock).toHaveBeenCalledTimes(1);
    const args = kolCreateMock.mock.calls[0][0];
    expect(args.data.tenantId).toBe(TENANT);
    expect(args.data.platform).toBe("youtube");
    expect(args.data.handle).toBe("alpha");
    expect(args.data.isSaved).toBe(true);
    // externalId is the canonical "manual:<handle>" so a later CSV
    // re-import upserts the same row instead of duplicating.
    expect(args.data.externalId).toBe("manual:alpha");
  });

  it("returns unauthorized when there is no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(kolCreateMock).not.toHaveBeenCalled();
  });

  it("returns rate_limit_exceeded and skips DB write", async () => {
    rateLimitBatchMock.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
    });
    expect(res).toEqual({ ok: false, error: "rate_limit_exceeded", retryAfter: 30 });
    expect(kolCreateMock).not.toHaveBeenCalled();
  });

  it("returns invalid_url when url fails the http(s) regex", async () => {
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
      url: "not-a-url",
    });
    expect(res).toEqual({ ok: false, error: "invalid_url" });
    expect(kolCreateMock).not.toHaveBeenCalled();
  });

  it("returns invalid_email when email fails the regex", async () => {
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
      email: "not-an-email",
    });
    expect(res).toEqual({ ok: false, error: "invalid_email" });
    expect(kolCreateMock).not.toHaveBeenCalled();
  });

  it("returns duplicate when Prisma raises P2002", async () => {
    kolCreateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
    });
    expect(res).toEqual({ ok: false, error: "duplicate" });
  });

  it("returns generic on unknown DB error", async () => {
    kolCreateMock.mockRejectedValueOnce(new Error("unexpected"));
    const res = await addKolAction({
      platform: "youtube",
      handle: "alpha",
      displayName: "Alpha",
    });
    expect(res).toEqual({ ok: false, error: "generic" });
  });
});
