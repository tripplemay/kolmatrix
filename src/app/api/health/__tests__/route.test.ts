/**
 * Unit tests for GET /api/health.
 *
 * Prisma is mocked at the module boundary so we can exercise both the
 * happy path and the DB failure path without a running DB (same pattern
 * as src/lib/__tests__/db.test.ts, BI1-F006).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn<(strings: TemplateStringsArray) => Promise<unknown>>();
const execSyncMock = vi.fn<(cmd: string) => string>();
const transactionRun = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({ $executeRawUnsafe: vi.fn() })
);

vi.mock("@prisma/client", () => {
  class PrismaClient {
    $queryRaw = queryRaw;
    $transaction = transactionRun;
  }
  return { Prisma: {}, PrismaClient };
});
vi.mock("@prisma/adapter-pg", () => {
  class PrismaPg {}
  return { PrismaPg };
});
vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
  default: { execSync: execSyncMock },
}));

process.env.DATABASE_URL ??= "postgresql://unit:unit@localhost:5432/unit_test";

const { GET } = await import("@/app/api/health/route");

beforeEach(() => {
  queryRaw.mockReset();
  transactionRun.mockClear();
  execSyncMock.mockReset();
  execSyncMock.mockReturnValue("unithead\n");
});

describe("GET /api/health", () => {
  it("returns 200 + status=healthy when the DB responds", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      git_sha: string;
      uptime_seconds: number;
      checks: { database: { status: string }; redis: { status: string } };
      timestamp: string;
    };
    expect(body.status).toBe("healthy");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.redis.status).toBe("not_used");
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it("returns 503 + status=unhealthy when the DB throws", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: { database: { status: string; error?: string } };
    };
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.error).toMatch(/ECONNREFUSED/);
  });

  it("falls back to GIT_SHA env when git HEAD cannot be resolved", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const prev = process.env.GIT_SHA;
    process.env.GIT_SHA = "deadbeef";
    execSyncMock.mockImplementationOnce(() => {
      throw new Error("git unavailable");
    });
    try {
      const res = await GET();
      const body = (await res.json()) as { git_sha: string };
      expect(body.git_sha).toBe("deadbeef");
    } finally {
      if (prev === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = prev;
    }
  });

  it("prefers git HEAD over stale GIT_SHA env", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const prev = process.env.GIT_SHA;
    process.env.GIT_SHA = "deadbeef";
    try {
      const res = await GET();
      const body = (await res.json()) as { git_sha: string };
      expect(body.git_sha).toBe("unithead");
    } finally {
      if (prev === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = prev;
    }
  });

  it("ships a no-store cache-control header", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
