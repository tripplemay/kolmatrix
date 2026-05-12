/**
 * BL-065-F003 · bulkSoftDeleteKolsAction unit tests.
 *
 * Mocks @/auth + @/lib/db.withTenant + @/lib/rate-limit-batch +
 * @/lib/events/log so we exercise the validation + rate-limit + bulk
 * updateMany branches without a real DB. Same pattern as the BL-024
 * addKolAction tests next door.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const updateManyMock = vi.fn();
const withTenantMock = vi.fn(
  async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ kol: { updateMany: updateManyMock } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) =>
    withTenantMock(
      args[0] as string,
      args[1] as (tx: unknown) => Promise<unknown>,
    ),
}));

const rateLimitBatchMock = vi
  .fn<
    () => Promise<
      { ok: true; remaining: number } | { ok: false; retryAfter: number }
    >
  >()
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

const { bulkSoftDeleteKolsAction } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  authMock
    .mockReset()
    .mockResolvedValue({ user: { tenantId: TENANT, id: USER } });
  updateManyMock.mockReset();
  rateLimitBatchMock
    .mockReset()
    .mockResolvedValue({ ok: true, remaining: 19 });
  logEventMock.mockReset().mockResolvedValue(undefined);
});

describe("bulkSoftDeleteKolsAction (BL-065-F003)", () => {
  it("returns unauthorized when there is no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await bulkSoftDeleteKolsAction({ kolIds: ["k1"] });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("rejects empty kolIds via the zod min(1) gate", async () => {
    const res = await bulkSoftDeleteKolsAction({ kolIds: [] });
    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("rejects more than 200 kolIds via the zod max(200) gate", async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => `k${i}`);
    const res = await bulkSoftDeleteKolsAction({ kolIds: tooMany });
    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("surfaces rate-limit failures with retryAfter", async () => {
    rateLimitBatchMock.mockResolvedValueOnce({ ok: false, retryAfter: 17 });
    const res = await bulkSoftDeleteKolsAction({ kolIds: ["k1", "k2"] });
    expect(res).toEqual({
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: 17,
    });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("soft-deletes the requested ids and logs the audit event", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 3 });
    const res = await bulkSoftDeleteKolsAction({
      kolIds: ["k1", "k2", "k3"],
    });
    expect(res).toEqual({ ok: true, deleted: 3 });
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const args = updateManyMock.mock.calls[0][0];
    expect(args.where.id.in).toEqual(["k1", "k2", "k3"]);
    expect(args.where.deletedAt).toBeNull();
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "match.kols_bulk_deleted",
        tenantId: TENANT,
        actorId: USER,
        payload: { requested: 3, deleted: 3 },
      }),
    );
  });

  it("logs a failure event and returns generic on Prisma errors", async () => {
    updateManyMock.mockRejectedValueOnce(new Error("boom"));
    const res = await bulkSoftDeleteKolsAction({ kolIds: ["k1"] });
    expect(res).toEqual({ ok: false, error: "generic" });
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "match.kols_bulk_delete_failed",
        tenantId: TENANT,
        actorId: USER,
      }),
    );
  });
});
