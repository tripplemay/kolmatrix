/**
 * BL-068-F002 · applyRefineAction tests.
 *
 * Mocks every cross-module dependency (auth, cost-cap, aigc SDK, audit
 * log, rate-limit, prisma) so the action's decision tree can be exercised
 * deterministically without a DB or aigcgateway. Pattern mirrors
 * BL-067 F004 `explainability-actions.test.ts`.
 *
 * 9 cases (spec acceptance ≥6):
 *   1. success — LLM returns valid permutation + feedback_summary → reorder + audit refine_applied
 *   2. cap exhausted (pre-check) — checkLlmCostBudget allowed=false → capExhausted=true + audit refine_cap_exhausted
 *   3. unparsable — LLM returns {unparsable:true, reason_locale} → unparsable=true + feedback=reason for locale + audit refine_unparsable
 *   4. permutation invalid — LLM returns extra/missing IDs → unparsable=true + audit refine_permutation_invalid
 *   5. rate limit blocked — rateLimitBatchSend ok=false → error rate_limit_exceeded
 *   6. 5 locale feedback — pass locale=zh, LLM returns 5 locales → returns zh feedback (vs en)
 *   7. race-condition cap exhausted — runAigcAction throws AiDailyCostExceededError → fallback
 *   8. malformed LLM output (no ordered_kol_ids) → fallback unparsable + audit refine_parse_failed
 *   9. unauthorized — auth() returns null → error unauthorized
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const CAMPAIGN_ID = "33333333-3333-3333-3333-333333333333";
const POOL_IDS = [
  "44444444-4444-4444-4444-000000000001",
  "44444444-4444-4444-4444-000000000002",
  "44444444-4444-4444-4444-000000000003",
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

// withTenant stub returns POOL_IDS-shaped findMany results.
const kolFindMany = vi.fn();
const withTenantMock = vi.fn(
  async (_tid: string, fn: (tx: unknown) => unknown) =>
    fn({ kol: { findMany: kolFindMany } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));

vi.mock("@/lib/ai/xml-escape", () => ({
  wrapUserInput: (tag: string, value: string) => `<${tag}>${value}</${tag}>`,
}));

function makePoolRows(ids: string[]) {
  return ids.map((id, idx) => ({
    id,
    displayName: `KOL ${idx + 1}`,
    handle: `@kol${idx + 1}`,
    platform: idx % 2 === 0 ? "youtube" : "tiktok",
    followerCount: 100000 * (idx + 1),
    engagementRate: { toNumber: () => 10 + idx },
    categories: ["gaming"],
  }));
}

const ORIGINAL_REFINE_ID = process.env.AIGCGATEWAY_REFINE_ACTION_ID;

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
  kolFindMany.mockReset();
  kolFindMany.mockResolvedValue(makePoolRows(POOL_IDS));
  process.env.AIGCGATEWAY_REFINE_ACTION_ID = "act-refine-test";
});

afterEach(() => {
  if (ORIGINAL_REFINE_ID === undefined) {
    delete process.env.AIGCGATEWAY_REFINE_ACTION_ID;
  } else {
    process.env.AIGCGATEWAY_REFINE_ACTION_ID = ORIGINAL_REFINE_ID;
  }
});

function fiveLocaleFeedback(prefix: string) {
  return {
    en: `${prefix}-en`,
    zh: `${prefix}-zh`,
    ja: `${prefix}-ja`,
    ko: `${prefix}-ko`,
    es: `${prefix}-es`,
  };
}

describe("applyRefineAction", () => {
  it("success: returns reordered IDs + locale feedback + audit refine_applied", async () => {
    const reordered = [POOL_IDS[2]!, POOL_IDS[0]!, POOL_IDS[1]!];
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        unparsable: false,
        ordered_kol_ids: reordered,
        parsed_filters: { tier: "micro", audience_gender: null },
        feedback_summary: fiveLocaleFeedback("reranked"),
      },
      usage: {
        promptTokens: 1500,
        completionTokens: 600,
        totalTokens: 2100,
        costUsd: 0.0075,
      },
      traceId: "trace-success",
    });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "减少 micro tier，多加女性受众",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.orderedKolIds).toEqual(reordered);
    expect(res.data.feedback).toBe("reranked-en");
    expect(res.data.unparsable).toBe(false);
    expect(res.data.capExhausted).toBe(false);

    expect(runAigcActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "act-refine-test",
        tenantId: TENANT_ID,
        actionLabel: "ai_recommendation_refine",
      }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_applied",
        targetType: "campaign",
        targetId: CAMPAIGN_ID,
        after: expect.objectContaining({
          raw_query: "减少 micro tier，多加女性受众",
          parsed_filters: { tier: "micro", audience_gender: null },
          result_kol_ids: reordered,
          locale: "en",
          token_usage: 2100,
          cost_usd: 0.0075,
        }),
      }),
    );
  });

  it("cap exhausted (pre-check): returns capExhausted=true without LLM call + audit refine_cap_exhausted", async () => {
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: false });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "more macro",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      orderedKolIds: POOL_IDS,
      feedback: "",
      unparsable: false,
      capExhausted: true,
    });
    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_cap_exhausted",
        after: expect.objectContaining({
          raw_query: "more macro",
          locale: "en",
          pool_size: POOL_IDS.length,
        }),
      }),
    );
  });

  it("unparsable: LLM returns {unparsable:true} → unparsable=true + reason for locale + audit refine_unparsable", async () => {
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        unparsable: true,
        reason_locale: fiveLocaleFeedback("please be more specific"),
      },
      usage: { promptTokens: 1500, completionTokens: 80, totalTokens: 1580, costUsd: 0.002 },
      traceId: "trace-unparsable",
    });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "你好",
      currentPoolIds: POOL_IDS,
      locale: "zh",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.orderedKolIds).toEqual(POOL_IDS);
    expect(res.data.feedback).toBe("please be more specific-zh");
    expect(res.data.unparsable).toBe(true);
    expect(res.data.capExhausted).toBe(false);
    expect(res.data.errorKind).toBe("unparsable");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_unparsable",
        after: expect.objectContaining({
          raw_query: "你好",
          locale: "zh",
          traceId: "trace-unparsable",
        }),
      }),
    );
  });

  it("permutation invalid: LLM hallucinates extra ID → fallback unparsable + audit refine_permutation_invalid", async () => {
    const hallucinated = [
      POOL_IDS[0]!,
      POOL_IDS[1]!,
      "55555555-5555-5555-5555-555555555555", // not in input pool
      // missing POOL_IDS[2]
    ];
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        unparsable: false,
        ordered_kol_ids: hallucinated,
        feedback_summary: fiveLocaleFeedback("ignored"),
      },
      usage: { promptTokens: 1500, completionTokens: 200, totalTokens: 1700, costUsd: 0.003 },
      traceId: "trace-permu-fail",
    });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "boost gaming",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.orderedKolIds).toEqual(POOL_IDS);
    expect(res.data.feedback).toBe("");
    expect(res.data.unparsable).toBe(true);
    expect(res.data.capExhausted).toBe(false);
    expect(res.data.errorKind).toBe("permutation_invalid");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_permutation_invalid",
        after: expect.objectContaining({
          raw_query: "boost gaming",
          expected_count: POOL_IDS.length,
          returned_count: hallucinated.length,
          missing_ids: [POOL_IDS[2]],
          extra_ids: ["55555555-5555-5555-5555-555555555555"],
        }),
      }),
    );
  });

  it("rate limit blocked: returns rate_limit_exceeded without DB / LLM call", async () => {
    rateLimitBatchSendMock.mockResolvedValueOnce({ ok: false, retryAfter: 17 });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "anything",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res).toEqual({
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: 17,
    });
    expect(checkLlmCostBudgetMock).not.toHaveBeenCalled();
    expect(kolFindMany).not.toHaveBeenCalled();
    expect(runAigcActionMock).not.toHaveBeenCalled();
  });

  it("locale switch (zh vs en) returns the zh feedback string from feedback_summary", async () => {
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        unparsable: false,
        ordered_kol_ids: POOL_IDS,
        feedback_summary: {
          en: "Reranked: micro tier prioritized",
          zh: "已重排：micro tier 优先",
          ja: "再ソート完了",
          ko: "재정렬 완료",
          es: "Reordenado",
        },
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
      traceId: "trace-locale",
    });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "fewer macro",
      currentPoolIds: POOL_IDS,
      locale: "zh",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.feedback).toBe("已重排：micro tier 优先");
  });

  it("race-condition AiDailyCostExceededError thrown by runAigcAction → fallback capExhausted=true", async () => {
    runAigcActionMock.mockRejectedValueOnce(new FakeAiDailyCostExceededError());

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "race",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      orderedKolIds: POOL_IDS,
      feedback: "",
      unparsable: false,
      capExhausted: true,
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_cap_exhausted",
        after: expect.objectContaining({ race_condition: true }),
      }),
    );
  });

  it("malformed LLM output (no ordered_kol_ids array) → fallback unparsable + audit refine_parse_failed", async () => {
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        unparsable: false,
        // missing ordered_kol_ids
        feedback_summary: { en: "broken" },
      },
      usage: { promptTokens: 1500, completionTokens: 50, totalTokens: 1550, costUsd: 0.001 },
      traceId: "trace-malformed",
    });

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "anything",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.orderedKolIds).toEqual(POOL_IDS);
    expect(res.data.unparsable).toBe(true);
    expect(res.data.feedback).toBe("");
    expect(res.data.errorKind).toBe("malformed");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.refine_parse_failed",
      }),
    );
  });

  it("unauthorized: no session → error unauthorized (no rate limit / cost check called)", async () => {
    authMock.mockResolvedValueOnce(null);

    const { applyRefineAction } = await import("../refine-actions");
    const res = await applyRefineAction({
      campaignId: CAMPAIGN_ID,
      rawQuery: "anything",
      currentPoolIds: POOL_IDS,
      locale: "en",
    });

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(rateLimitBatchSendMock).not.toHaveBeenCalled();
    expect(checkLlmCostBudgetMock).not.toHaveBeenCalled();
  });
});
