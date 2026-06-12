/**
 * BL-034 F005 fix-round 1 · cost-cap MVP tests.
 * BL-113 F001 · rewritten for sum(real costUsd) + source=system exclusion.
 *
 * Mocks `@/lib/db` so the tested helpers do not require a Postgres
 * connection at module load. The withTenant stub forwards the callback
 * with a fake tx that exposes `$queryRaw` (the Prisma raw SQL surface
 * assertDailyCostBudget now uses to SUM real costUsd from payload).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();
const withTenantMock = vi.fn(async (_tenantId: string, fn: (tx: unknown) => unknown) =>
  fn({ $queryRaw: queryRawMock }),
);

vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));
vi.mock("@/lib/events/log", () => ({
  logEvent: vi.fn(async () => undefined),
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  queryRawMock.mockReset();
  withTenantMock.mockClear();
  process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "5.00";
});

afterEach(() => {
  delete process.env.AI_DAILY_COST_USD_PER_TENANT_MAX;
});

describe("assertDailyCostBudget", () => {
  it("does NOT throw when real cost sum = 0 (no ai.usage events today)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT throw when 500 backend events exist but real sum is $0.45 (the prod scenario)", async () => {
    // BL-113 root cause: 500 events × $0.0009 real = $0.45, below $5 limit.
    // Old count×$0.01 would have yielded $5.00 and triggered the cap.
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0.45" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
  });

  it("throws AiDailyCostExceededError when real sum reaches the configured limit ($5.00)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "5.00" }]);
    const { assertDailyCostBudget, AiDailyCostExceededError } = await import(
      "@/lib/ai/cost-cap"
    );
    await expect(assertDailyCostBudget(TENANT_ID)).rejects.toBeInstanceOf(
      AiDailyCostExceededError,
    );
  });

  it("does NOT throw when real sum is just under limit ($4.99)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "4.99" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
  });

  it("SQL query excludes source=system events (B filter in WHERE clause)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await assertDailyCostBudget(TENANT_ID);
    // Inspect the SQL template literal for the system exclusion filter.
    const sqlStrings = queryRawMock.mock.calls[0][0] as string[];
    const sql = sqlStrings.join("");
    expect(sql).toContain("system");
    expect(sql).toContain("source");
  });

  it("SQL query handles null/invalid costUsd as 0 (CASE WHEN regex guard)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await assertDailyCostBudget(TENANT_ID);
    const sqlStrings = queryRawMock.mock.calls[0][0] as string[];
    const sql = sqlStrings.join("");
    expect(sql).toMatch(/CASE|COALESCE/i);
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX=0 (DISABLE escape hatch)", async () => {
    process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "0";
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    // Disabled mode short-circuits before reaching the DB → no $queryRaw call.
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX is unset → defaults to $5 cap", async () => {
    delete process.env.AI_DAILY_COST_USD_PER_TENANT_MAX;
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX is non-numeric (misconfigured)", async () => {
    process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "garbage";
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
  });

  it("AiDailyCostExceededError carries real costUsdToday and limit", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "6.25" }]);
    const { assertDailyCostBudget, AiDailyCostExceededError } = await import(
      "@/lib/ai/cost-cap"
    );
    let err: unknown;
    try {
      await assertDailyCostBudget(TENANT_ID);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AiDailyCostExceededError);
    const typed = err as InstanceType<typeof AiDailyCostExceededError>;
    expect(typed.costUsdToday).toBeCloseTo(6.25);
    expect(typed.limitUsd).toBeCloseTo(5.0);
    expect(typed.tenantId).toBe(TENANT_ID);
  });
});

describe("checkLlmCostBudget (BL-067-F002, per F001 audit §1:A)", () => {
  it("returns { allowed: true } when assertDailyCostBudget does not throw", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "0" }]);
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).resolves.toEqual({ allowed: true });
  });

  it("returns { allowed: false } when the daily cap is hit (catches AiDailyCostExceededError)", async () => {
    queryRawMock.mockResolvedValueOnce([{ costUsdToday: "5.00" }]);
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).resolves.toEqual({ allowed: false });
  });

  it("re-throws unexpected errors (not AiDailyCostExceededError) so callers see DB problems", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection lost"));
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).rejects.toThrow(/connection lost/);
  });
});
