/**
 * BL-069-F002 · parseBriefAction tests.
 *
 * Mocks every cross-module dependency (auth, cost-cap, aigc SDK, audit
 * log, rate-limit, prisma) so the action's decision tree can be
 * exercised deterministically without a DB or aigcgateway. Pattern
 * mirrors BL-068 F002 `refine-actions.test.ts`.
 *
 * 9 cases (spec acceptance ≥6):
 *   1. success — LLM returns valid parsed fields + 5-locale feedback →
 *      applied + audit ai_brief.parse_applied
 *   2. cap exhausted (pre-check) — checkLlmCostBudget allowed=false →
 *      capExhausted=true + audit ai_brief.parse_cap_exhausted
 *   3. unparsable — LLM returns {unparsable:true, reason_locale} →
 *      unparsable=true + feedback=reason for locale + audit
 *      ai_brief.parse_unparsable
 *   4. productId cross-tenant — LLM returns productId not in tenant's
 *      product list → unparsable=true + errorKind=product_cross_tenant
 *      + audit with rejected_productId
 *   5. rate limit blocked — rateLimitBatchSend ok=false → error
 *      rate_limit_exceeded
 *   6. 5-locale feedback — pass locale=zh, LLM returns 5 locales →
 *      returns zh feedback (vs en)
 *   7. race-condition cap exhausted — runAigcAction throws
 *      AiDailyCostExceededError → silent fallback
 *   8. malformed LLM output (missing markets/categories/target_audience)
 *      → fallback unparsable + audit ai_brief.parse_unparsable with
 *      reason=malformed_structure + errorKind=malformed
 *   9. unauthorized — auth() returns null → error unauthorized
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
// Product.id is cuid (not uuid). Set membership is the only check.
const PRODUCT_IDS = [
  "cprod1111111111111111",
  "cprod2222222222222222",
  "cprod3333333333333333",
];

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const checkLlmCostBudgetMock = vi.fn();
vi.mock("@/lib/ai/cost-cap", () => ({
  checkLlmCostBudget: checkLlmCostBudgetMock,
}));

class FakeAiDailyCostExceededError extends Error {
  constructor() {
    super("cap reached");
    this.name = "AiDailyCostExceededError";
  }
}
const runAigcActionMock = vi.fn();
vi.mock("@/lib/aigc/run-action", () => ({
  runAigcAction: runAigcActionMock,
  AiDailyCostExceededError: FakeAiDailyCostExceededError,
}));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit/log", () => ({ logAudit: logAuditMock }));

const rateLimitBatchSendMock = vi.fn();
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: rateLimitBatchSendMock,
}));

// withTenant stub returns product rows shaped like the brief-actions
// findMany select (id/name/category — soft-deleted rows already
// filtered out at the prisma layer).
const productFindMany = vi.fn();
const withTenantMock = vi.fn(
  async (_tid: string, fn: (tx: unknown) => unknown) =>
    fn({ product: { findMany: productFindMany } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));

vi.mock("@/lib/ai/xml-escape", () => ({
  wrapUserInput: (tag: string, value: string) => `<${tag}>${value}</${tag}>`,
}));

function makeProductRows(ids: string[]) {
  return ids.map((id, idx) => ({
    id,
    name: `Product ${idx + 1}`,
    category: idx % 2 === 0 ? "mobile-game" : "console-game",
  }));
}

function fiveLocaleStrings(prefix: string) {
  return {
    en: `${prefix}-en`,
    zh: `${prefix}-zh`,
    ja: `${prefix}-ja`,
    ko: `${prefix}-ko`,
    es: `${prefix}-es`,
  };
}

function validParsedOutput(productId: string | null) {
  return {
    unparsable: false,
    productId,
    markets: ["SEA", "JP"],
    budget: { amount: 10000, currency: "USD" },
    target_audience: "Southeast Asia mobile gamers 18-25 male",
    categories: ["mobile-game", "rpg"],
    start_date: "2026-04-01",
    end_date: "2026-06-30",
    feedback_summary: fiveLocaleStrings("parsed"),
  };
}

const ORIGINAL_BRIEF_ID = process.env.AIGCGATEWAY_BRIEF_PARSE_ACTION_ID;
const ORIGINAL_FORCE_CAP = process.env.BRIEF_FORCE_CAP_EXHAUSTED;

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue({
    user: { tenantId: TENANT_ID, id: USER_ID },
  });
  checkLlmCostBudgetMock.mockReset();
  checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
  runAigcActionMock.mockReset();
  logAuditMock.mockReset();
  logAuditMock.mockResolvedValue(undefined);
  rateLimitBatchSendMock.mockReset();
  rateLimitBatchSendMock.mockResolvedValue({ ok: true, remaining: 19 });
  productFindMany.mockReset();
  productFindMany.mockResolvedValue(makeProductRows(PRODUCT_IDS));
  process.env.AIGCGATEWAY_BRIEF_PARSE_ACTION_ID = "act-brief-test";
  // BL-069 fix-round 1 (B2) — make sure each test starts without the
  // staging-only force-cap flag set; tests that need it set it
  // explicitly + the afterEach below restores the original.
  delete process.env.BRIEF_FORCE_CAP_EXHAUSTED;
});

afterEach(() => {
  if (ORIGINAL_BRIEF_ID === undefined) {
    delete process.env.AIGCGATEWAY_BRIEF_PARSE_ACTION_ID;
  } else {
    process.env.AIGCGATEWAY_BRIEF_PARSE_ACTION_ID = ORIGINAL_BRIEF_ID;
  }
  if (ORIGINAL_FORCE_CAP === undefined) {
    delete process.env.BRIEF_FORCE_CAP_EXHAUSTED;
  } else {
    process.env.BRIEF_FORCE_CAP_EXHAUSTED = ORIGINAL_FORCE_CAP;
  }
});

describe("BL-069-F002 parseBriefAction", () => {
  it("1. success path — LLM parses brief → applied + audit ai_brief.parse_applied", async () => {
    runAigcActionMock.mockResolvedValue({
      output: validParsedOutput(PRODUCT_IDS[0]),
      usage: {
        totalTokens: 2900,
        promptTokens: 2495,
        completionTokens: 414,
        costUsd: 0.0046,
      },
      traceId: "trc_success",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 推 Genshin Impact 给东南亚游戏受众，预算 $10K USD",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.unparsable).toBe(false);
    expect(result.data.capExhausted).toBe(false);
    expect(result.data.parsed?.productId).toBe(PRODUCT_IDS[0]);
    expect(result.data.parsed?.markets).toEqual(["SEA", "JP"]);
    expect(result.data.parsed?.budget).toEqual({
      amount: 10000,
      currency: "USD",
    });
    expect(result.data.parsed?.startDate).toBe("2026-04-01");
    expect(result.data.parsed?.endDate).toBe("2026-06-30");
    expect(result.data.feedback).toBe("parsed-en");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_applied",
        tenantId: TENANT_ID,
        after: expect.objectContaining({
          raw_brief: expect.any(String),
          parsed_fields: expect.objectContaining({
            productId: PRODUCT_IDS[0],
          }),
          token_usage: 2900,
          cost_usd: 0.0046,
          traceId: "trc_success",
        }),
      }),
    );
  });

  it("2. cap exhausted pre-check — checkLlmCostBudget allowed=false → capExhausted + audit", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: false });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 brief here",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.capExhausted).toBe(true);
    expect(result.data.unparsable).toBe(false);
    expect(result.data.parsed).toBeNull();
    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_cap_exhausted",
        tenantId: TENANT_ID,
      }),
    );
  });

  it("3. unparsable — LLM returns {unparsable:true, reason_locale} → feedback for locale", async () => {
    runAigcActionMock.mockResolvedValue({
      output: {
        unparsable: true,
        reason_locale: fiveLocaleStrings("reason"),
      },
      usage: {
        totalTokens: 2400,
        promptTokens: 2000,
        completionTokens: 400,
        costUsd: 0.004,
      },
      traceId: "trc_unparsable",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "你好",
      locale: "zh",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.unparsable).toBe(true);
    expect(result.data.errorKind).toBe("unparsable");
    expect(result.data.feedback).toBe("reason-zh");
    expect(result.data.parsed).toBeNull();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_unparsable",
        after: expect.objectContaining({ traceId: "trc_unparsable" }),
      }),
    );
  });

  it("4. productId cross-tenant — LLM hallucinates id outside pool → unparsable + audit rejection", async () => {
    runAigcActionMock.mockResolvedValue({
      output: validParsedOutput("cprod_HALLUCINATED_NOT_IN_POOL"),
      usage: {
        totalTokens: 2900,
        promptTokens: 2495,
        completionTokens: 414,
        costUsd: 0.0046,
      },
      traceId: "trc_xtenant",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "推一个不存在的产品",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.unparsable).toBe(true);
    expect(result.data.errorKind).toBe("product_cross_tenant");
    expect(result.data.parsed).toBeNull();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_unparsable",
        after: expect.objectContaining({
          reason: "productId_cross_tenant",
          rejected_productId: "cprod_HALLUCINATED_NOT_IN_POOL",
        }),
      }),
    );
  });

  it("5. rate limit blocked — rateLimitBatchSend ok=false → error rate_limit_exceeded", async () => {
    rateLimitBatchSendMock.mockResolvedValue({ ok: false, retryAfter: 30 });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 brief",
      locale: "en",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("ok=true");
    expect(result.error).toBe("rate_limit_exceeded");
    expect(result.retryAfter).toBe(30);
    expect(checkLlmCostBudgetMock).not.toHaveBeenCalled();
    expect(runAigcActionMock).not.toHaveBeenCalled();
  });

  it("6. locale=zh — LLM 5-locale output → zh feedback returned (not en)", async () => {
    runAigcActionMock.mockResolvedValue({
      output: validParsedOutput(PRODUCT_IDS[1]),
      usage: {
        totalTokens: 2900,
        promptTokens: 2495,
        completionTokens: 414,
        costUsd: 0.0046,
      },
      traceId: "trc_zh",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "第二季度推 Clash Royale 给日本市场",
      locale: "zh",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.feedback).toBe("parsed-zh");
    expect(result.data.feedback).not.toBe("parsed-en");
  });

  it("7. race-condition cap — runAigcAction throws AiDailyCostExceededError → silent fallback", async () => {
    runAigcActionMock.mockRejectedValue(new FakeAiDailyCostExceededError());
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 brief",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.capExhausted).toBe(true);
    expect(result.data.parsed).toBeNull();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_cap_exhausted",
        after: expect.objectContaining({ race_condition: true }),
      }),
    );
  });

  it("8. malformed output (missing markets) → errorKind=malformed + audit reason=malformed_structure", async () => {
    runAigcActionMock.mockResolvedValue({
      output: {
        unparsable: false,
        productId: PRODUCT_IDS[0],
        // markets intentionally missing
        budget: { amount: 5000, currency: "USD" },
        target_audience: "young adults",
        categories: ["mobile-game"],
        start_date: null,
        end_date: null,
        feedback_summary: fiveLocaleStrings("malformed"),
      },
      usage: {
        totalTokens: 2900,
        promptTokens: 2495,
        completionTokens: 414,
        costUsd: 0.0046,
      },
      traceId: "trc_malformed",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "推产品 to mobile gamers",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.unparsable).toBe(true);
    expect(result.data.errorKind).toBe("malformed");
    expect(result.data.parsed).toBeNull();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_unparsable",
        after: expect.objectContaining({ reason: "malformed_structure" }),
      }),
    );
  });

  it("9. unauthorized — auth() returns null → error unauthorized", async () => {
    authMock.mockResolvedValue(null);
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 brief",
      locale: "en",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("ok=true");
    expect(result.error).toBe("unauthorized");
    expect(rateLimitBatchSendMock).not.toHaveBeenCalled();
    expect(runAigcActionMock).not.toHaveBeenCalled();
  });

  // BL-069 fix-round 1 (Reviewer B2) — staging-only env flag that
  // short-circuits the budget check so dogfood spot-check can verify
  // cap UX without burning real cap. See docs/dev/bl069-cap-exhausted-
  // simulation-runbook.md.
  it("10. BRIEF_FORCE_CAP_EXHAUSTED=true → cap fallback without LLM call + audit forced=true", async () => {
    process.env.BRIEF_FORCE_CAP_EXHAUSTED = "true";
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "Q2 cap sim test",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.capExhausted).toBe(true);
    expect(result.data.parsed).toBeNull();
    // Real cap-budget check + LLM call MUST be skipped.
    expect(checkLlmCostBudgetMock).not.toHaveBeenCalled();
    expect(runAigcActionMock).not.toHaveBeenCalled();
    // Audit row still written but with `forced: true` so dashboards
    // can split real cap events from staging simulation.
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_brief.parse_cap_exhausted",
        after: expect.objectContaining({ forced: true }),
      }),
    );
  });

  it("11. BRIEF_FORCE_CAP_EXHAUSTED unset / non-'true' → normal path runs (regression guard)", async () => {
    // Defensive: the flag must be a STRICT-equal 'true' string; any
    // other value falls through to the real cap check (we don't want
    // a typo'd "1" or "yes" to accidentally trigger fallback on prod).
    process.env.BRIEF_FORCE_CAP_EXHAUSTED = "yes";
    runAigcActionMock.mockResolvedValue({
      output: {
        unparsable: false,
        productId: PRODUCT_IDS[0],
        markets: ["SEA"],
        budget: { amount: 5000, currency: "USD" },
        target_audience: "regression guard audience",
        categories: ["mobile-game"],
        start_date: "2026-07-01",
        end_date: "2026-09-30",
        feedback_summary: fiveLocaleStrings("regression"),
      },
      usage: {
        totalTokens: 2900,
        promptTokens: 2495,
        completionTokens: 414,
        costUsd: 0.0046,
      },
      traceId: "trc_regression",
    });
    const { parseBriefAction } = await import("../brief-actions");
    const result = await parseBriefAction({
      rawBrief: "regression query — flag set to non-'true'",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ok=false");
    expect(result.data.capExhausted).toBe(false);
    // Real cap check + LLM call MUST have run.
    expect(checkLlmCostBudgetMock).toHaveBeenCalledTimes(1);
    expect(runAigcActionMock).toHaveBeenCalledTimes(1);
    expect(result.data.parsed?.productId).toBe(PRODUCT_IDS[0]);
  });
});
