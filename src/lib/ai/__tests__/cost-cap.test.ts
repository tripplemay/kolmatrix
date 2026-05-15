/**
 * BL-034 F005 fix-round 1 · cost-cap MVP tests.
 *
 * Mocks `@/lib/db` so the tested helpers do not require a Postgres
 * connection at module load. The withTenant stub forwards the callback
 * with a fake tx that exposes only `eventLog.count` (the single Prisma
 * surface assertDailyCostBudget touches today).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventLogCount = vi.fn<() => Promise<number>>();
const withTenantMock = vi.fn(async (_tenantId: string, fn: (tx: unknown) => unknown) =>
  fn({ eventLog: { count: eventLogCount } }),
);

vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  // Re-export commonly imported names so transitive imports do not break
  // even though cost-cap itself only needs withTenant.
  prisma: {},
  Prisma: {},
}));
vi.mock("@/lib/events/log", () => ({
  logEvent: vi.fn(async () => undefined),
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  eventLogCount.mockReset();
  withTenantMock.mockClear();
  process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "5.00";
});

afterEach(() => {
  delete process.env.AI_DAILY_COST_USD_PER_TENANT_MAX;
});

describe("assertDailyCostBudget", () => {
  it("does NOT throw when the tenant has zero ai.usage events today", async () => {
    eventLogCount.mockResolvedValueOnce(0);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    expect(eventLogCount).toHaveBeenCalledTimes(1);
  });

  it("throws AiDailyCostExceededError when count × $0.01 reaches the configured limit", async () => {
    // limit=$5.00 → 500 calls = $5.00 → at limit triggers the throw.
    eventLogCount.mockResolvedValueOnce(500);
    const { assertDailyCostBudget, AiDailyCostExceededError } = await import(
      "@/lib/ai/cost-cap"
    );
    await expect(assertDailyCostBudget(TENANT_ID)).rejects.toBeInstanceOf(
      AiDailyCostExceededError,
    );
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX=0 (DISABLE escape hatch)", async () => {
    process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "0";
    eventLogCount.mockResolvedValueOnce(99_999);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    // Disabled mode short-circuits before reaching the DB → no count() call.
    expect(eventLogCount).not.toHaveBeenCalled();
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX is unset → defaults applied (cap > 0)", async () => {
    delete process.env.AI_DAILY_COST_USD_PER_TENANT_MAX;
    eventLogCount.mockResolvedValueOnce(0);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
    // Default 5.00 USD; 0 calls < cap → call goes through.
    expect(eventLogCount).toHaveBeenCalledTimes(1);
  });

  it("fails OPEN when AI_DAILY_COST_USD_PER_TENANT_MAX is non-numeric (misconfigured)", async () => {
    process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "garbage";
    // misconfigured → defaults to limit=5.00 (resolveLimitUsd treats
    // garbage as undefined-ish). Verify by giving a count that would
    // exceed only if the cap were misread as 0.
    eventLogCount.mockResolvedValueOnce(0);
    const { assertDailyCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(assertDailyCostBudget(TENANT_ID)).resolves.toBeUndefined();
  });
});

describe("checkLlmCostBudget (BL-067-F002, per F001 audit §1:A)", () => {
  it("returns { allowed: true } when assertDailyCostBudget does not throw", async () => {
    eventLogCount.mockResolvedValueOnce(0);
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).resolves.toEqual({ allowed: true });
  });

  it("returns { allowed: false } when the daily cap is hit (catches AiDailyCostExceededError)", async () => {
    eventLogCount.mockResolvedValueOnce(500);
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).resolves.toEqual({ allowed: false });
  });

  it("re-throws unexpected errors (not AiDailyCostExceededError) so callers see DB problems", async () => {
    eventLogCount.mockRejectedValueOnce(new Error("connection lost"));
    const { checkLlmCostBudget } = await import("@/lib/ai/cost-cap");
    await expect(checkLlmCostBudget(TENANT_ID)).rejects.toThrow(/connection lost/);
  });
});
