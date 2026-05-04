/**
 * Unit tests for `@/lib/db` — validation, transaction wrapping, and the
 * parameterised set_config payload (BL-020-F004 — H-S1 SQL 注入参数化).
 * The real Prisma client and the pg adapter are mocked so the suite runs
 * in jsdom without a DB. RLS enforcement is covered by the integration
 * suite (tests/integration/db-set-config-rls.test.ts); here we prove the
 * wrapper invokes `$executeRaw` as a tagged template so Prisma binds the
 * tenant id as a parameter (no string interpolation = no injection).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const execRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>>();
const transactionRun = vi.fn(
  async (fn: (tx: { $executeRaw: typeof execRaw }) => unknown) => fn({ $executeRaw: execRaw })
);

vi.mock("@prisma/client", () => {
  class PrismaClient {
    $transaction = transactionRun;
  }
  return { Prisma: {}, PrismaClient };
});
vi.mock("@prisma/adapter-pg", () => {
  class PrismaPg {}
  return { PrismaPg };
});

process.env.DATABASE_URL ??= "postgresql://unit:unit@localhost:5432/unit_test";

// Dynamic import after mocks so module init sees them.
const { withTenant, withPlatformAdmin } = await import("@/lib/db");

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  execRaw.mockReset();
  execRaw.mockResolvedValue(0);
  transactionRun.mockClear();
});

describe("withTenant", () => {
  it("rejects non-UUID tenant ids before opening a transaction", async () => {
    await expect(withTenant("not-a-uuid", async () => "nope")).rejects.toThrow(
      /tenantId must be a UUID string/
    );
    expect(transactionRun).not.toHaveBeenCalled();
    expect(execRaw).not.toHaveBeenCalled();
  });

  it("rejects SQL-injection-shaped tenant ids before any DB call", async () => {
    await expect(
      withTenant("'; DROP TABLE asset --", async () => "nope")
    ).rejects.toThrow(/tenantId must be a UUID string/);
    expect(transactionRun).not.toHaveBeenCalled();
    expect(execRaw).not.toHaveBeenCalled();
  });

  it("opens a transaction and pins app.tenant_id via parameterised set_config", async () => {
    await withTenant(VALID_UUID, async () => "ok");
    expect(transactionRun).toHaveBeenCalledTimes(1);
    expect(execRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = execRaw.mock.calls[0];
    expect(Array.from(strings)).toEqual([
      "SELECT set_config('app.tenant_id', ",
      ", true)",
    ]);
    expect(values).toEqual([VALID_UUID]);
  });

  it("returns the callback result unchanged", async () => {
    const result = await withTenant(VALID_UUID, async () => ({ rows: [1, 2, 3] }));
    expect(result).toEqual({ rows: [1, 2, 3] });
  });
});

describe("withPlatformAdmin", () => {
  it("opens a transaction and sets app.is_platform_admin via parameterised set_config", async () => {
    await withPlatformAdmin(async () => "ok");
    expect(transactionRun).toHaveBeenCalledTimes(1);
    expect(execRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = execRaw.mock.calls[0];
    expect(Array.from(strings)).toEqual([
      "SELECT set_config('app.is_platform_admin', 'true', true)",
    ]);
    expect(values).toEqual([]);
  });

  it("returns the callback result unchanged", async () => {
    const result = await withPlatformAdmin(async () => 42);
    expect(result).toBe(42);
  });
});
