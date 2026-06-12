/**
 * BL-107-F001 (M8) · ROI insights action payload honesty.
 *
 * Audit finding (full-feature-chain-audit-2026-06-09 §M8): the action fed
 * the AI `startedAt:null` + `kolCount:0` for every campaign — hardcoded
 * values the ROI loader never sources. This regression test pins the fix:
 * the campaigns handed to `generateRoiInsights` must carry ONLY the fields
 * the loader actually provides, with no fabricated startedAt/kolCount keys.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const rateLimitAiMock = vi
  .fn<() => Promise<{ ok: true } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true });
vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: () => rateLimitAiMock(),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

const loadRoiSummaryMock = vi.fn();
const loadRoiCampaignsMock = vi.fn();
vi.mock("@/lib/roi/queries", () => ({
  loadRoiSummary: (...args: unknown[]) => loadRoiSummaryMock(...args),
  loadRoiCampaigns: (...args: unknown[]) => loadRoiCampaignsMock(...args),
}));

const generateRoiInsightsMock = vi.fn();
vi.mock("@/lib/roi/insights", () => ({
  generateRoiInsights: (...args: unknown[]) => generateRoiInsightsMock(...args),
  // Catch path references `instanceof RoiInsightsError`; the happy-path
  // test never throws, but the import must resolve the symbol.
  RoiInsightsError: class RoiInsightsError extends Error {},
}));

const { generateRoiInsightsAction } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeEach(() => {
  authMock
    .mockReset()
    .mockResolvedValue({ user: { tenantId: TENANT, id: USER } });
  rateLimitAiMock.mockReset().mockResolvedValue({ ok: true });
  logEventMock.mockReset().mockResolvedValue(undefined);
  loadRoiSummaryMock.mockReset().mockResolvedValue({
    totalSpend: 100,
    totalRevenue: 273,
    avgRoiPercent: 173,
    topCampaign: { name: "Galactic Forge Alpha", roiPercent: 173 },
  });
  loadRoiCampaignsMock.mockReset().mockResolvedValue([
    {
      id: "c1",
      name: "Galactic Forge Alpha",
      status: "completed",
      productName: "Galactic Forge",
      spendTotal: 100,
      revenueRecorded: 273,
      roiPercent: 173,
      netProfit: 173,
      closedAt: "2026-04-01T00:00:00Z",
    },
  ]);
  generateRoiInsightsMock
    .mockReset()
    .mockResolvedValue({ insights: [], traceId: "trc_x" });
});

describe("generateRoiInsightsAction payload (BL-107-F001 M8)", () => {
  it("does NOT feed fabricated startedAt/kolCount to the AI", async () => {
    const res = await generateRoiInsightsAction("en");
    expect(res.ok).toBe(true);

    expect(generateRoiInsightsMock).toHaveBeenCalledTimes(1);
    const input = generateRoiInsightsMock.mock.calls[0][0];
    const campaign = input.campaigns[0];

    expect(campaign).not.toHaveProperty("startedAt");
    expect(campaign).not.toHaveProperty("kolCount");
  });

  it("forwards only the real loader-sourced campaign fields", async () => {
    await generateRoiInsightsAction("en");
    const input = generateRoiInsightsMock.mock.calls[0][0];

    expect(input.campaigns[0]).toEqual({
      name: "Galactic Forge Alpha",
      product: "Galactic Forge",
      spendTotal: 100,
      revenueRecorded: 273,
      roiPercent: 173,
      closedAt: "2026-04-01T00:00:00Z",
    });
  });
});
