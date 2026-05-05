/**
 * BL-035-F003 — per-user batch-send rate limit (v0.9.11 §rate-limit
 * mutation row).
 *
 * 20 send calls / 60 s / userId — sendBatchAction is the only caller
 * today. Userspace-keyed (not tenantId) because a single tenant may
 * have multiple operators and the brute-force concern (sender
 * reputation) is per-account, not per-tenant.
 *
 * Same fail-open + escape-hatch shape as rate-limit-ai.ts and
 * rate-limit.ts — `DISABLE_BATCH_RATELIMIT=true` short-circuits.
 */
import { RateLimiterRedis } from "rate-limiter-flexible";
import type { RateLimiterRes } from "rate-limiter-flexible";

import { getRedis } from "./redis";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

const POINTS = 20;
const DURATION_SECONDS = 60;

let _limiter: RateLimiterRedis | null = null;

function getLimiter(): RateLimiterRedis {
  if (_limiter) return _limiter;
  _limiter = new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rl:batch",
    points: POINTS,
    duration: DURATION_SECONDS,
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

export async function rateLimitBatchSend(userId: string): Promise<RateLimitResult> {
  if (process.env.DISABLE_BATCH_RATELIMIT === "true") {
    return { ok: true, remaining: -1 };
  }
  try {
    const consumed = await getLimiter().consume(userId, 1);
    return { ok: true, remaining: consumed.remainingPoints };
  } catch (err) {
    if (isRateLimiterRes(err)) {
      return { ok: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    console.warn(
      "[rateLimitBatchSend] Redis unavailable, failing open:",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: true, remaining: -1 };
  }
}

export function __resetRateLimitBatchForTests(): void {
  _limiter = null;
}
