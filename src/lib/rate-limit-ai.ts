/**
 * BL-035-F003 — per-tenant AI endpoint rate limit (v0.9.11
 * §rate-limit dogfood).
 *
 * Two layered Redis counters per tenant:
 *   - minute window: 10 calls / 60 s (catches bursts)
 *   - day window:    100 calls / 24 h (caps total cost)
 *
 * Both windows refresh after `duration` seconds, so the contract is
 * effectively a fixed-window counter; the caller treats either limiter
 * tripping the same — `{ ok: false, error: "rate_limit_exceeded",
 * retryAfter }`.
 *
 * The minute limiter is checked first so the day counter is only spent
 * when a request would actually hit the gateway. If a Redis outage
 * bubbles up from `consume()` we fail open — the cost cap from BL-034
 * F005 (`src/lib/ai/cost-cap.ts`) is the per-tenant secondary defence.
 *
 * Escape hatch: `DISABLE_AI_RATELIMIT=true` short-circuits to fail-open
 * so prod can disable in an emergency without redeploying (mirrors
 * `DISABLE_LOGIN_RATELIMIT` from BL-020 F005).
 */
import { RateLimiterRedis } from "rate-limiter-flexible";
import type { RateLimiterRes } from "rate-limiter-flexible";

import { getRedis } from "./redis";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

const PER_MIN_POINTS = 10;
const PER_MIN_DURATION_SECONDS = 60;

const PER_DAY_POINTS = 100;
const PER_DAY_DURATION_SECONDS = 24 * 60 * 60;

let _minLimiter: RateLimiterRedis | null = null;
let _dayLimiter: RateLimiterRedis | null = null;

function getMinLimiter(): RateLimiterRedis {
  if (_minLimiter) return _minLimiter;
  _minLimiter = new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rl:ai:min",
    points: PER_MIN_POINTS,
    duration: PER_MIN_DURATION_SECONDS,
  });
  return _minLimiter;
}

function getDayLimiter(): RateLimiterRedis {
  if (_dayLimiter) return _dayLimiter;
  _dayLimiter = new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rl:ai:day",
    points: PER_DAY_POINTS,
    duration: PER_DAY_DURATION_SECONDS,
  });
  return _dayLimiter;
}

function isRateLimiterRes(value: unknown): value is RateLimiterRes {
  return (
    typeof value === "object" &&
    value !== null &&
    "msBeforeNext" in value &&
    typeof (value as { msBeforeNext: unknown }).msBeforeNext === "number"
  );
}

export async function rateLimitAi(tenantId: string): Promise<RateLimitResult> {
  if (process.env.DISABLE_AI_RATELIMIT === "true") {
    return { ok: true, remaining: -1 };
  }

  // Minute window first: most lockouts trip here. Day quota is only
  // touched when the minute slot is free, so a tenant who batches 10
  // calls in a minute does not "lose" 10 of their 100 daily allowance
  // when only the first hits the cap.
  let minRemaining: number;
  try {
    const minRes = await getMinLimiter().consume(tenantId, 1);
    minRemaining = minRes.remainingPoints;
  } catch (err) {
    if (isRateLimiterRes(err)) {
      return { ok: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    console.warn(
      "[rateLimitAi] Redis unavailable on minute window, failing open:",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: true, remaining: -1 };
  }

  let dayRemaining: number;
  try {
    const dayRes = await getDayLimiter().consume(tenantId, 1);
    dayRemaining = dayRes.remainingPoints;
  } catch (err) {
    if (isRateLimiterRes(err)) {
      return { ok: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    console.warn(
      "[rateLimitAi] Redis unavailable on day window, failing open:",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: true, remaining: -1 };
  }

  return { ok: true, remaining: Math.min(minRemaining, dayRemaining) };
}

/**
 * Test-only: drop the cached limiters so the next call rebuilds them.
 */
export function __resetRateLimitAiForTests(): void {
  _minLimiter = null;
  _dayLimiter = null;
}
