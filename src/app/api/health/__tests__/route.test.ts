/**
 * Unit tests for GET /api/health.
 *
 * Prisma is mocked at the module boundary so we can exercise both the
 * happy path and the DB failure path without a running DB (same pattern
 * as src/lib/__tests__/db.test.ts, BI1-F006).
 *
 * BL-034 F007 update:
 *   - GET now requires a Request argument (token guard reads
 *     req.url + req.headers).
 *   - GIT_SHA is captured at module init via execSync once. Tests that
 *     want to override the cached value have to set it before the
 *     dynamic import below; per-test execSync mocks no longer affect
 *     resolveGitSha().
 *   - Detail fields (`version`, `git_sha`) only appear when the request
 *     supplies a matching HEALTH_DETAIL_TOKEN.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn<(strings: TemplateStringsArray) => Promise<unknown>>();
const queryRawUnsafe = vi.fn<(sql: string) => Promise<unknown>>();
const execSyncMock = vi.fn<(cmd: string) => string>();
const pingRedisMock = vi.fn<() => Promise<{ ok: boolean; latencyMs?: number; error?: string }>>();
const transactionRun = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({ $executeRaw: vi.fn(), $queryRawUnsafe: queryRawUnsafe })
);

vi.mock("@prisma/client", () => {
  class PrismaClient {
    $queryRaw = queryRaw;
    $queryRawUnsafe = queryRawUnsafe;
    $transaction = transactionRun;
  }
  return { Prisma: {}, PrismaClient };
});
vi.mock("@prisma/adapter-pg", () => {
  class PrismaPg {}
  return { PrismaPg };
});
vi.mock("@/lib/redis", () => ({
  pingRedis: () => pingRedisMock(),
}));
vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
  default: { execSync: execSyncMock },
}));

process.env.DATABASE_URL ??= "postgresql://unit:unit@localhost:5432/unit_test";
// Module-init IIFE captures GIT_SHA once: pin the mock return so tests
// downstream see "unithead" as the cached value.
execSyncMock.mockReturnValue("unithead\n");

const { GET } = await import("@/app/api/health/route");
const { resetKolCoverageCache } = await import("@/app/api/health/kol-coverage-cache");

const HEALTH_TOKEN = "unit-test-token";

beforeAll(() => {
  process.env.HEALTH_DETAIL_TOKEN = HEALTH_TOKEN;
});

afterAll(() => {
  delete process.env.HEALTH_DETAIL_TOKEN;
});

beforeEach(() => {
  queryRaw.mockReset();
  queryRawUnsafe.mockReset();
  transactionRun.mockClear();
  pingRedisMock.mockReset();
  pingRedisMock.mockResolvedValue({ ok: true, latencyMs: 2 });
  // BL-075-F006 default: every test starts with a fresh kol_coverage
  // cache + stub stats that satisfy the snapshot shape. Tests that
  // care about the actual numbers override via mockResolvedValueOnce.
  resetKolCoverageCache();
  // BL-075-F006 default: queryRawUnsafe is the workhorse for the
  // coverage snapshot. It's called per-tenant in 2 steps:
  //   1. SELECT id FROM tenant
  //   2. SELECT set_config('app.tenant_id', $1, true)
  //   3. SELECT COUNT(*) ... FROM kol WHERE ...
  // Default stub returns 0 tenants so the loop short-circuits and we
  // get total=0. Tests that exercise the snapshot override per-call
  // via mockResolvedValueOnce in the same order.
  queryRawUnsafe.mockResolvedValue([]);
});

function authedRequest(): Request {
  return new Request(`https://app.test/api/health?token=${HEALTH_TOKEN}`);
}
function plainRequest(): Request {
  return new Request("https://app.test/api/health");
}
function headerAuthedRequest(): Request {
  return new Request("https://app.test/api/health", {
    headers: { "X-Health-Token": HEALTH_TOKEN },
  });
}

describe("GET /api/health", () => {
  it("returns 200 + status=healthy when the DB responds (token-authed → detail visible)", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(authedRequest());
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
    expect(body.git_sha).toBe("unithead");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.redis.status).toBe("ok");
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it("returns 503 + status=unhealthy when the DB throws", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    const res = await GET(authedRequest());
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: { database: { status: string; error?: string } };
    };
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.error).toMatch(/ECONNREFUSED/);
  });

  it("returns 503 + redis.status=error when Redis ping fails", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    pingRedisMock.mockResolvedValueOnce({ ok: false, error: "ETIMEDOUT" });
    const res = await GET(authedRequest());
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      checks: { redis: { status: string; error?: string } };
    };
    expect(body.status).toBe("unhealthy");
    expect(body.checks.redis.status).toBe("error");
    expect(body.checks.redis.error).toBe("ETIMEDOUT");
  });

  it("BL-034 F007: omits version + git_sha when no token is supplied", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(plainRequest());
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("git_sha");
    // Status fields are unconditional.
    expect(body.status).toBe("healthy");
    expect(body.checks).toBeDefined();
  });

  it("BL-034 F007: omits version + git_sha when supplied token is wrong", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(new Request("https://app.test/api/health?token=wrong"));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("git_sha");
  });

  it("BL-034 F007: returns detail when token arrives via X-Health-Token header", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(headerAuthedRequest());
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.git_sha).toBe("unithead");
    expect(body.version).toBeDefined();
  });

  it("BL-034 F007: omits detail entirely when HEALTH_DETAIL_TOKEN env is unset", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const prev = process.env.HEALTH_DETAIL_TOKEN;
    delete process.env.HEALTH_DETAIL_TOKEN;
    try {
      const res = await GET(authedRequest());
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("version");
      expect(body).not.toHaveProperty("git_sha");
    } finally {
      process.env.HEALTH_DETAIL_TOKEN = prev!;
    }
  });

  it("ships a no-store cache-control header", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(plainRequest());
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("BL-075-F006: includes kol_coverage with country/language fill rates + total + last_updated", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    // Sequence: (1) list tenants → 1 row, (2) set_config → empty,
    // (3) per-tenant aggregate counts → 1397 / 700 / 945.
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "tenant-a" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 1397, country_filled: 700, language_filled: 945 },
      ]);
    const res = await GET(plainRequest());
    const body = (await res.json()) as {
      kol_coverage?: {
        country_fill_rate: number;
        language_fill_rate: number;
        total_active_kols: number;
        last_updated: string;
      };
    };
    expect(body.kol_coverage).toBeDefined();
    expect(body.kol_coverage!.total_active_kols).toBe(1397);
    expect(body.kol_coverage!.country_fill_rate).toBeCloseTo(700 / 1397, 4);
    expect(body.kol_coverage!.language_fill_rate).toBeCloseTo(945 / 1397, 4);
    expect(() => new Date(body.kol_coverage!.last_updated).toISOString()).not.toThrow();
  });

  it("BL-075-F006: aggregates across multiple tenants", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "tenant-a" }, { id: "tenant-b" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 1000, country_filled: 200, language_filled: 500 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 400, country_filled: 100, language_filled: 200 },
      ]);
    const res = await GET(plainRequest());
    const body = (await res.json()) as {
      kol_coverage: { total_active_kols: number; country_fill_rate: number };
    };
    expect(body.kol_coverage.total_active_kols).toBe(1400);
    expect(body.kol_coverage.country_fill_rate).toBeCloseTo(300 / 1400, 4);
  });

  it("BL-075-F006: cache reuse — second request within TTL does not re-query the DB", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "tenant-a" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 100, country_filled: 50, language_filled: 80 },
      ]);
    await GET(plainRequest());
    const firstCallCount = queryRawUnsafe.mock.calls.length;
    await GET(plainRequest());
    expect(queryRawUnsafe.mock.calls.length).toBe(firstCallCount);
  });

  it("BL-075-F006: snapshot query failure does not flip health to unhealthy", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    queryRawUnsafe.mockRejectedValueOnce(new Error("relation \"kol\" does not exist"));
    const res = await GET(plainRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("healthy");
    expect(body).not.toHaveProperty("kol_coverage");
  });

  it("BL-075-F006: zero tenants returns fill_rate=0 cleanly (no divide-by-zero)", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    // The default mock returns [] for the tenant list — loop exits
    // immediately, total=0, fill_rates=0.
    const res = await GET(plainRequest());
    const body = (await res.json()) as {
      kol_coverage: { total_active_kols: number; country_fill_rate: number };
    };
    expect(body.kol_coverage.total_active_kols).toBe(0);
    expect(body.kol_coverage.country_fill_rate).toBe(0);
  });
});
