/**
 * BL-020-F005 (H-S2) — login rate limit, fail-open on Redis outage.
 *
 * Contract (spec §D3 + D8):
 *   - 5 attempts / 60 s sliding window per IP, 5-minute block after the
 *     6th attempt, all keyed under prefix "rl:login".
 *   - Redis unreachable → fail-open ({ ok: true, remaining: -1 }).
 *     The login surface still bcrypts, so a hard outage that blocks
 *     credentials sign-in is worse than the lost protection. The rate
 *     limit is defence-in-depth on top of bcrypt cost=12; both must fail
 *     before brute force becomes feasible.
 *   - Escape hatch: DISABLE_LOGIN_RATELIMIT=true short-circuits to
 *     `{ ok: true, remaining: -1 }` so prod can disable in an emergency
 *     without redeploying.
 *
 * Caller must invoke this BEFORE bcrypt — otherwise an attacker can
 * still pin the CPU even when locked out at the credential check.
 */
import { RateLimiterRedis } from "rate-limiter-flexible";
import type { RateLimiterRes } from "rate-limiter-flexible";

import { getRedis } from "./redis";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

const POINTS = 5;
const DURATION_SECONDS = 60;
const BLOCK_DURATION_SECONDS = 300;

let _limiter: RateLimiterRedis | null = null;

function getLimiter(): RateLimiterRedis {
  if (_limiter) return _limiter;
  _limiter = new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rl:login",
    points: POINTS,
    duration: DURATION_SECONDS,
    blockDuration: BLOCK_DURATION_SECONDS,
  });
  return _limiter;
}

function isRateLimiterRes(value: unknown): value is RateLimiterRes {
  return (
    typeof value === "object" &&
    value !== null &&
    "msBeforeNext" in value &&
    typeof (value as { msBeforeNext: unknown }).msBeforeNext === "number"
  );
}

export async function rateLimitLogin(ip: string): Promise<RateLimitResult> {
  if (process.env.DISABLE_LOGIN_RATELIMIT === "true") {
    return { ok: true, remaining: -1 };
  }
  try {
    const consumed = await getLimiter().consume(ip, 1);
    return { ok: true, remaining: consumed.remainingPoints };
  } catch (err) {
    if (isRateLimiterRes(err)) {
      // Limit hit (or already-blocked window); err.msBeforeNext is the
      // remaining lockout time in milliseconds.
      return { ok: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    // Redis unavailable / connection issue: fail-open + record. Logging
    // (not throwing) keeps the login surface functional during a Redis
    // outage; ops monitor /api/health.redis to catch this fast.
    console.warn(
      "[rateLimitLogin] Redis unavailable, failing open:",
      err instanceof Error ? err.message : String(err)
    );
    return { ok: true, remaining: -1 };
  }
}

/**
 * Test-only: drop the cached limiter so the next call rebuilds it (used
 * when integration tests swap Redis containers / when unit tests inject
 * a fresh stub).
 */
export function __resetRateLimitForTests(): void {
  _limiter = null;
}
