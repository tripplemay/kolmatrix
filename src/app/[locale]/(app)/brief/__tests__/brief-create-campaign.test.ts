/**
 * BL-069-F005 · createCampaignFromBriefAction tests.
 *
 * Mocks auth + withTenant + createCampaignRecord so the action's
 * decision tree runs deterministically without a DB. Pattern mirrors
 * BL-068-F002 + BL-069-F002 (parseBriefAction) — single file, all
 * cross-module deps mocked at the boundary.
 *
 * 5 cases (spec acceptance ≥3 + 2 regression):
 *   1. success — productId valid → createCampaignRecord called with
 *      mapped fields + auto-generated name + extras.briefMeta
 *   2. success with user-typed name overrides auto-generation
 *   3. unauthorized — auth() returns null → error unauthorized
 *      (skips product lookup + create record)
 *   4. product_not_found — withTenant returns null → error
 *      product_not_found (skips createCampaignRecord)
 *   5. internal error — createCampaignRecord throws db_error →
 *      error internal_error (silent fallback per §5 不变量 #4)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const PRODUCT_ID = "cprod1111111111111111";
const NEW_CAMPAIGN_ID = "33333333-3333-3333-3333-333333333333";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const productFindFirst = vi.fn();
const withTenantMock = vi.fn(
  async (_tid: string, fn: (tx: unknown) => unknown) =>
    fn({ product: { findFirst: productFindFirst } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));

class FakeCampaignCreateError extends Error {
  constructor(
    public readonly code: "product_not_found" | "db_error",
    message: string,
  ) {
    super(message);
    this.name = "CampaignCreateError";
  }
}
const createCampaignRecordMock = vi.fn();
vi.mock("@/lib/campaigns/create", () => ({
  createCampaignRecord: createCampaignRecordMock,
  CampaignCreateError: FakeCampaignCreateError,
}));

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue({
    user: { tenantId: TENANT_ID, id: USER_ID },
  });
  productFindFirst.mockReset();
  productFindFirst.mockResolvedValue({ name: "Genshin Impact" });
  createCampaignRecordMock.mockReset();
  createCampaignRecordMock.mockResolvedValue({ id: NEW_CAMPAIGN_ID });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BL-069-F005 createCampaignFromBriefAction", () => {
  it("1. success — auto-name + createCampaignRecord called with mapped fields + briefMeta", async () => {
    const { createCampaignFromBriefAction } = await import("../brief-actions");
    const result = await createCampaignFromBriefAction({
      productId: PRODUCT_ID,
      markets: ["SEA", "JP"],
      budget: { amount: 10000, currency: "USD" },
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      targetAudience: "SEA mobile gamers 18-25",
      categories: ["mobile-game", "rpg"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.campaignId).toBe(NEW_CAMPAIGN_ID);
    expect(createCampaignRecordMock).toHaveBeenCalledTimes(1);
    const [tenantArg, inputArg, extrasArg] =
      createCampaignRecordMock.mock.calls[0];
    expect(tenantArg).toBe(TENANT_ID);
    // Auto-generated name = "Genshin Impact — SEA" (first market, upper).
    expect(inputArg.name).toBe("Genshin Impact — SEA");
    expect(inputArg.productId).toBe(PRODUCT_ID);
    // Markets normalised to lowercase enum values.
    expect(inputArg.markets).toEqual(["sea", "jp"]);
    expect(inputArg.budgetAmount).toBe(10000);
    expect(inputArg.startDate).toBeInstanceOf(Date);
    expect(inputArg.startDate?.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(inputArg.endDate?.toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(inputArg.ownerUserId).toBe(USER_ID);
    // Extras channel — currency + briefMeta.
    expect(extrasArg.budgetCurrency).toBe("USD");
    expect(extrasArg.briefMeta.targetAudience).toBe(
      "SEA mobile gamers 18-25",
    );
    expect(extrasArg.briefMeta.categories).toEqual(["mobile-game", "rpg"]);
  });

  it("2. user-typed name overrides auto-generation", async () => {
    const { createCampaignFromBriefAction } = await import("../brief-actions");
    const result = await createCampaignFromBriefAction({
      name: "My Q2 Push",
      productId: PRODUCT_ID,
      markets: ["us"],
      budget: null,
      startDate: null,
      endDate: null,
      targetAudience: "",
      categories: [],
    });
    expect(result.ok).toBe(true);
    const [, inputArg] = createCampaignRecordMock.mock.calls[0];
    expect(inputArg.name).toBe("My Q2 Push");
  });

  it("3. unauthorized — auth() returns null → skip product lookup + create", async () => {
    authMock.mockResolvedValue(null);
    const { createCampaignFromBriefAction } = await import("../brief-actions");
    const result = await createCampaignFromBriefAction({
      productId: PRODUCT_ID,
      markets: ["sea"],
      budget: null,
      startDate: null,
      endDate: null,
      targetAudience: "",
      categories: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("ok=true");
    expect(result.error).toBe("unauthorized");
    expect(productFindFirst).not.toHaveBeenCalled();
    expect(createCampaignRecordMock).not.toHaveBeenCalled();
  });

  it("4. product_not_found — withTenant returns null → skip createCampaignRecord", async () => {
    productFindFirst.mockResolvedValue(null);
    const { createCampaignFromBriefAction } = await import("../brief-actions");
    const result = await createCampaignFromBriefAction({
      productId: "cprod_NOT_OWNED_BY_TENANT",
      markets: ["sea"],
      budget: null,
      startDate: null,
      endDate: null,
      targetAudience: "",
      categories: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("ok=true");
    expect(result.error).toBe("product_not_found");
    expect(createCampaignRecordMock).not.toHaveBeenCalled();
  });

  it("5. createCampaignRecord throws db_error → error internal_error", async () => {
    createCampaignRecordMock.mockRejectedValue(
      new FakeCampaignCreateError("db_error", "boom"),
    );
    const { createCampaignFromBriefAction } = await import("../brief-actions");
    const result = await createCampaignFromBriefAction({
      productId: PRODUCT_ID,
      markets: ["sea"],
      budget: null,
      startDate: null,
      endDate: null,
      targetAudience: "",
      categories: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("ok=true");
    expect(result.error).toBe("internal_error");
  });
});
