import { describe, expect, it } from "vitest";

import {
  computeCampaignRoi,
  computeRoiSummary,
  computeRoiTrend,
} from "../compute";

describe("computeCampaignRoi", () => {
  it("returns null when revenue is unset", () => {
    expect(
      computeCampaignRoi({ spendTotal: 100, revenueRecorded: null })
    ).toEqual({ roiPercent: null, netProfit: 0 });
  });

  it("computes ROI for a positive spend with recorded revenue", () => {
    expect(
      computeCampaignRoi({ spendTotal: 100, revenueRecorded: 150 })
    ).toEqual({ roiPercent: 50, netProfit: 50 });
  });

  it("computes negative ROI when spend > revenue", () => {
    expect(
      computeCampaignRoi({ spendTotal: 200, revenueRecorded: 100 })
    ).toEqual({ roiPercent: -50, netProfit: -100 });
  });

  it("rounds to one decimal place", () => {
    const out = computeCampaignRoi({ spendTotal: 300, revenueRecorded: 331 });
    expect(out.roiPercent).toBe(10.3);
  });

  it("returns null roi when spend is zero (div-by-zero guard)", () => {
    expect(
      computeCampaignRoi({ spendTotal: 0, revenueRecorded: 100 })
    ).toEqual({ roiPercent: null, netProfit: 100 });
  });

  it("returns null roi when spend is negative", () => {
    expect(
      computeCampaignRoi({ spendTotal: -10, revenueRecorded: 100 })
    ).toEqual({ roiPercent: null, netProfit: 110 });
  });
});

describe("computeRoiTrend", () => {
  // Pin to a known UTC midnight so daily slot math is deterministic.
  const NOW_MS = Date.parse("2026-04-24T15:30:00.000Z");

  it("emits exactly N daily points ending today (UTC)", () => {
    const trend = computeRoiTrend([], 5, NOW_MS);
    expect(trend).toHaveLength(5);
    expect(trend[trend.length - 1]!.date).toBe("2026-04-24");
    expect(trend[0]!.date).toBe("2026-04-20");
    for (const p of trend) {
      expect(p.spendTotal).toBe(0);
      expect(p.revenue).toBe(0);
      expect(p.roiPercent).toBeNull();
    }
  });

  it("buckets a campaign into the day matching its closedAt", () => {
    const trend = computeRoiTrend(
      [
        {
          closedAt: new Date("2026-04-22T08:00:00Z"),
          spendTotal: 100,
          revenueRecorded: 200,
        },
        {
          closedAt: new Date("2026-04-22T22:30:00Z"),
          spendTotal: 50,
          revenueRecorded: 80,
        },
        {
          closedAt: new Date("2026-04-24T01:00:00Z"),
          spendTotal: 25,
          revenueRecorded: 100,
        },
      ],
      5,
      NOW_MS
    );
    const byDate = Object.fromEntries(trend.map((p) => [p.date, p]));
    expect(byDate["2026-04-22"]!.spendTotal).toBe(150);
    expect(byDate["2026-04-22"]!.revenue).toBe(280);
    // (280-150)/150 = 0.8666… → 86.7%
    expect(byDate["2026-04-22"]!.roiPercent).toBeCloseTo(86.7, 1);
    expect(byDate["2026-04-24"]!.spendTotal).toBe(25);
    expect(byDate["2026-04-24"]!.roiPercent).toBe(300);
  });

  it("ignores campaigns closed outside the window", () => {
    const trend = computeRoiTrend(
      [
        {
          closedAt: new Date("2026-03-01T00:00:00Z"),
          spendTotal: 500,
          revenueRecorded: 1000,
        },
      ],
      5,
      NOW_MS
    );
    expect(trend.every((p) => p.spendTotal === 0)).toBe(true);
  });

  it("returns null roi when both spend and revenue are zero on a slot", () => {
    const trend = computeRoiTrend(
      [
        {
          closedAt: new Date("2026-04-22T00:00:00Z"),
          spendTotal: 0,
          revenueRecorded: 0,
        },
      ],
      5,
      NOW_MS
    );
    const day = trend.find((p) => p.date === "2026-04-22")!;
    expect(day.spendTotal).toBe(0);
    expect(day.revenue).toBe(0);
    expect(day.roiPercent).toBeNull();
  });

  it("returns [] for days <= 0", () => {
    expect(computeRoiTrend([], 0, NOW_MS)).toEqual([]);
    expect(computeRoiTrend([], -3, NOW_MS)).toEqual([]);
  });
});

describe("computeRoiSummary", () => {
  it("aggregates totals, counts active/completed, and picks topCampaign", () => {
    const out = computeRoiSummary([
      {
        id: "a",
        name: "A",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 200,
      },
      {
        id: "b",
        name: "B",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 250,
      },
      {
        id: "c",
        name: "C",
        status: "active",
        spendTotal: 50,
        revenueRecorded: null,
      },
    ]);
    expect(out.totalSpend).toBe(250);
    expect(out.totalRevenue).toBe(450);
    expect(out.campaignCount).toEqual({ active: 1, completed: 2 });
    // (100% + 150%) / 2 = 125%
    expect(out.avgRoiPercent).toBe(125);
    expect(out.topCampaign).toEqual({ id: "b", name: "B", roiPercent: 150 });
  });

  it("returns null avgRoi + null topCampaign when no completed has both spend and revenue", () => {
    const out = computeRoiSummary([
      {
        id: "a",
        name: "A",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: null,
      },
      {
        id: "b",
        name: "B",
        status: "completed",
        spendTotal: 0,
        revenueRecorded: 100,
      },
      {
        id: "c",
        name: "C",
        status: "draft",
        spendTotal: 0,
        revenueRecorded: null,
      },
    ]);
    expect(out.avgRoiPercent).toBeNull();
    expect(out.topCampaign).toBeNull();
    expect(out.campaignCount).toEqual({ active: 0, completed: 2 });
  });

  it("rounds avgRoi to one decimal", () => {
    const out = computeRoiSummary([
      {
        id: "a",
        name: "A",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 133,
      },
      {
        id: "b",
        name: "B",
        status: "completed",
        spendTotal: 100,
        revenueRecorded: 167,
      },
    ]);
    // 33% + 67% = 50%, exactly
    expect(out.avgRoiPercent).toBe(50);
  });

  it("handles an empty input", () => {
    expect(computeRoiSummary([])).toEqual({
      totalSpend: 0,
      totalRevenue: 0,
      avgRoiPercent: null,
      topCampaign: null,
      campaignCount: { active: 0, completed: 0 },
    });
  });
});
