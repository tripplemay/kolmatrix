/**
 * Unit tests for `@/lib/db` — validation, transaction wrapping, and raw
 * SQL payload. The real Prisma client and the pg adapter are mocked so
 * the suite runs in jsdom without a DB. RLS itself is covered by the
 * integration suite; here we prove the wrapper produces the right
 * `SET LOCAL` string and returns the callback result intact.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const execRaw = vi.fn<(sql: string) => Promise<number>>();
const transactionRun = vi.fn(async (fn: (tx: { $executeRawUnsafe: typeof execRaw }) => unknown) =>
  fn({ $executeRawUnsafe: execRaw })
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
  });

  it("opens a transaction and pins app.tenant_id via SET LOCAL", async () => {
    await withTenant(VALID_UUID, async () => "ok");
    expect(transactionRun).toHaveBeenCalledTimes(1);
    expect(execRaw).toHaveBeenCalledTimes(1);
    expect(execRaw).toHaveBeenCalledWith(`SET LOCAL app.tenant_id = '${VALID_UUID}'`);
  });

  it("returns the callback result unchanged", async () => {
    const result = await withTenant(VALID_UUID, async () => ({ rows: [1, 2, 3] }));
    expect(result).toEqual({ rows: [1, 2, 3] });
  });
});

describe("withPlatformAdmin", () => {
  it("opens a transaction and sets app.is_platform_admin = true", async () => {
    await withPlatformAdmin(async () => "ok");
    expect(transactionRun).toHaveBeenCalledTimes(1);
    expect(execRaw).toHaveBeenCalledWith(`SET LOCAL app.is_platform_admin = 'true'`);
  });

  it("returns the callback result unchanged", async () => {
    const result = await withPlatformAdmin(async () => 42);
    expect(result).toBe(42);
  });
});
