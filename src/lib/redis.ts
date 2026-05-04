/**
 * BL-020-F005 — shared Redis client for KOLMatrix.
 *
 * Prod / staging point at the same Redis instance configured in
 * `environment.md` (db idx 1 / 2 respectively) via REDIS_URL.
 * Selection rationale (spec §D3):
 *   - ioredis: TCP self-hosted; future BullMQ workers reuse this client.
 *   - Lazy singleton so health probes / login rate-limit / future jobs
 *     all share one connection pool per process.
 *
 * Failure mode: callers that need to fall back when Redis is down should
 * catch errors from this module's exports themselves. `getRedis()` does
 * not throw on connection refusal — the underlying ioredis client
 * surfaces errors through its own EventEmitter and per-command rejection.
 */
import IORedis from "ioredis";

let _client: IORedis | null = null;

export function getRedis(): IORedis {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }
  _client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: false,
    enableReadyCheck: true,
  });
  _client.on("error", (err) => {
    console.error("[redis] error:", err.message);
  });
  return _client;
}

export async function pingRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    const t0 = Date.now();
    await getRedis().ping();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Test-only: drop the cached singleton so a fresh `getRedis()` call
 * builds a new client (e.g. when integration tests swap REDIS_URL between
 * containers, or when a unit test wants to reset an injected mock).
 */
export function __resetRedisForTests(): void {
  if (_client) {
    void _client.quit().catch(() => {});
  }
  _client = null;
}
