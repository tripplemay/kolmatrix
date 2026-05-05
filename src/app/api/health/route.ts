/**
 * GET /api/health — public health probe.
 *
 * Authoritative for the BI2 deploy pipeline: after a PM2 reload,
 * scripts/healthcheck.sh polls this endpoint 5× / 3s and rolls back
 * if it never returns HTTP 200 with `status: "healthy"`.
 *
 * Checks returned:
 *   - database: Prisma `SELECT 1` + round-trip latency
 *   - redis:    ioredis PING + round-trip latency (active use since
 *               BL-020-F005 wired login rate limit on this same client)
 *
 * BL-034 F007:
 *   - `git_sha` resolution moved to a module-load IIFE so the every-3s
 *     `scripts/healthcheck.sh` poll no longer forks `git rev-parse` per
 *     request (audit AUTH-H4 — execSync per-request can flood the event
 *     loop on a busy box).
 *   - Detail fields (`version`, `git_sha`) are gated behind
 *     `HEALTH_DETAIL_TOKEN`. When the env var is unset OR the request
 *     omits / mismatches the token, the response strips both fields so
 *     unauthenticated callers cannot fingerprint the running revision.
 *     Send the token via `?token=<value>` query string OR the
 *     `X-Health-Token` request header. CI / ops scripts
 *     (infrastructure/deploy-staging.sh, deploy-prod.sh post-deploy
 *     curl) need to inject the same value.
 *
 * Auth: `/api/**` is excluded by the middleware matcher in
 * src/middleware.ts, so this endpoint is unauthenticated by design.
 *
 * Error semantics: any failing check flips the top-level `status`
 * to "unhealthy" and returns HTTP 503. The JSON body is preserved
 * on both paths so healthcheck.sh (and humans) can see exactly which
 * subsystem broke.
 */
import packageJson from "../../../../package.json";
import { execSync } from "node:child_process";

import { prisma } from "@/lib/db";
import { pingRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache

type CheckOk = { status: "ok"; latency_ms: number };
type CheckError = { status: "error"; latency_ms: number; error: string };
type Check = CheckOk | CheckError;

// Bound the DB probe so the endpoint itself stays fast even when
// postgres is unreachable. Without this, Prisma waits on the TCP
// connection for ~2 minutes — far longer than healthcheck.sh's
// 3s poll interval (5× retries) can tolerate.
const DB_CHECK_TIMEOUT_MS = 1500;

// BL-034 F007: cache git_sha at module init so /api/health requests no
// longer fork `git rev-parse` per call. Falls back to GIT_SHA env (set
// by the CI / deploy script) when git is unavailable, then to the
// literal "unknown" so consumers always see a string.
const GIT_SHA: string = (() => {
  try {
    const head = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (head) return head;
  } catch {
    // fall through
  }
  if (process.env.GIT_SHA && process.env.GIT_SHA.trim() !== "") {
    return process.env.GIT_SHA;
  }
  return "unknown";
})();

async function checkDatabase(): Promise<CheckOk | CheckError> {
  const start = performance.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`timeout after ${DB_CHECK_TIMEOUT_MS}ms`)),
          DB_CHECK_TIMEOUT_MS
        )
      ),
    ]);
    return { status: "ok", latency_ms: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<CheckOk | CheckError> {
  // BL-020-F005: Redis is now in active use (login rate limit). Probe via
  // ioredis ping; the same client backs the rate-limiter so a healthy
  // probe means /login's defence-in-depth layer is functional.
  const start = performance.now();
  const result = await pingRedis();
  if (result.ok) {
    return {
      status: "ok",
      latency_ms: result.latencyMs ?? Math.round(performance.now() - start),
    };
  }
  return {
    status: "error",
    latency_ms: Math.round(performance.now() - start),
    error: result.error ?? "unknown",
  };
}

function isHealthy(checks: Record<string, Check>): boolean {
  return Object.values(checks).every((c) => c.status === "ok");
}

/**
 * BL-034 F007: detail-fields are visible only when the configured
 * HEALTH_DETAIL_TOKEN matches the inbound `?token=` / `X-Health-Token`.
 * Read the env at request time (not module init) so an ops `pm2 reload
 * --update-env` after writing .env takes effect without an app restart.
 */
function isDetailAuthorized(req: Request): boolean {
  const expected = process.env.HEALTH_DETAIL_TOKEN;
  if (!expected || expected.length === 0) return false;
  const url = new URL(req.url);
  const supplied =
    url.searchParams.get("token") ?? req.headers.get("x-health-token");
  return supplied === expected;
}

export async function GET(req: Request): Promise<Response> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks: Record<string, Check> = { database, redis };
  const healthy = isHealthy(checks);
  const showDetail = isDetailAuthorized(req);

  const body: Record<string, unknown> = {
    status: healthy ? "healthy" : "unhealthy",
    uptime_seconds: Math.round(process.uptime()),
    checks,
    timestamp: new Date().toISOString(),
  };
  if (showDetail) {
    body.version = packageJson.version;
    body.git_sha = GIT_SHA;
  }

  return Response.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
