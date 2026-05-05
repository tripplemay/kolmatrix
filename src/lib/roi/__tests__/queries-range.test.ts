/**
 * BL-024-F002 — ROI loaders apply the time-range cutoff correctly.
 *
 * Mocks `@/lib/db.withTenant` to capture the prisma.findMany args so
 * we can prove each range key produces the right `where` clause:
 *   - 7d  → completed campaigns: closedAt gte NOW-7d
 *   - 30d → completed campaigns: closedAt gte NOW-30d
 *   - 90d → completed campaigns: closedAt gte NOW-90d
 *   - allTime → no closedAt clause; non-completed campaigns always
 *               counted regardless of cutoff (active KPI invariant)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  withTenant: vi.fn(
    async (
      _tenantId: string,
      fn: (tx: { campaign: { findMany: typeof findManyMock } }) => Promise<unknown>
    ) =>
      fn({
        campaign: { findMany: findManyMock },
      })
  ),
}));

const { loadRoiSummary, loadRoiCampaigns } = await import("../queries");

const TENANT = "11111111-2222-3333-4444-555555555555";
const NOW_MS = new Date("2026-05-05T12:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  findManyMock.mockReset().mockResolvedValue([]);
});

describe("loadRoiSummary range filter", () => {
  it.each([
    ["7d" as const, 7],
    ["30d" as const, 30],
    ["90d" as const, 90],
  ])(
    "applies closedAt gte NOW-%s and OR-allows non-completed campaigns",
    async (range, days) => {
      await loadRoiSummary(TENANT, range, NOW_MS);
      const args = findManyMock.mock.calls[0][0];
      expect(args.where.deletedAt).toBeNull();
      expect(args.where.OR).toBeDefined();
      const completedClause = args.where.OR.find(
        (c: { closedAt?: { gte: Date } }) => c.closedAt
      );
      expect(completedClause.closedAt.gte).toEqual(
        new Date(NOW_MS - days * DAY_MS)
      );
      const nonCompletedClause = args.where.OR.find(
        (c: { status?: { not: string } }) => c.status?.not === "completed"
      );
      expect(nonCompletedClause).toBeDefined();
    }
  );

  it("applies no closedAt cutoff for allTime", async () => {
    await loadRoiSummary(TENANT, "allTime", NOW_MS);
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.OR).toBeUndefined();
    expect(args.where.deletedAt).toBeNull();
  });
});

describe("loadRoiCampaigns range filter", () => {
  it.each([
    ["7d" as const, 7],
    ["30d" as const, 30],
    ["90d" as const, 90],
  ])(
    "filters completed campaigns by closedAt gte NOW-%s",
    async (range, days) => {
      await loadRoiCampaigns(TENANT, range, NOW_MS);
      const args = findManyMock.mock.calls[0][0];
      expect(args.where.status).toBe("completed");
      expect(args.where.closedAt.gte).toEqual(
        new Date(NOW_MS - days * DAY_MS)
      );
    }
  );

  it("omits closedAt cutoff for allTime", async () => {
    await loadRoiCampaigns(TENANT, "allTime", NOW_MS);
    const args = findManyMock.mock.calls[0][0];
    expect(args.where.status).toBe("completed");
    expect(args.where.closedAt).toBeUndefined();
  });
});
