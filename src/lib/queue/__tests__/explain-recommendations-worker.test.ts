/**
 * BL-067-F005 · explain-recommendations-worker unit tests.
 *
 * Exercises `processExplainPrewarm` against mocked cost-cap / cache /
 * SDK / prisma so we cover the 5 documented branches (success / cap /
 * LLM error / idempotency / empty kolIds) without external services.
 *
 * Idempotency is tested at the InMemoryJobQueue layer via re-enqueue
 * (the worker handler itself is stateless and doesn't see the dedupe).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CAMPAIGN_ID = "22222222-2222-2222-2222-222222222222";
const KOL_A = "33333333-3333-3333-3333-333333333333";
const KOL_B = "44444444-4444-4444-4444-444444444444";

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

vi.mock("@/lib/ai/xml-escape", () => ({
  wrapUserInput: (tag: string, value: string) => `<${tag}>${value}</${tag}>`,
}));

const readShortMock = vi.fn();
const writeShortMock = vi.fn();
vi.mock("@/lib/explainability/cache", () => ({
  readShortExplanation: readShortMock,
  writeShortExplanation: writeShortMock,
}));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit/log", () => ({ logAudit: logAuditMock }));

vi.mock("@/lib/kol/value-score", () => ({
  computeKolValueScore: () => ({
    total: 88,
    rawBreakdown: { follower: 63, engagement: 16, category: 15 },
    authenticityModifier: 1.0,
  }),
}));

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

const ORIGINAL_SHORT_ID = process.env.AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID;

const CONTEXT = { jobId: "test-job-1", tenantId: TENANT_ID };

beforeEach(() => {
  checkLlmCostBudgetMock.mockReset();
  runAigcActionMock.mockReset();
  readShortMock.mockReset();
  readShortMock.mockResolvedValue(null);
  writeShortMock.mockReset();
  writeShortMock.mockResolvedValue(undefined);
  logAuditMock.mockReset();
  logAuditMock.mockResolvedValue(undefined);
  kolFindUnique.mockReset();
  campaignFindUnique.mockReset();
  campaignFindUnique.mockResolvedValue({
    name: "Test Campaign",
    markets: ["US"],
    product: {
      name: "Test Product",
      category: "Game",
      targetAudience: "Gamers",
    },
  });
  kolFindUnique.mockResolvedValue({
    handle: "ninja",
    displayName: "Ninja",
    platform: "youtube",
    followerCount: 1_100_000,
    engagementRate: { toNumber: () => 15.5 },
    categories: ["Gaming"],
    engagementAuthenticity: 75,
  });
  process.env.AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID = "act-short-test";
});

afterEach(() => {
  if (ORIGINAL_SHORT_ID === undefined) {
    delete process.env.AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID;
  } else {
    process.env.AIGCGATEWAY_EXPLAIN_SHORT_ACTION_ID = ORIGINAL_SHORT_ID;
  }
});

function fiveLocaleShort(prefix: string) {
  return {
    en: `${prefix}-en`,
    zh: `${prefix}-zh`,
    ja: `${prefix}-ja`,
    ko: `${prefix}-ko`,
    es: `${prefix}-es`,
  };
}

describe("processExplainPrewarm", () => {
  it("success path — runs LLM, writes 5 locales per kolId, audits each", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
    runAigcActionMock.mockResolvedValue({
      output: fiveLocaleShort("hello"),
      usage: {
        promptTokens: 1000,
        completionTokens: 400,
        totalTokens: 1400,
        costUsd: 0.0015,
      },
      traceId: "trace-1",
    });

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A, KOL_B] },
      CONTEXT,
    );

    // 2 kolIds × 1 LLM call each
    expect(runAigcActionMock).toHaveBeenCalledTimes(2);
    // 2 kolIds × 5 locale writes = 10
    expect(writeShortMock).toHaveBeenCalledTimes(10);
    // 2 audits (one per kolId)
    expect(logAuditMock).toHaveBeenCalledTimes(2);
    expect(logAuditMock.mock.calls[0]![0]).toMatchObject({
      action: "ai_recommendation.explain_short_generated",
      after: expect.objectContaining({
        locales: 5,
        tokenUsage: 1400,
        costUsd: 0.0015,
      }),
    });
  });

  it("cap exhausted on first iteration — breaks loop silently, no LLM / writes / audits", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: false });

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A, KOL_B] },
      CONTEXT,
    );

    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(writeShortMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("LLM error on KOL A — skips A and proceeds with KOL B (single-KOL fault tolerance)", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
    runAigcActionMock
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce({
        output: fiveLocaleShort("b"),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
        traceId: "trace-b",
      });

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A, KOL_B] },
      CONTEXT,
    );

    expect(runAigcActionMock).toHaveBeenCalledTimes(2);
    // Only KOL B's 5 locales got written (5 calls, not 10).
    expect(writeShortMock).toHaveBeenCalledTimes(5);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
  });

  it("AiDailyCostExceededError mid-flight on KOL A — breaks loop, KOL B never processed", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
    runAigcActionMock.mockRejectedValueOnce(new FakeAiDailyCostExceededError());

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A, KOL_B] },
      CONTEXT,
    );

    // Only A's LLM attempt was made; loop broke before B.
    expect(runAigcActionMock).toHaveBeenCalledTimes(1);
    expect(writeShortMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("empty kolIds — early return, no fetch / LLM / writes", async () => {
    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );
    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [] },
      CONTEXT,
    );
    expect(campaignFindUnique).not.toHaveBeenCalled();
    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(writeShortMock).not.toHaveBeenCalled();
  });

  it("all 5 locales already cached for a kolId — skip without LLM call", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
    // Every readShort returns a fresh cached string → skip path triggers.
    readShortMock.mockResolvedValue("already-cached");

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A] },
      CONTEXT,
    );

    expect(runAigcActionMock).not.toHaveBeenCalled();
    expect(writeShortMock).not.toHaveBeenCalled();
  });

  it("malformed LLM output (missing locale) — skips kolId without write", async () => {
    checkLlmCostBudgetMock.mockResolvedValue({ allowed: true });
    runAigcActionMock.mockResolvedValueOnce({
      // missing 'es' locale → parseShortPayload returns null
      output: { en: "e", zh: "z", ja: "j", ko: "k" },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
      traceId: "trace-bad",
    });

    const { processExplainPrewarm } = await import(
      "@/lib/queue/explain-recommendations-worker"
    );

    await processExplainPrewarm(
      { tenantId: TENANT_ID, campaignId: CAMPAIGN_ID, kolIds: [KOL_A] },
      CONTEXT,
    );

    expect(runAigcActionMock).toHaveBeenCalledTimes(1);
    expect(writeShortMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });
});

describe("InMemoryJobQueue idempotency (BL-067-F005)", () => {
  it("re-enqueue with same idempotencyKey returns the original jobId without re-running handler", async () => {
    // Use the actual InMemoryJobQueue (no mock) to exercise the dedupe.
    vi.doUnmock("@/lib/jobs/queue");
    const { jobQueue } = await import("@/lib/jobs/queue");
    const handler = vi.fn(async () => undefined);
    jobQueue.register("idempotency-test", handler);

    const first = await jobQueue.add(
      "idempotency-test",
      { foo: "bar" },
      { idempotencyKey: "shared-key" },
    );
    const second = await jobQueue.add(
      "idempotency-test",
      { foo: "bar" },
      { idempotencyKey: "shared-key" },
    );

    expect(second.jobId).toBe(first.jobId);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
