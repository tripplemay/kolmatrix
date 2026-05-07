import { describe, expect, it, vi } from "vitest";

import {
  SPARKLINE_DAYS,
  TREND_WINDOW_DAYS,
  computeKpiTrend,
  computeSparkline,
  loadKpiTrends,
} from "../kpi-trends";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDay(offsetDays: number, ref: Date = new Date()): Date {
  const today = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())
  );
  return new Date(today.getTime() - offsetDays * MS_PER_DAY);
}

describe("computeKpiTrend", () => {
  it("flat when current === reference", () => {
    expect(computeKpiTrend(50, 50)).toEqual({ direction: "flat", percent: 0 });
  });

  it("up with rounded percent (1 decimal)", () => {
    // (110 - 100) / 100 = 10.0%
    expect(computeKpiTrend(110, 100)).toEqual({ direction: "up", percent: 10 });
    // (107 - 100) / 100 = 7.0%
    expect(computeKpiTrend(107, 100)).toEqual({ direction: "up", percent: 7 });
    // (101 - 80) / 80 = 26.25% → rounds to 26.3
    expect(computeKpiTrend(101, 80)).toEqual({ direction: "up", percent: 26.3 });
  });

  it("down with rounded percent", () => {
    // (80 - 100) / 100 = -20% → magnitude 20
    expect(computeKpiTrend(80, 100)).toEqual({ direction: "down", percent: 20 });
  });

  it("flat when reference is null and current is 0 (cold start)", () => {
    expect(computeKpiTrend(0, null)).toEqual({ direction: "flat", percent: 0 });
  });

  it("up with 0 percent when reference is null but current is positive", () => {
    // No prior data — direction is "up" (any growth from 0 baseline)
    // but percent is 0 because dividing by zero is meaningless.
    // Caller should anyway gate this branch via hasEnoughData=false.
    expect(computeKpiTrend(15, null)).toEqual({ direction: "up", percent: 0 });
  });

  it("flat when both current and reference are 0", () => {
    expect(computeKpiTrend(0, 0)).toEqual({ direction: "flat", percent: 0 });
  });
});

describe("computeSparkline", () => {
  it("fills entirely with 0 when history is empty", () => {
    const out = computeSparkline([], 7);
    expect(out).toHaveLength(7);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("returns the full history when every day is present", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      snapshotDate: utcDay(29 - i),
      value: i + 1,
    }));
    const out = computeSparkline(history, 30);
    expect(out).toHaveLength(30);
    expect(out[0]).toBe(1);
    expect(out[out.length - 1]).toBe(30);
  });

  it("forward-fills missing middle days with the previous value", () => {
    // Values for days -6, -3, 0 only; days -5,-4 inherit -6's value;
    // days -2,-1 inherit -3's value.
    const history = [
      { snapshotDate: utcDay(6), value: 5 },
      { snapshotDate: utcDay(3), value: 8 },
      { snapshotDate: utcDay(0), value: 12 },
    ];
    const out = computeSparkline(history, 7);
    expect(out).toEqual([5, 5, 5, 8, 8, 8, 12]);
  });

  it("leaves leading days as 0 when history starts mid-window", () => {
    // Only the last 2 days have data — first 5 stay at the cold-start 0.
    const history = [
      { snapshotDate: utcDay(1), value: 4 },
      { snapshotDate: utcDay(0), value: 9 },
    ];
    const out = computeSparkline(history, 7);
    expect(out).toEqual([0, 0, 0, 0, 0, 4, 9]);
  });

  it("returns [] for non-positive days", () => {
    expect(computeSparkline([], 0)).toEqual([]);
    expect(computeSparkline([], -3)).toEqual([]);
  });
});

describe("loadKpiTrends", () => {
  function buildTx(
    rows: Array<{
      snapshotDate: Date;
      kolCount: number;
      activeCampaigns: number;
      emailsSent7d: number;
      productCount: number;
    }>
  ) {
    return {
      kpiDailySnapshot: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
    } as unknown as Parameters<typeof loadKpiTrends>[0];
  }

  it("returns hasEnoughData=false when fewer than TREND_WINDOW_DAYS snapshots exist", async () => {
    const tx = buildTx([
      {
        snapshotDate: utcDay(0),
        kolCount: 50,
        activeCampaigns: 3,
        emailsSent7d: 12,
        productCount: 4,
      },
    ]);
    const trends = await loadKpiTrends(
      tx,
      "00000000-0000-0000-0000-000000000001"
    );
    expect(trends.kolCount.hasEnoughData).toBe(false);
    expect(trends.kolCount.direction).toBe("flat");
    expect(trends.kolCount.percent).toBe(0);
    // Sparkline shape still right (length === SPARKLINE_DAYS).
    expect(trends.kolCount.sparkline).toHaveLength(SPARKLINE_DAYS);
  });

  it("computes 7-vs-prior-7 trend when enough snapshots exist", async () => {
    // 14 snapshots day-by-day: kolCount grows linearly 100 → 113.
    // current (last) = 113; reference (TREND_WINDOW_DAYS=7 ago) = 106.
    // delta = 7 / 106 = 6.6%
    const rows = Array.from({ length: 14 }, (_, i) => ({
      snapshotDate: utcDay(13 - i),
      kolCount: 100 + i,
      activeCampaigns: 5,
      emailsSent7d: 0,
      productCount: 2,
    }));
    const tx = buildTx(rows);
    const trends = await loadKpiTrends(
      tx,
      "00000000-0000-0000-0000-000000000001"
    );
    expect(trends.kolCount.hasEnoughData).toBe(true);
    expect(trends.kolCount.direction).toBe("up");
    expect(trends.kolCount.percent).toBeCloseTo(6.6, 1);
    // Constant metric → flat trend.
    expect(trends.activeCampaigns.direction).toBe("flat");
    expect(trends.activeCampaigns.percent).toBe(0);
  });

  it("queries with the cutoff and tenant clause", async () => {
    const rows: Array<{
      snapshotDate: Date;
      kolCount: number;
      activeCampaigns: number;
      emailsSent7d: number;
      productCount: number;
    }> = [];
    const tx = buildTx(rows);
    const tenantId = "00000000-0000-0000-0000-000000000001";
    await loadKpiTrends(tx, tenantId);
    const findMany = tx.kpiDailySnapshot.findMany as unknown as ReturnType<
      typeof vi.fn
    >;
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.tenantId).toBe(tenantId);
    expect(arg.where.snapshotDate.gte).toBeInstanceOf(Date);
    expect(arg.orderBy).toEqual({ snapshotDate: "asc" });
  });

  it("exposes TREND_WINDOW_DAYS=7 and SPARKLINE_DAYS=30 contract constants", () => {
    expect(TREND_WINDOW_DAYS).toBe(7);
    expect(SPARKLINE_DAYS).toBe(30);
  });
});
