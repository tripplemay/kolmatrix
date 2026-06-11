/**
 * BL-100-F004 (ADR-020 D3) — useSendBatch state machine.
 *
 * Hook-level coverage (like useProductFilter) so the polling logic is
 * verified without rendering the whole composer. The server actions are
 * mocked at the module boundary; fake timers drive the 2s poll loop.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendBatchActionMock = vi.fn();
const getSendBatchStatusMock = vi.fn();
vi.mock("../actions", () => ({
  sendBatchAction: (...args: unknown[]) => sendBatchActionMock(...args),
  getSendBatchStatus: (...args: unknown[]) => getSendBatchStatusMock(...args),
}));

const { useSendBatch } = await import("../useSendBatch");

const INPUT: Parameters<ReturnType<typeof useSendBatch>["send"]>[0] = {
  campaignId: "33333333-4444-5555-6666-777777777777",
  aiAccepted: false,
  items: [],
};

// Flush the microtask queue + run any 0-delay work inside act().
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sendBatchActionMock.mockReset();
  getSendBatchStatusMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSendBatch — async path", () => {
  it("polls progress to completion then surfaces the summary + onSettled", async () => {
    sendBatchActionMock.mockResolvedValue({
      ok: true,
      mode: "async",
      batchId: "11111111-1111-1111-1111-111111111111",
      total: 3,
    });
    getSendBatchStatusMock
      .mockResolvedValueOnce({ ok: true, counts: { sent: 1, mockSent: 0, failed: 0, processed: 1 } })
      .mockResolvedValueOnce({ ok: true, counts: { sent: 3, mockSent: 0, failed: 0, processed: 3 } });
    const onSettled = vi.fn();
    const { result } = renderHook(() => useSendBatch({ onSettled }));

    act(() => result.current.send(INPUT));
    await flush();

    expect(result.current.phase).toBe("sending");
    expect(result.current.progress).toEqual({
      processed: 0,
      total: 3,
      sent: 0,
      mockSent: 0,
      failed: 0,
    });

    // First poll at +2s → 1/3 processed, still sending.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.progress?.processed).toBe(1);
    expect(result.current.phase).toBe("sending");

    // Second poll → 3/3 processed → done.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.phase).toBe("done");
    expect(result.current.result).toEqual({ sent: 3, mocked: 0, failed: 0, items: [] });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("goes stalled when the poll deadline passes without finishing", async () => {
    sendBatchActionMock.mockResolvedValue({
      ok: true,
      mode: "async",
      batchId: "11111111-1111-1111-1111-111111111111",
      total: 1,
    });
    getSendBatchStatusMock.mockResolvedValue({
      ok: true,
      counts: { sent: 0, mockSent: 0, failed: 0, processed: 0 },
    });
    const { result } = renderHook(() => useSendBatch());

    act(() => result.current.send(INPUT));
    await flush();
    expect(result.current.phase).toBe("sending");

    // total=1 → maxPolls = ceil((6000 + 30000)/2000) = 18 → advance past it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(18 * 2000 + 100);
    });
    expect(result.current.phase).toBe("stalled");
  });
});

describe("useSendBatch — sync (D5) + error paths", () => {
  it("renders the inline summary without polling when mode is sync", async () => {
    sendBatchActionMock.mockResolvedValue({
      ok: true,
      mode: "sync",
      batchId: "11111111-1111-1111-1111-111111111111",
      total: 2,
      data: { sent: 2, mocked: 0, failed: 0, items: [] },
    });
    const onSettled = vi.fn();
    const { result } = renderHook(() => useSendBatch({ onSettled }));

    act(() => result.current.send(INPUT));
    await flush();

    expect(result.current.phase).toBe("done");
    expect(result.current.result).toMatchObject({ sent: 2 });
    expect(getSendBatchStatusMock).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("surfaces the action error and never polls", async () => {
    sendBatchActionMock.mockResolvedValue({ ok: false, error: "rate_limit_exceeded" });
    const { result } = renderHook(() => useSendBatch());

    act(() => result.current.send(INPUT));
    await flush();

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("rate_limit_exceeded");
    expect(getSendBatchStatusMock).not.toHaveBeenCalled();
  });

  it("dismiss() resets back to idle", async () => {
    sendBatchActionMock.mockResolvedValue({ ok: false, error: "generic" });
    const { result } = renderHook(() => useSendBatch());

    act(() => result.current.send(INPUT));
    await flush();
    expect(result.current.phase).toBe("error");

    act(() => result.current.dismiss());
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});
