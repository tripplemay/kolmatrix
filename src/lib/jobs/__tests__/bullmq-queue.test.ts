/**
 * BL-100-F001 — BullMQJobQueue behaviour (bullmq mocked at the module
 * boundary so no real Redis is required, per spec §2 "单测不依赖真
 * Redis").
 *
 * Asserts the JobQueue contract translation onto BullMQ primitives:
 *   - add() maps idempotencyKey → jobId and delay → delay
 *   - register() is idempotent per process (no duplicate Worker)
 *   - the Worker processor forwards payload + a JobContext to the handler
 *   - D5: a hung enqueue (Redis unreachable) times out so the caller can
 *     fall back to a synchronous send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- bullmq mock ----------------------------------------------------

type Processor = (job: { id: string; data: Record<string, unknown> }) => Promise<unknown>;

const queueAddMock = vi.fn();
const queueInstances: Array<{ name: string; opts: unknown }> = [];
const workerInstances: Array<{ name: string; processor: Processor; opts: unknown }> = [];

class FakeQueue {
  add = queueAddMock;
  on = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
  constructor(
    public name: string,
    public opts: unknown,
  ) {
    queueInstances.push({ name, opts });
  }
}

class FakeWorker {
  on = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
  constructor(
    public name: string,
    public processor: Processor,
    public opts: unknown,
  ) {
    workerInstances.push({ name, processor, opts });
  }
}

vi.mock("bullmq", () => ({ Queue: FakeQueue, Worker: FakeWorker }));

const duplicateMock = vi.fn(() => ({ __dup: true }));
vi.mock("@/lib/redis", () => ({
  getBullConnection: () => ({ duplicate: duplicateMock }),
}));

const { BullMQJobQueue } = await import("../bullmq-queue");

beforeEach(() => {
  queueAddMock.mockReset().mockResolvedValue({ id: "auto-job-1" });
  queueInstances.length = 0;
  workerInstances.length = 0;
  duplicateMock.mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BullMQJobQueue.add", () => {
  it("maps idempotencyKey → jobId and returns the enqueued job id", async () => {
    queueAddMock.mockResolvedValueOnce({ id: "given-key" });
    const q = new BullMQJobQueue();

    const res = await q.add(
      "send-email-batch",
      { batchId: "b1", tenantId: "t1" },
      { idempotencyKey: "given-key", tenantId: "t1" },
    );

    expect(res.jobId).toBe("given-key");
    expect(queueAddMock).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = queueAddMock.mock.calls[0]!;
    expect(name).toBe("send-email-batch");
    expect(payload).toEqual({ batchId: "b1", tenantId: "t1" });
    expect(opts).toMatchObject({ jobId: "given-key" });
  });

  it("passes a positive delay through and omits it when zero/absent", async () => {
    const q = new BullMQJobQueue();

    await q.add("job-a", { x: 1 }, { delay: 1 });
    expect(queueAddMock.mock.calls[0]![2]).toMatchObject({ delay: 1 });

    await q.add("job-a", { x: 1 }, { delay: 0 });
    expect(queueAddMock.mock.calls[1]![2]!.delay).toBeUndefined();

    await q.add("job-a", { x: 1 });
    expect(queueAddMock.mock.calls[2]![2]!.delay).toBeUndefined();
  });

  it("reuses a single Queue instance per job name", async () => {
    const q = new BullMQJobQueue();
    await q.add("same-name", { x: 1 });
    await q.add("same-name", { x: 2 });
    expect(queueInstances.filter((i) => i.name === "same-name")).toHaveLength(1);
  });

  it("times out (D5) when the enqueue never resolves — Redis unreachable", async () => {
    vi.useFakeTimers();
    queueAddMock.mockImplementationOnce(() => new Promise(() => {}));
    const q = new BullMQJobQueue();

    const promise = q.add("send-email-batch", { batchId: "b" }, {});
    const assertion = expect(promise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(5_001);
    await assertion;
  });
});

describe("BullMQJobQueue.register", () => {
  it("starts one Worker per name and is idempotent on re-register", () => {
    const q = new BullMQJobQueue();
    const handler = vi.fn(async () => undefined);

    q.register("send-email-batch", handler);
    q.register("send-email-batch", handler); // re-import / double boot

    expect(workerInstances.filter((w) => w.name === "send-email-batch")).toHaveLength(1);
    // Worker got its own duplicated (blocking) connection.
    expect(duplicateMock).toHaveBeenCalledTimes(1);
    expect(workerInstances[0]!.opts).toMatchObject({ concurrency: 1 });
  });

  it("forwards payload + JobContext (jobId, tenantId) to the handler", async () => {
    const q = new BullMQJobQueue();
    const handler =
      vi.fn<(payload: unknown, context: unknown) => Promise<void>>(async () => undefined);
    q.register("send-email-batch", handler);

    const processor = workerInstances[0]!.processor;
    await processor({ id: "job-9", data: { batchId: "b7", tenantId: "tenant-x" } });

    expect(handler).toHaveBeenCalledTimes(1);
    const [payload, context] = handler.mock.calls[0]!;
    expect(payload).toEqual({ batchId: "b7", tenantId: "tenant-x" });
    expect(context).toEqual({ jobId: "job-9", tenantId: "tenant-x" });
  });
});
