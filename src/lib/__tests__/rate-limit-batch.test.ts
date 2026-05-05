/**
 * BL-035-F003 — rateLimitBatchSend unit suite.
 *
 * Mirrors rate-limit.test.ts (BL-020 F005) — four branches with
 * RateLimiterRedis + @/lib/redis mocked at the module boundary so the
 * suite stays in jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consumeMock = vi.fn();
const RateLimiterRedisCtor = vi.fn();

vi.mock("rate-limiter-flexible", () => ({
  RateLimiterRedis: class MockRateLimiterRedis {
    constructor(opts: unknown) {
      RateLimiterRedisCtor(opts);
    }
    consume = consumeMock;
  },
}));
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({}),
}));

const { rateLimitBatchSend, __resetRateLimitBatchForTests } = await import(
  "@/lib/rate-limit-batch"
);

const ORIGINAL_DISABLE_ENV = process.env.DISABLE_BATCH_RATELIMIT;
const USER = "00000000-0000-0000-0000-000000000def";

beforeEach(() => {
  consumeMock.mockReset();
  RateLimiterRedisCtor.mockReset();
  __resetRateLimitBatchForTests();
  delete process.env.DISABLE_BATCH_RATELIMIT;
});

afterEach(() => {
  if (ORIGINAL_DISABLE_ENV === undefined) {
    delete process.env.DISABLE_BATCH_RATELIMIT;
  } else {
    process.env.DISABLE_BATCH_RATELIMIT = ORIGINAL_DISABLE_ENV;
  }
});

describe("rateLimitBatchSend", () => {
  it("DISABLE_BATCH_RATELIMIT=true short-circuits to fail-open", async () => {
    process.env.DISABLE_BATCH_RATELIMIT = "true";
    const res = await rateLimitBatchSend(USER);
    expect(res).toEqual({ ok: true, remaining: -1 });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("returns ok + remaining when consume() succeeds", async () => {
    consumeMock.mockResolvedValueOnce({ remainingPoints: 17 });
    const res = await rateLimitBatchSend(USER);
    expect(res).toEqual({ ok: true, remaining: 17 });
    expect(consumeMock).toHaveBeenCalledWith(USER, 1);
    expect(RateLimiterRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "rl:batch",
        points: 20,
        duration: 60,
      }),
    );
  });

  it("returns blocked + retryAfter when consume() rejects with msBeforeNext", async () => {
    consumeMock.mockRejectedValueOnce({ msBeforeNext: 24_500, remainingPoints: 0 });
    const res = await rateLimitBatchSend(USER);
    expect(res).toEqual({ ok: false, retryAfter: 25 });
  });

  it("fails open when consume() rejects with a Redis connection error", async () => {
    consumeMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));
    const res = await rateLimitBatchSend(USER);
    expect(res).toEqual({ ok: true, remaining: -1 });
  });
});
