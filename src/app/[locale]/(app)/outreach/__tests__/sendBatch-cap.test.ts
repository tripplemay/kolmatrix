/**
 * BL-035-F008 (AI-H4) — sendBatchAction batch cap + 60s timeout specs.
 *
 * Locks the audit-driven contract change: 50 → 8 per server-action
 * call, 60s wall-clock guard. The aigcgateway / DB plumbing is mocked
 * at the module boundary so the spec stays in jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const rateLimitBatchMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

const batchSendOutreachMock = vi.fn();
vi.mock("@/lib/email/batch-send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/batch-send")>(
    "@/lib/email/batch-send",
  );
  return {
    ...actual,
    batchSendOutreach: (...args: unknown[]) => batchSendOutreachMock(...args),
  };
});

vi.mock("@/lib/db", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/events/log", () => ({ logEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { sendBatchAction } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CAMPAIGN = "33333333-4444-5555-6666-777777777777";

function makeItem(handle: string) {
  return {
    kolId: `00000000-0000-4000-8000-${handle.padStart(12, "0")}`,
    toAddress: `${handle}@example.com`,
    subject: "Hi",
    bodyText: "Body",
  };
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({
    user: { tenantId: TENANT, id: USER, name: "Marketer" },
  });
  rateLimitBatchMock.mockReset().mockResolvedValue({ ok: true, remaining: 19 });
  batchSendOutreachMock.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendBatchAction (BL-035-F008)", () => {
  it("returns batch_too_large when items.length > 8", async () => {
    const items = Array.from({ length: 9 }, (_, i) => makeItem(String(i)));

    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res).toEqual({ ok: false, error: "batch_too_large" });
    expect(batchSendOutreachMock).not.toHaveBeenCalled();
  });

  it("accepts exactly 8 items and reaches batchSendOutreach", async () => {
    batchSendOutreachMock.mockResolvedValueOnce({
      sent: 8,
      mocked: 0,
      failed: 0,
      items: [],
    });
    const items = Array.from({ length: 8 }, (_, i) => makeItem(String(i)));

    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res.ok).toBe(true);
    expect(batchSendOutreachMock).toHaveBeenCalledTimes(1);
  });

  it("returns timeout when batchSendOutreach exceeds 60s wall-clock", async () => {
    vi.useFakeTimers();
    // Promise that never resolves — timeout should win the race.
    batchSendOutreachMock.mockImplementationOnce(() => new Promise(() => {}));

    const items = [makeItem("1")];
    const promise = sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    // Fast-forward past the 60s wall-clock. We don't await the rate
    // limiter because it's a vi.fn that resolves synchronously, but
    // give the microtask queue a chance to flush before tripping the
    // setTimeout.
    await vi.advanceTimersByTimeAsync(60_001);

    const res = await promise;
    expect(res).toEqual({ ok: false, error: "timeout" });
  });

  it("returns db_error when batchSendOutreach throws", async () => {
    batchSendOutreachMock.mockRejectedValueOnce(new Error("connection lost"));
    // Silence console.error from the action (expected for this branch).
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const items = [makeItem("1")];
    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res).toEqual({ ok: false, error: "db_error" });
    errSpy.mockRestore();
  });
});
