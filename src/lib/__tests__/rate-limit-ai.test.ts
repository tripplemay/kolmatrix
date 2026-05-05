/**
 * BL-035-F003 — rateLimitAi unit suite.
 *
 * Six branches:
 *   1. DISABLE_AI_RATELIMIT=true short-circuits to fail-open
 *   2. minute consume() ok + day consume() ok → remaining = min of both
 *   3. minute consume() rejects with RateLimiterRes (limit hit) → blocked
 *   4. minute ok + day consume() rejects with RateLimiterRes → blocked
 *      (with day's retryAfter)
 *   5. minute consume() rejects with Redis error → fail-open
 *   6. minute ok + day consume() rejects with Redis error → fail-open
 *
 * RateLimiterRedis + @/lib/redis are mocked at the module boundary
 * mirroring src/lib/__tests__/rate-limit.test.ts (BL-020 F005).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctorOptions: unknown[] = [];
const minConsumeMock = vi.fn();
const dayConsumeMock = vi.fn();

vi.mock("rate-limiter-flexible", () => ({
  RateLimiterRedis: class MockRateLimiterRedis {
    private readonly keyPrefix: string;
    constructor(opts: { keyPrefix: string }) {
      ctorOptions.push(opts);
      this.keyPrefix = opts.keyPrefix;
    }
    consume = (key: string, points: number) => {
      if (this.keyPrefix === "rl:ai:min") return minConsumeMock(key, points);
      if (this.keyPrefix === "rl:ai:day") return dayConsumeMock(key, points);
      throw new Error(`unexpected keyPrefix ${this.keyPrefix}`);
    };
  },
}));
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({}),
}));

const { rateLimitAi, __resetRateLimitAiForTests } = await import("@/lib/rate-limit-ai");

const ORIGINAL_DISABLE_ENV = process.env.DISABLE_AI_RATELIMIT;
const TENANT = "00000000-0000-0000-0000-000000000abc";

beforeEach(() => {
  ctorOptions.length = 0;
  minConsumeMock.mockReset();
  dayConsumeMock.mockReset();
  __resetRateLimitAiForTests();
  delete process.env.DISABLE_AI_RATELIMIT;
});

afterEach(() => {
  if (ORIGINAL_DISABLE_ENV === undefined) {
    delete process.env.DISABLE_AI_RATELIMIT;
  } else {
    process.env.DISABLE_AI_RATELIMIT = ORIGINAL_DISABLE_ENV;
  }
});

describe("rateLimitAi", () => {
  it("DISABLE_AI_RATELIMIT=true short-circuits to fail-open", async () => {
    process.env.DISABLE_AI_RATELIMIT = "true";
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: true, remaining: -1 });
    expect(minConsumeMock).not.toHaveBeenCalled();
    expect(dayConsumeMock).not.toHaveBeenCalled();
  });

  it("returns ok + min(remaining) when both windows have headroom", async () => {
    minConsumeMock.mockResolvedValueOnce({ remainingPoints: 7 });
    dayConsumeMock.mockResolvedValueOnce({ remainingPoints: 80 });
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: true, remaining: 7 });
    expect(minConsumeMock).toHaveBeenCalledWith(TENANT, 1);
    expect(dayConsumeMock).toHaveBeenCalledWith(TENANT, 1);
    expect(ctorOptions).toEqual([
      expect.objectContaining({
        keyPrefix: "rl:ai:min",
        points: 10,
        duration: 60,
      }),
      expect.objectContaining({
        keyPrefix: "rl:ai:day",
        points: 100,
        duration: 24 * 60 * 60,
      }),
    ]);
  });

  it("returns blocked + retryAfter when minute window is exhausted (does not touch day quota)", async () => {
    minConsumeMock.mockRejectedValueOnce({ msBeforeNext: 30_000, remainingPoints: 0 });
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: false, retryAfter: 30 });
    expect(dayConsumeMock).not.toHaveBeenCalled();
  });

  it("returns blocked + day retryAfter when day window is exhausted", async () => {
    minConsumeMock.mockResolvedValueOnce({ remainingPoints: 5 });
    dayConsumeMock.mockRejectedValueOnce({ msBeforeNext: 3_600_000, remainingPoints: 0 });
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: false, retryAfter: 3_600 });
  });

  it("fails open when minute consume() rejects with a Redis connection error", async () => {
    minConsumeMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:6379"));
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: true, remaining: -1 });
    expect(dayConsumeMock).not.toHaveBeenCalled();
  });

  it("fails open when day consume() rejects with a Redis connection error", async () => {
    minConsumeMock.mockResolvedValueOnce({ remainingPoints: 5 });
    dayConsumeMock.mockRejectedValueOnce(new Error("connection lost"));
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: true, remaining: -1 });
  });

  it("rounds retryAfter up (sub-second remainder)", async () => {
    minConsumeMock.mockRejectedValueOnce({ msBeforeNext: 1, remainingPoints: 0 });
    const res = await rateLimitAi(TENANT);
    expect(res).toEqual({ ok: false, retryAfter: 1 });
  });
});
