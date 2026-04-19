/**
 * GET /api/health — public health probe.
 *
 * Authoritative for the BI2 deploy pipeline: after a PM2 reload,
 * scripts/healthcheck.sh polls this endpoint 5× / 3s and rolls back
 * if it never returns HTTP 200 with `status: "healthy"`.
 *
 * Checks returned:
 *   - database: Prisma `SELECT 1` + round-trip latency
 *   - redis:    stub until B5 wires BullMQ (spec §F001 "BI2 期间可 stub 返回 ok")
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

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache

type CheckOk = { status: "ok"; latency_ms: number };
type CheckError = { status: "error"; latency_ms: number; error: string };
type CheckStub = { status: "stub"; note: string };
type Check = CheckOk | CheckError | CheckStub;

// Bound the DB probe so the endpoint itself stays fast even when
// postgres is unreachable. Without this, Prisma waits on the TCP
// connection for ~2 minutes — far longer than healthcheck.sh's
// 3s poll interval (5× retries) can tolerate.
const DB_CHECK_TIMEOUT_MS = 1500;

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

function checkRedisStub(): CheckStub {
  // B5 will replace this with a real Redis PING via the BullMQ client.
  return { status: "stub", note: "wired in B5 with BullMQ" };
}

function isHealthy(checks: Record<string, Check>): boolean {
  return Object.values(checks).every((c) => c.status === "ok" || c.status === "stub");
}

export async function GET(): Promise<Response> {
  const [database] = await Promise.all([checkDatabase()]);
  const redis = checkRedisStub();

  const checks: Record<string, Check> = { database, redis };
  const healthy = isHealthy(checks);

  const body = {
    status: healthy ? "healthy" : "unhealthy",
    version: packageJson.version,
    git_sha: process.env.GIT_SHA ?? "unknown",
    uptime_seconds: Math.round(process.uptime()),
    checks,
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
