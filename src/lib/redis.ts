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

/**
 * BL-100-F001 — dedicated Redis connection for BullMQ.
 *
 * BullMQ Workers issue blocking commands (BRPOPLPUSH / BZPOPMIN) and
 * refuse any ioredis connection whose `maxRetriesPerRequest` is not
 * `null` (it would throw on construction in v5). The default `getRedis()`
 * client above keeps `maxRetriesPerRequest: 3` so login rate-limit /
 * health probes fail fast; BullMQ needs its own client with retries
 * disabled. We share ONE base connection across all Queue producers and
 * `.duplicate()` it per Worker (blocking ops must not share a socket with
 * producer ops) — see `src/lib/jobs/bullmq-queue.ts`.
 *
 * Lazy singleton so a process without any enqueued jobs never opens it.
 */
let _bullClient: IORedis | null = null;

export function getBullConnection(): IORedis {
  if (_bullClient) return _bullClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }
  _bullClient = new IORedis(url, {
    // Required by BullMQ for blocking worker commands.
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    enableReadyCheck: false,
  });
  _bullClient.on("error", (err) => {
    console.error("[redis:bull] error:", err.message);
  });
  return _bullClient;
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
  if (_bullClient) {
    void _bullClient.quit().catch(() => {});
  }
  _bullClient = null;
}
