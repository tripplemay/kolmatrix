/**
 * BI4-F001 · InMemoryJobQueue unit spec
 *
 * Contract covered:
 *   - register + add → handler fires with payload + context
 *   - idempotencyKey dedupes repeat enqueues (same jobId, handler runs once)
 *   - handler throws → add() still resolves, stats.failed increments,
 *     main flow is not affected
 *   - add() to an unregistered name → console.warn, no crash
 *   - stats() accurately reflects completed / failed counts
 *   - generic payload types are preserved at the call site
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryJobQueue, type JobHandler } from "@/lib/jobs/queue";

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("InMemoryJobQueue", () => {
  it("invokes the registered handler with payload + context on add()", async () => {
    const queue = new InMemoryJobQueue();
    const handler = vi.fn<JobHandler<{ hello: string }>>(async () => {});
    queue.register<{ hello: string }>("greet", handler);

    const { jobId } = await queue.add("greet", { hello: "world" }, { tenantId: "t-1" });

    expect(handler).toHaveBeenCalledTimes(1);
    const [payload, ctx] = handler.mock.calls[0]!;
    expect(payload).toEqual({ hello: "world" });
    expect(ctx.jobId).toBe(jobId);
    expect(ctx.tenantId).toBe("t-1");

    const stats = queue.stats();
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.pending).toBe(0);
  });

  it("dedupes on idempotencyKey — same jobId returned, handler runs once", async () => {
    const queue = new InMemoryJobQueue();
    const handler = vi.fn(async () => {});
    queue.register("send-email", handler);

    const first = await queue.add("send-email", { to: "a@b.com" }, { idempotencyKey: "email-42" });
    const second = await queue.add("send-email", { to: "a@b.com" }, { idempotencyKey: "email-42" });

    expect(second.jobId).toBe(first.jobId);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(queue.stats().completed).toBe(1);
  });

  it("swallows handler throws so the caller's flow keeps going", async () => {
    const queue = new InMemoryJobQueue();
    queue.register("flaky", async () => {
      throw new Error("boom");
    });

    await expect(queue.add("flaky", { x: 1 })).resolves.toMatchObject({
      jobId: expect.any(String),
    });

    const stats = queue.stats();
    expect(stats.failed).toBe(1);
    expect(stats.completed).toBe(0);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("warns but does not crash when add() targets an unknown handler name", async () => {
    const queue = new InMemoryJobQueue();
    const result = await queue.add("nope", { foo: 1 });

    expect(result.jobId).toMatch(/^job_/);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
    expect(msg).toContain('"nope"');

    const stats = queue.stats();
    // No handler ran → no completed / failed increment
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.pending).toBe(0);
  });

  it("tracks stats across mixed success + failure", async () => {
    const queue = new InMemoryJobQueue();
    queue.register("ok", async () => {});
    queue.register("bad", async () => {
      throw new Error("nope");
    });

    await queue.add("ok", {});
    await queue.add("ok", {});
    await queue.add("bad", {});

    const stats = queue.stats();
    expect(stats.completed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(0);
  });

  it("preserves generic payload type at the call site (compile-time)", async () => {
    type SendEmailPayload = { to: string; subject: string };
    const queue = new InMemoryJobQueue();
    const received: SendEmailPayload[] = [];

    queue.register<SendEmailPayload>("send-email", async (payload) => {
      // Compile error expected if generic inference drifts
      received.push({ to: payload.to, subject: payload.subject });
    });

    await queue.add<SendEmailPayload>("send-email", {
      to: "sarah@kolmatrix.local",
      subject: "hello",
    });

    expect(received).toEqual([{ to: "sarah@kolmatrix.local", subject: "hello" }]);
  });
});
