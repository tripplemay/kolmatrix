/**
 * BM2-F005 · Pure-function unit coverage.
 *
 * Integration tests in tests/integration/campaign-detail.test.ts drive
 * the DB-touching paths; this spec fills coverage for the pure helpers
 * so the vitest 80% floor stays met after F005's large lib surface.
 */
import { describe, expect, it, vi } from "vitest";

// kol-operations.ts, update.ts, and detail.ts all transitively import
// @/lib/db via withTenant. Stub the module before importing the units
// under test so vitest can load them without DATABASE_URL.
vi.mock("@/lib/db", () => ({
  withTenant: vi.fn(),
  prisma: {},
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/log", () => ({ logEvent: vi.fn() }));

import {
  KOL_CAMPAIGN_STATUS_VALUES,
  isKolCampaignStatus,
  kolCampaignStatusIndex,
  kolCampaignStatusSchema,
} from "../kol-campaign-status";
import { coerceKolCampaignStatus } from "../kol-operations";
import {
  isAllowedStatusTransition,
  updateCampaignSchema,
} from "../update";

describe("kol-campaign-status", () => {
  it("exposes the 6-stage lifecycle in the right order", () => {
    expect(KOL_CAMPAIGN_STATUS_VALUES).toEqual([
      "pending",
      "contacted",
      "quoted",
      "signed",
      "delivered",
      "paid",
    ]);
  });

  it("isKolCampaignStatus gates unknowns", () => {
    expect(isKolCampaignStatus("pending")).toBe(true);
    expect(isKolCampaignStatus("paused")).toBe(false);
    expect(isKolCampaignStatus("")).toBe(false);
  });

  it("kolCampaignStatusIndex returns the stage position", () => {
    expect(kolCampaignStatusIndex("pending")).toBe(0);
    expect(kolCampaignStatusIndex("paid")).toBe(5);
  });

  it("zod enum matches the 6-stage tuple", () => {
    expect(kolCampaignStatusSchema.safeParse("signed").success).toBe(true);
    expect(kolCampaignStatusSchema.safeParse("rejected").success).toBe(false);
  });

  it("coerceKolCampaignStatus falls back to pending for garbage input", () => {
    expect(coerceKolCampaignStatus("signed")).toBe("signed");
    expect(coerceKolCampaignStatus("paused")).toBe("pending");
    expect(coerceKolCampaignStatus("")).toBe("pending");
  });
});

describe("update · isAllowedStatusTransition", () => {
  it("accepts no-op transitions (same state)", () => {
    expect(isAllowedStatusTransition("draft", "draft")).toBe(true);
    expect(isAllowedStatusTransition("completed", "completed")).toBe(true);
  });

  it("allows draft → active and active → completed", () => {
    expect(isAllowedStatusTransition("draft", "active")).toBe(true);
    expect(isAllowedStatusTransition("active", "completed")).toBe(true);
  });

  it("allows completed → active (Reactivate)", () => {
    expect(isAllowedStatusTransition("completed", "active")).toBe(true);
  });

  it("rejects draft → completed and active → draft", () => {
    expect(isAllowedStatusTransition("draft", "completed")).toBe(false);
    expect(isAllowedStatusTransition("active", "draft")).toBe(false);
    expect(isAllowedStatusTransition("completed", "draft")).toBe(false);
  });

  it("rejects unknown source/target states", () => {
    expect(isAllowedStatusTransition("paused", "active")).toBe(false);
    expect(isAllowedStatusTransition("active", "archived")).toBe(false);
  });
});

describe("update · updateCampaignSchema", () => {
  it("allows a minimal empty patch", () => {
    const out = updateCampaignSchema.parse({});
    expect(out).toEqual({});
  });

  it("coerces an empty budgetAmount string to null", () => {
    const out = updateCampaignSchema.parse({ budgetAmount: "" });
    expect(out.budgetAmount).toBeNull();
  });

  it("parses a numeric budgetAmount string", () => {
    const out = updateCampaignSchema.parse({ budgetAmount: "123.45" });
    expect(out.budgetAmount).toBe(123.45);
  });

  it("coerces a blank game field to null", () => {
    const out = updateCampaignSchema.parse({ game: "   " });
    expect(out.game).toBeNull();
  });

  it("accepts ISO date strings and returns Date objects", () => {
    const out = updateCampaignSchema.parse({ startDate: "2026-05-10" });
    expect(out.startDate).toBeInstanceOf(Date);
  });
});
