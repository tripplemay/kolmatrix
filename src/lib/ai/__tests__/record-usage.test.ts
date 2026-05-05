/**
 * BL-034 F005 fix-round 1 · `recordAiUsage` writes the expected
 * event_log row shape so downstream `assertDailyCostBudget` count
 * can pick it up.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const logEventMock = vi.fn<(payload: unknown) => Promise<void>>(async () => undefined);

vi.mock("@/lib/db", () => ({
  withTenant: vi.fn(),
  prisma: {},
  Prisma: {},
}));
vi.mock("@/lib/events/log", () => ({
  logEvent: logEventMock,
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  logEventMock.mockClear();
});

describe("recordAiUsage", () => {
  it("logs an ai.usage event with tenantId + action + costUsd in payload", async () => {
    const { recordAiUsage } = await import("@/lib/ai/cost-cap");
    await recordAiUsage(TENANT_ID, "kol_email_customize");

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const call = logEventMock.mock.calls[0]?.[0] as {
      type: string;
      tenantId: string;
      payload: { tenantId: string; action: string; costUsd: number };
    };
    expect(call.type).toBe("ai.usage");
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.payload.tenantId).toBe(TENANT_ID);
    expect(call.payload.action).toBe("kol_email_customize");
    // Default per-call estimate is $0.01 (D5 MVP).
    expect(call.payload.costUsd).toBe(0.01);
  });

  it("respects an explicit costUsd override (future BL-040 dedicated table)", async () => {
    const { recordAiUsage } = await import("@/lib/ai/cost-cap");
    await recordAiUsage(TENANT_ID, "weekly_report", 0.42);

    const call = logEventMock.mock.calls[0]?.[0] as {
      payload: { costUsd: number; action: string };
    };
    expect(call.payload.costUsd).toBe(0.42);
    expect(call.payload.action).toBe("weekly_report");
  });
});
