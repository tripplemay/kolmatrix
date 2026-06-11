/**
 * BL-100-F001 — jobQueue factory selection.
 *
 * REDIS_URL present → BullMQJobQueue; absent → InMemoryJobQueue. The
 * exported singleton type/name is unchanged so call sites never touch
 * the implementation (ADR-020 D1). bullmq is mocked so neither path opens
 * a real connection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => ({
  Queue: class {
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
});

describe("jobQueue factory", () => {
  it("uses InMemoryJobQueue when REDIS_URL is absent", async () => {
    delete process.env.REDIS_URL;
    const { jobQueue, InMemoryJobQueue } = await import("../queue");
    expect(jobQueue).toBeInstanceOf(InMemoryJobQueue);
  });

  it("uses BullMQJobQueue when REDIS_URL is set", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/15";
    const { jobQueue } = await import("../queue");
    const { BullMQJobQueue } = await import("../bullmq-queue");
    expect(jobQueue).toBeInstanceOf(BullMQJobQueue);
  });

  it("falls back to InMemoryJobQueue if BullMQ construction throws", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/15";
    vi.doMock("../bullmq-queue", () => ({
      BullMQJobQueue: class {
        constructor() {
          throw new Error("boom");
        }
      },
    }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { jobQueue, InMemoryJobQueue } = await import("../queue");
    expect(jobQueue).toBeInstanceOf(InMemoryJobQueue);
    errSpy.mockRestore();
    vi.doUnmock("../bullmq-queue");
  });
});
