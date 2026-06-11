/**
 * BL-100-F003 (ADR-020 D3) — sendBatchAction async enqueue + D5 fallback
 * + getSendBatchStatus. Supersedes the BL-035-F008 8-cap / 60s wall-clock
 * race specs: sending is now async (enqueue → return batchId), so the cap
 * only bounds a single job's size and there is no synchronous timeout.
 *
 * jobQueue / batch-send / DB are mocked at the module boundary so the
 * spec never touches real Redis or Resend (spec §2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEND_BATCH_MAX } from "@/lib/email/batch-constants";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const rateLimitBatchMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

const jobAddMock = vi.fn();
vi.mock("@/lib/jobs/queue", () => ({
  jobQueue: { add: (...args: unknown[]) => jobAddMock(...args) },
}));

const batchSendOutreachMock = vi.fn();
vi.mock("@/lib/email/batch-send", () => ({
  batchSendOutreach: (...args: unknown[]) => batchSendOutreachMock(...args),
}));

const groupByMock = vi.fn();
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ emailLog: { groupBy: groupByMock } }),
}));
vi.mock("@/lib/events/log", () => ({ logEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { sendBatchAction, getSendBatchStatus } = await import("../actions");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  jobAddMock.mockReset().mockResolvedValue({ jobId: "job-1" });
  batchSendOutreachMock.mockReset();
  groupByMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendBatchAction — async enqueue (BL-100-F003)", () => {
  it(`returns batch_too_large when items.length > ${SEND_BATCH_MAX}`, async () => {
    const items = Array.from({ length: SEND_BATCH_MAX + 1 }, (_, i) => makeItem(String(i)));

    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res).toEqual({ ok: false, error: "batch_too_large" });
    expect(jobAddMock).not.toHaveBeenCalled();
    expect(batchSendOutreachMock).not.toHaveBeenCalled();
  });

  it("enqueues a job and returns a batchId for >10 recipients (no 60s race)", async () => {
    const items = Array.from({ length: 12 }, (_, i) => makeItem(String(i)));

    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("async");
    expect(res.total).toBe(12);
    expect(res.batchId).toMatch(UUID_RE);
    expect(batchSendOutreachMock).not.toHaveBeenCalled();

    expect(jobAddMock).toHaveBeenCalledTimes(1);
    const [jobName, payload, opts] = jobAddMock.mock.calls[0]!;
    expect(jobName).toBe("send-email-batch");
    expect(payload).toMatchObject({
      tenantId: TENANT,
      userId: USER,
      campaignId: CAMPAIGN,
      batchId: res.batchId,
    });
    expect((payload as { items: unknown[] }).items).toHaveLength(12);
    expect(opts).toMatchObject({ idempotencyKey: res.batchId, tenantId: TENANT });
  });

  it("accepts exactly SEND_BATCH_MAX items", async () => {
    const items = Array.from({ length: SEND_BATCH_MAX }, (_, i) => makeItem(String(i)));
    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);
    expect(res.ok).toBe(true);
    expect(jobAddMock).toHaveBeenCalledTimes(1);
  });

  it("D5: falls back to a synchronous send (same batchId) when enqueue throws", async () => {
    jobAddMock.mockRejectedValueOnce(new Error("Redis unreachable"));
    batchSendOutreachMock.mockResolvedValueOnce({ sent: 2, mocked: 0, failed: 0, items: [] });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const items = [makeItem("1"), makeItem("2")];
    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("sync");
    expect(res.data).toMatchObject({ sent: 2 });
    expect(batchSendOutreachMock).toHaveBeenCalledTimes(1);
    // batchId passed positionally (5th arg) so email_log + idempotency align.
    const callArgs = batchSendOutreachMock.mock.calls[0]!;
    expect(callArgs[5 - 1]).toBe(res.batchId);
    errSpy.mockRestore();
  });

  it("returns db_error when both enqueue and the sync fallback fail", async () => {
    jobAddMock.mockRejectedValueOnce(new Error("Redis unreachable"));
    batchSendOutreachMock.mockRejectedValueOnce(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await sendBatchAction({
      campaignId: CAMPAIGN,
      items: [makeItem("1")],
    } as Parameters<typeof sendBatchAction>[0]);

    expect(res).toEqual({ ok: false, error: "db_error" });
    errSpy.mockRestore();
  });

  it("rejects an oversized batch before consuming the rate limit", async () => {
    const items = Array.from({ length: SEND_BATCH_MAX + 5 }, (_, i) => makeItem(String(i)));
    await sendBatchAction({
      campaignId: CAMPAIGN,
      items,
    } as Parameters<typeof sendBatchAction>[0]);
    expect(rateLimitBatchMock).not.toHaveBeenCalled();
  });
});

describe("getSendBatchStatus (BL-100-F003)", () => {
  const BATCH = "bbbbbbbb-1111-2222-3333-444444444444";

  it("maps email_log status counts into processed totals", async () => {
    groupByMock.mockResolvedValueOnce([
      { status: "sent", _count: { _all: 5 } },
      { status: "failed", _count: { _all: 1 } },
      { status: "mock_sent", _count: { _all: 2 } },
    ]);

    const res = await getSendBatchStatus(BATCH);
    expect(res).toEqual({
      ok: true,
      counts: { sent: 5, mockSent: 2, failed: 1, processed: 8 },
    });
    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["status"],
        where: { tenantId: TENANT, batchId: BATCH },
      }),
    );
  });

  it("returns all-zero counts before the worker has written any row", async () => {
    groupByMock.mockResolvedValueOnce([]);
    const res = await getSendBatchStatus(BATCH);
    expect(res).toEqual({
      ok: true,
      counts: { sent: 0, mockSent: 0, failed: 0, processed: 0 },
    });
  });

  it("rejects a non-uuid batchId", async () => {
    const res = await getSendBatchStatus("not-a-uuid");
    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(groupByMock).not.toHaveBeenCalled();
  });

  it("returns unauthorized without a session", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await getSendBatchStatus(BATCH);
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });
});
