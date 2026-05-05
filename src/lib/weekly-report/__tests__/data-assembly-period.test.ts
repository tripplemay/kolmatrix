/**
 * BL-024-F003 — `assembleWeeklyReportInput` derives the prev-period
 * length from the current period bounds. Mocks `withTenant` to spy on
 * the prisma `findMany` calls so we can verify the prevWeek query uses
 * `weekStart - periodDays` rather than the hard-coded `-7d` legacy.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const kolCampaignCount = vi.fn().mockResolvedValue(0);
const auditLogFindMany = vi.fn().mockResolvedValue([]);
const emailLogCount = vi.fn().mockResolvedValue(0);
const campaignFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  withTenant: vi.fn(async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      kolCampaign: { count: kolCampaignCount },
      auditLog: { findMany: auditLogFindMany },
      emailLog: { count: emailLogCount },
      campaign: { findMany: campaignFindMany },
    })
  ),
}));

vi.mock("@/lib/roi/queries", () => ({
  loadRoiSummary: vi.fn().mockResolvedValue({
    totalSpend: 0,
    totalRevenue: 0,
    avgRoiPercent: null,
    topCampaign: null,
    campaignCount: { active: 0, completed: 0 },
  }),
}));

const { assembleWeeklyReportInput } = await import("../data-assembly");

const TENANT = "11111111-2222-3333-4444-555555555555";
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  kolCampaignCount.mockReset().mockResolvedValue(0);
  auditLogFindMany.mockReset().mockResolvedValue([]);
  emailLogCount.mockReset().mockResolvedValue(0);
  campaignFindMany.mockReset().mockResolvedValue([]);
});

describe("assembleWeeklyReportInput period derivation", () => {
  it("uses 7-day prev period for a 7-day weekStart/weekEnd window", async () => {
    const weekStart = new Date("2026-05-04T00:00:00.000Z"); // Mon
    const weekEnd = new Date("2026-05-10T00:00:00.000Z"); // Sun

    await assembleWeeklyReportInput({ tenantId: TENANT, weekStart, weekEnd });

    // campaign.findMany was called twice: this-period + prev-period.
    expect(campaignFindMany).toHaveBeenCalledTimes(2);
    const prevCall = campaignFindMany.mock.calls[1][0];
    expect(prevCall.where.closedAt.gte).toEqual(
      new Date(weekStart.getTime() - 7 * DAY_MS)
    );
    expect(prevCall.where.closedAt.lt).toEqual(weekStart);
  });

  it("uses 28-day prev period for a 28-day weekStart/weekEnd window (lastMonth)", async () => {
    // lastMonth: 4 ISO weeks ending 2026-05-10 Sunday.
    const weekStart = new Date("2026-04-13T00:00:00.000Z"); // Mon
    const weekEnd = new Date("2026-05-10T00:00:00.000Z"); // Sun, +27d

    await assembleWeeklyReportInput({ tenantId: TENANT, weekStart, weekEnd });

    expect(campaignFindMany).toHaveBeenCalledTimes(2);
    const prevCall = campaignFindMany.mock.calls[1][0];
    // Prev period must reach back another 28 days, NOT the legacy 7d.
    expect(prevCall.where.closedAt.gte).toEqual(
      new Date(weekStart.getTime() - 28 * DAY_MS)
    );
    expect(prevCall.where.closedAt.lt).toEqual(weekStart);
  });

  it("emailLog count uses the same widened window", async () => {
    const weekStart = new Date("2026-04-13T00:00:00.000Z");
    const weekEnd = new Date("2026-05-10T00:00:00.000Z");
    const weekEndExclusive = new Date(weekEnd.getTime() + DAY_MS);

    await assembleWeeklyReportInput({ tenantId: TENANT, weekStart, weekEnd });

    // emailLog.count called twice (sent variants + ai-customized); both
    // must use the same `gte/lt` bounds.
    expect(emailLogCount).toHaveBeenCalledTimes(2);
    for (const call of emailLogCount.mock.calls) {
      expect(call[0].where.sentAt.gte).toEqual(weekStart);
      expect(call[0].where.sentAt.lt).toEqual(weekEndExclusive);
    }
  });
});
