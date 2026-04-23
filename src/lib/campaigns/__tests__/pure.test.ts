/**
 * BM2-F003/F004 · Pure-function unit coverage for src/lib/campaigns.
 *
 * The module's DB-touching paths (createCampaignRecord, runCampaignList
 * Search) are covered by integration tests; this spec nails the pure
 * helpers (status enum, URL ↔ filter round-trip, ROI calculation,
 * zod schema branches) so vitest coverage keeps the 80% floor without
 * the heavy Testcontainers bootstrap.
 */
import { describe, expect, it, vi } from "vitest";

// search.ts transitively imports @/lib/db (for withTenant). That module
// fails fast with "DATABASE_URL is not set" outside a real server env.
// Stub it before importing anything that touches the module graph.
vi.mock("@/lib/db", () => ({
  withTenant: vi.fn(),
  prisma: {},
}));

import {
  CAMPAIGN_STATUS_VALUES,
  isCampaignStatus,
} from "../status";
import {
  buildCampaignWhere,
  parseCampaignFilters,
  serializeCampaignFilters,
} from "../filters";
import { computeRoiPercentInline } from "../search";
import {
  createCampaignSchema,
  createCampaignSchemaWithDateOrder,
} from "../schema";

describe("campaigns/status", () => {
  it("declares the 3-value lifecycle", () => {
    expect(CAMPAIGN_STATUS_VALUES).toEqual(["draft", "active", "completed"]);
  });

  it("isCampaignStatus rejects unknown strings and accepts known ones", () => {
    expect(isCampaignStatus("draft")).toBe(true);
    expect(isCampaignStatus("active")).toBe(true);
    expect(isCampaignStatus("completed")).toBe(true);
    expect(isCampaignStatus("paused")).toBe(false);
    expect(isCampaignStatus("")).toBe(false);
  });
});

describe("campaigns/filters", () => {
  it("parseCampaignFilters defaults to status=all and ignores bad values", () => {
    expect(parseCampaignFilters({})).toEqual({ status: "all" });
    expect(parseCampaignFilters({ status: "garbage" })).toEqual({
      status: "all",
    });
  });

  it("parseCampaignFilters picks up status + search + cursor", () => {
    expect(
      parseCampaignFilters({ status: "draft", search: " foo ", cursor: "abc" })
    ).toEqual({ status: "draft", search: "foo", cursor: "abc" });
  });

  it("parseCampaignFilters treats empty strings as undefined", () => {
    expect(parseCampaignFilters({ search: "   ", cursor: "" })).toEqual({
      status: "all",
    });
  });

  it("parseCampaignFilters takes the first value of a repeated param", () => {
    expect(parseCampaignFilters({ search: ["hello", "ignored"] })).toEqual({
      status: "all",
      search: "hello",
    });
  });

  it("serializeCampaignFilters drops defaults but keeps explicit overrides", () => {
    expect(serializeCampaignFilters({ status: "all" }).toString()).toBe("");
    expect(
      serializeCampaignFilters(
        { status: "all", search: "foo" },
        { cursor: "cur1" }
      ).toString()
    ).toBe("search=foo&cursor=cur1");
    expect(
      serializeCampaignFilters(
        { status: "active", search: "foo", cursor: "cur1" },
        { cursor: undefined }
      ).toString()
    ).toBe("status=active&search=foo");
  });

  it("buildCampaignWhere emits a contains clause only when search present", () => {
    expect(buildCampaignWhere({ status: "all" })).toEqual({});
    expect(buildCampaignWhere({ status: "draft" })).toEqual({
      status: "draft",
    });
    expect(buildCampaignWhere({ status: "all", search: "beta" })).toEqual({
      name: { contains: "beta", mode: "insensitive" },
    });
  });
});

describe("campaigns/search · computeRoiPercentInline", () => {
  it("returns null when status is not completed", () => {
    expect(computeRoiPercentInline(100, 150, "active")).toBeNull();
    expect(computeRoiPercentInline(100, 150, "draft")).toBeNull();
  });

  it("returns null when spend is zero or negative (div by zero guard)", () => {
    expect(computeRoiPercentInline(0, 100, "completed")).toBeNull();
    expect(computeRoiPercentInline(-1, 100, "completed")).toBeNull();
  });

  it("returns null when revenue is unset", () => {
    expect(computeRoiPercentInline(100, null, "completed")).toBeNull();
  });

  it("computes positive + negative ROI rounded to 1 decimal", () => {
    expect(computeRoiPercentInline(100, 150, "completed")).toBe(50);
    expect(computeRoiPercentInline(200, 100, "completed")).toBe(-50);
    expect(computeRoiPercentInline(300, 331, "completed")).toBe(10.3);
  });
});

const OWNER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PRODUCT_ID = "cmobasefake000001";

describe("campaigns/schema · createCampaignSchema", () => {
  it("parses a minimal input", () => {
    const out = createCampaignSchema.parse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
    });
    expect(out.markets).toEqual([]);
    expect(out.budgetAmount).toBeUndefined();
  });

  it("rejects names longer than 80 chars", () => {
    const res = createCampaignSchema.safeParse({
      name: "x".repeat(81),
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
    });
    expect(res.success).toBe(false);
  });

  it("treats empty budgetAmount string as undefined", () => {
    const out = createCampaignSchema.parse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
      budgetAmount: "",
    });
    expect(out.budgetAmount).toBeUndefined();
  });

  it("flags bad uuid owner", () => {
    const res = createCampaignSchema.safeParse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: "not-a-uuid",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.message)).toContain("ownerInvalid");
    }
  });

  it("accepts valid dates and enforces ordering via the superrefined variant", () => {
    const good = createCampaignSchemaWithDateOrder.safeParse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
      startDate: "2026-05-10",
      endDate: "2026-05-20",
    });
    expect(good.success).toBe(true);

    const bad = createCampaignSchemaWithDateOrder.safeParse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
      startDate: "2026-05-20",
      endDate: "2026-05-10",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.map((i) => i.message)).toContain(
        "endBeforeStart"
      );
    }
  });

  it("flags invalid date strings", () => {
    const res = createCampaignSchema.safeParse({
      name: "Launch",
      productId: PRODUCT_ID,
      ownerUserId: OWNER,
      startDate: "not-a-date",
    });
    expect(res.success).toBe(false);
  });
});
