/**
 * BL-067-F004 · requestDetailedExplanationAction tests.
 *
 * Mocks every cross-module dependency (auth, cache, cost-cap, aigc SDK,
 * audit log, prisma) so the action's decision tree can be exercised
 * deterministically without a DB or aigcgateway.
 *
 * 5 cases per spec acceptance + 1 helper case for the parse-failure
 * → internal_error branch (covers spec §5 不变量 #9 "JSON parse failures
 * are not retried").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const CAMPAIGN_ID = "33333333-3333-3333-3333-333333333333";
const KOL_ID = "44444444-4444-4444-4444-444444444444";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: authMock }));

const readDetailedMock = vi.fn();
const writeDetailedMock = vi.fn();
const readShortMock = vi.fn();
vi.mock("@/lib/explainability/cache", () => ({
  readDetailedExplanation: readDetailedMock,
  writeDetailedExplanation: writeDetailedMock,
  readShortExplanation: readShortMock,
}));

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

// withTenant stub returns the callback result with a fake tx.
const kolFindUnique = vi.fn();
const campaignFindUnique = vi.fn();
const withTenantMock = vi.fn(async (_tid: string, fn: (tx: unknown) => unknown) =>
  fn({
    kol: { findUnique: kolFindUnique },
    campaign: { findUnique: campaignFindUnique },
  }),
);
vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));

vi.mock("@/lib/ai/xml-escape", () => ({
  wrapUserInput: (tag: string, value: string) => `<${tag}>${value}</${tag}>`,
}));

vi.mock("@/lib/kol/value-score", () => ({
  computeKolValueScore: () => ({
    score: 88,
    breakdown: { follower: 63, engagement: 16, category: 15 },
  }),
}));

const ORIGINAL_DETAILED_ID = process.env.AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID;

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue({
    user: { tenantId: TENANT_ID, id: USER_ID },
  });
  readDetailedMock.mockReset();
  writeDetailedMock.mockReset();
  writeDetailedMock.mockResolvedValue(undefined);
  readShortMock.mockReset();
  checkLlmCostBudgetMock.mockReset();
  runAigcActionMock.mockReset();
  logAuditMock.mockReset();
  logAuditMock.mockResolvedValue(undefined);
  rateLimitBatchSendMock.mockReset();
  rateLimitBatchSendMock.mockResolvedValue({ ok: true, remaining: 19 });
  kolFindUnique.mockReset();
  kolFindUnique.mockResolvedValue({
    handle: "ninja",
    displayName: "Ninja",
    platform: "youtube",
    followerCount: 1_100_000,
    engagementRate: { toNumber: () => 15.5 },
    categories: ["Gaming", "Esports"],
    engagementAuthenticity: 75,
  });
  campaignFindUnique.mockReset();
  campaignFindUnique.mockResolvedValue({
    name: "Genshin Q2 Launch",
    markets: ["US", "JP"],
    product: {
      name: "Genshin Impact",
      category: "RPG",
      targetAudience: "18-24 male gamers",
    },
  });
  process.env.AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID = "act-detailed-test";
});

afterEach(() => {
  if (ORIGINAL_DETAILED_ID === undefined) {
    delete process.env.AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID;
  } else {
    process.env.AIGCGATEWAY_EXPLAIN_DETAILED_ACTION_ID = ORIGINAL_DETAILED_ID;
  }
});

function fiveLocaleOutput(perLocaleSuffix = "") {
  const seg = {
    matchScore: "match" + perLocaleSuffix,
    categoryFit: "cat" + perLocaleSuffix,
    recentActivity: "recent" + perLocaleSuffix,
    audienceFit: "aud" + perLocaleSuffix,
    brandHistory: "brand" + perLocaleSuffix,
  };
  return { en: seg, zh: seg, ja: seg, ko: seg, es: seg };
}

describe("requestDetailedExplanationAction", () => {
  it("returns cache HIT without calling LLM (audit served_from_cache)", async () => {
    const cached = {
      matchScore: "m",
      categoryFit: "c",
      recentActivity: "r",
      audienceFit: "a",
      brandHistory: "b",
    };
    readDetailedMock.mockResolvedValueOnce(cached);
    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "en",
    });
    expect(res).toEqual({
      ok: true,
      data: { segments: cached, fallbackToC2: false, traceId: null },
    });
    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(checkLlmCostBudgetMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.explain_detailed_served_from_cache",
        targetId: `${CAMPAIGN_ID}:${KOL_ID}`,
      }),
    );
  });

  it("on cache MISS + cap exhausted returns fallbackToC2 without LLM (audit cap_exhausted)", async () => {
    readDetailedMock.mockResolvedValueOnce(null);
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: false });
    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "en",
    });
    expect(res).toEqual({
      ok: true,
      data: { segments: null, fallbackToC2: true, traceId: null },
    });
    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.explain_detailed_cap_exhausted",
      }),
    );
  });

  it("on cache MISS + cap OK: calls LLM, writes 5 locales, returns en segments (audit generated)", async () => {
    readDetailedMock.mockResolvedValueOnce(null);
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: true });
    runAigcActionMock.mockResolvedValueOnce({
      output: fiveLocaleOutput("-en"),
      usage: {
        promptTokens: 1000,
        completionTokens: 2500,
        totalTokens: 3500,
        costUsd: 0.008,
      },
      traceId: "trace-detail-1",
    });

    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "en",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.fallbackToC2).toBe(false);
    expect(res.data.traceId).toBe("trace-detail-1");
    expect(res.data.segments).toMatchObject({
      matchScore: "match-en",
      brandHistory: "brand-en",
    });

    // 5 writes (one per locale) before returning current locale's segments.
    expect(writeDetailedMock).toHaveBeenCalledTimes(5);
    const writeLocales = writeDetailedMock.mock.calls.map(
      (c) => (c as unknown[])[3] as string,
    );
    expect(new Set(writeLocales)).toEqual(new Set(["en", "zh", "ja", "ko", "es"]));

    expect(runAigcActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "act-detailed-test",
        tenantId: TENANT_ID,
        actionLabel: "ai_recommendation_explain_detailed",
      }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.explain_detailed_generated",
        after: expect.objectContaining({
          tokenUsage: 3500,
          costUsd: 0.008,
          segmentCount: 5,
        }),
      }),
    );
  });

  it("on runAigcAction throwing AiDailyCostExceededError: maps to fallbackToC2 (race condition)", async () => {
    readDetailedMock.mockResolvedValueOnce(null);
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: true });
    runAigcActionMock.mockRejectedValueOnce(new FakeAiDailyCostExceededError());

    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "en",
    });
    expect(res).toEqual({
      ok: true,
      data: { segments: null, fallbackToC2: true, traceId: null },
    });
    expect(writeDetailedMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.explain_detailed_cap_exhausted",
        after: expect.objectContaining({ raceCondition: true }),
      }),
    );
  });

  it("locale switch (zh vs en) returns the zh segments from the LLM response", async () => {
    readDetailedMock.mockResolvedValueOnce(null);
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: true });
    runAigcActionMock.mockResolvedValueOnce({
      output: {
        en: {
          matchScore: "en-m",
          categoryFit: "en-c",
          recentActivity: "en-r",
          audienceFit: "en-a",
          brandHistory: "en-b",
        },
        zh: {
          matchScore: "zh-匹配",
          categoryFit: "zh-品类",
          recentActivity: "zh-活跃",
          audienceFit: "zh-受众",
          brandHistory: "zh-品牌",
        },
        ja: {
          matchScore: "ja-m",
          categoryFit: "ja-c",
          recentActivity: "ja-r",
          audienceFit: "ja-a",
          brandHistory: "ja-b",
        },
        ko: {
          matchScore: "ko-m",
          categoryFit: "ko-c",
          recentActivity: "ko-r",
          audienceFit: "ko-a",
          brandHistory: "ko-b",
        },
        es: {
          matchScore: "es-m",
          categoryFit: "es-c",
          recentActivity: "es-r",
          audienceFit: "es-a",
          brandHistory: "es-b",
        },
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
      traceId: "trace-zh",
    });

    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "zh",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.segments?.matchScore).toBe("zh-匹配");
    expect(res.data.segments?.brandHistory).toBe("zh-品牌");
  });

  it("returns internal_error on malformed LLM payload (parse fail, no retry per §5 不变量 #9)", async () => {
    readDetailedMock.mockResolvedValueOnce(null);
    checkLlmCostBudgetMock.mockResolvedValueOnce({ allowed: true });
    runAigcActionMock.mockResolvedValueOnce({
      // missing required segments → parseDetailedPayload returns null
      output: { en: { matchScore: "only-this" } },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
      traceId: "trace-bad",
    });

    const { requestDetailedExplanationAction } = await import(
      "../explainability-actions"
    );
    const res = await requestDetailedExplanationAction({
      campaignId: CAMPAIGN_ID,
      kolId: KOL_ID,
      locale: "en",
    });
    expect(res).toEqual({ ok: false, error: "internal_error" });
    expect(writeDetailedMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_recommendation.explain_detailed_parse_failed",
      }),
    );
  });
});
