/**
 * BL-020-F005 — rateLimitLogin unit suite.
 *
 * Exercises the four spec'd branches without needing a Redis testcontainer:
 *   1. DISABLE_LOGIN_RATELIMIT=true short-circuits to fail-open
 *   2. limiter.consume succeeds → ok+remaining echoed
 *   3. limiter.consume rejects with a RateLimiterRes-shape → blocked +
 *      retryAfter (msBeforeNext / 1000, ceiled)
 *   4. limiter.consume rejects with a non-RateLimiterRes error (Redis
 *      connection failure) → fail-open with remaining=-1
 *
 * `rate-limiter-flexible` and `@/lib/redis` are mocked at the module
 * boundary so the suite stays in jsdom and finishes in milliseconds.
 * The sliding-window timing semantics belong to the upstream library
 * and are out of scope here.
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

const { rateLimitLogin, __resetRateLimitForTests } = await import("@/lib/rate-limit");

const ORIGINAL_DISABLE_ENV = process.env.DISABLE_LOGIN_RATELIMIT;

beforeEach(() => {
  consumeMock.mockReset();
  RateLimiterRedisCtor.mockReset();
  __resetRateLimitForTests();
  delete process.env.DISABLE_LOGIN_RATELIMIT;
});

afterEach(() => {
  if (ORIGINAL_DISABLE_ENV === undefined) {
    delete process.env.DISABLE_LOGIN_RATELIMIT;
  } else {
    process.env.DISABLE_LOGIN_RATELIMIT = ORIGINAL_DISABLE_ENV;
  }
});

describe("rateLimitLogin", () => {
  it("DISABLE_LOGIN_RATELIMIT=true short-circuits to fail-open", async () => {
    process.env.DISABLE_LOGIN_RATELIMIT = "true";
    const res = await rateLimitLogin("203.0.113.7");
    expect(res).toEqual({ ok: true, remaining: -1 });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("returns ok + remaining when consume() succeeds", async () => {
    consumeMock.mockResolvedValueOnce({ remainingPoints: 4 });
    const res = await rateLimitLogin("203.0.113.7");
    expect(res).toEqual({ ok: true, remaining: 4 });
    expect(consumeMock).toHaveBeenCalledWith("203.0.113.7", 1);
    expect(RateLimiterRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "rl:login",
        points: 5,
        duration: 60,
        blockDuration: 300,
      })
    );
  });

  it("returns blocked + retryAfter when consume() rejects with msBeforeNext (limit hit)", async () => {
    consumeMock.mockRejectedValueOnce({ msBeforeNext: 12_345, remainingPoints: 0 });
    const res = await rateLimitLogin("203.0.113.7");
    expect(res).toEqual({ ok: false, retryAfter: 13 }); // ceil(12345/1000) = 13
  });

  it("rounds retryAfter up (sub-second remainder)", async () => {
    consumeMock.mockRejectedValueOnce({ msBeforeNext: 1, remainingPoints: 0 });
    const res = await rateLimitLogin("203.0.113.7");
    expect(res).toEqual({ ok: false, retryAfter: 1 });
  });

  it("fails open when consume() rejects with a Redis connection error", async () => {
    consumeMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));
    const res = await rateLimitLogin("203.0.113.7");
    expect(res).toEqual({ ok: true, remaining: -1 });
  });
});
