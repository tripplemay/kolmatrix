/**
 * BL-044 F001 · Unit test for the semantic search server logic.
 *
 * Mocks every dependency (rate-limit / cost-cap / embed / DB) so the
 * test focuses on `runSemanticKolSearch` orchestration: validation,
 * fail-fast order, cache-hit branching, error wrapping. The real
 * cosine SQL is exercised by the integration test (F004 step 12).
 *
 * Pre-impl audit lock (2026-05-06 16:30) — see
 * docs/specs/BL-044-pre-impl-audit.md §9.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMS } from "@/lib/embedding/types";

const rateLimitAiMock = vi.fn();
const embedOneMock = vi.fn();
const assertDailyCostBudgetMock = vi.fn();
const recordAiUsageMock = vi.fn();
const queryRawMock = vi.fn();
const withTenantMock = vi.fn();

vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: (...args: unknown[]) => rateLimitAiMock(...args),
}));

vi.mock("@/lib/embedding/client", () => ({
  embedOne: (...args: unknown[]) => embedOneMock(...args),
}));

vi.mock("@/lib/ai/cost-cap", () => ({
  assertDailyCostBudget: (...args: unknown[]) => assertDailyCostBudgetMock(...args),
  recordAiUsage: (...args: unknown[]) => recordAiUsageMock(...args),
}));

vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) => withTenantMock(...args),
  prisma: {},
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function makeFakeVec(seed = 1): number[] {
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) =>
    Math.cos(((i + seed) * Math.PI) / 256) * 0.001,
  );
}

beforeEach(async () => {
  rateLimitAiMock.mockReset().mockResolvedValue({ ok: true, remaining: 9 });
  embedOneMock.mockReset().mockResolvedValue({
    vector: makeFakeVec(1),
    usage: {
      promptTokens: 12,
      totalTokens: 12,
      estimatedCostUsd: 0.0000005,
    },
  });
  assertDailyCostBudgetMock.mockReset().mockResolvedValue(undefined);
  recordAiUsageMock.mockReset().mockResolvedValue(undefined);
  queryRawMock.mockReset().mockResolvedValue([{ id: "kol-1" }, { id: "kol-2" }]);
  withTenantMock.mockReset().mockImplementation(
    async (
      _tid: string,
      fn: (tx: { $queryRaw: typeof queryRawMock }) => Promise<unknown>,
    ) => fn({ $queryRaw: queryRawMock }),
  );

  const { __clearChipEmbeddingCache } = await import("@/lib/discovery/semantic-search");
  __clearChipEmbeddingCache();
});

describe("runSemanticKolSearch — query validation", () => {
  it("rejects empty queryText with INVALID_QUERY (does NOT consume rate-limit / embed / cost-cap)", async () => {
    const { runSemanticKolSearch, SemanticSearchError } = await import(
      "@/lib/discovery/semantic-search"
    );
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "" }),
    ).rejects.toBeInstanceOf(SemanticSearchError);
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "   \t  " }),
    ).rejects.toMatchObject({ code: "INVALID_QUERY" });

    expect(rateLimitAiMock).not.toHaveBeenCalled();
    expect(embedOneMock).not.toHaveBeenCalled();
    expect(assertDailyCostBudgetMock).not.toHaveBeenCalled();
  });

  it("rejects queryText > 200 chars with INVALID_QUERY", async () => {
    const longQuery = "x".repeat(201);
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: longQuery }),
    ).rejects.toMatchObject({ code: "INVALID_QUERY" });
  });

  it("rejects out-of-bounds topK (0 / negative / >200 / non-integer)", async () => {
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    for (const bad of [0, -1, 201, 1.5, Number.NaN]) {
      await expect(
        runSemanticKolSearch({
          tenantId: TENANT_ID,
          queryText: "FPS creators",
          topK: bad,
        }),
      ).rejects.toMatchObject({ code: "INVALID_QUERY" });
    }
  });
});

describe("runSemanticKolSearch — rate-limit fail-fast (#3:A order)", () => {
  it("throws RATE_LIMIT_EXCEEDED when rateLimitAi rejects, BEFORE touching embed / cost-cap", async () => {
    rateLimitAiMock.mockResolvedValue({ ok: false, retryAfter: 30 });
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "FPS creators" }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", retryAfter: 30 });

    expect(rateLimitAiMock).toHaveBeenCalledTimes(1);
    expect(embedOneMock).not.toHaveBeenCalled();
    expect(assertDailyCostBudgetMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});

describe("runSemanticKolSearch — happy path (free text)", () => {
  it("returns kolIds + cost + cacheHit:false; calls assertDailyCostBudget + recordAiUsage (#8:C)", async () => {
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    const result = await runSemanticKolSearch({
      tenantId: TENANT_ID,
      queryText: "FPS creators",
    });

    expect(result.kolIds).toEqual(["kol-1", "kol-2"]);
    expect(result.cost).toBe(0.0000005);
    expect(result.cacheHit).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    expect(assertDailyCostBudgetMock).toHaveBeenCalledWith(TENANT_ID);
    expect(embedOneMock).toHaveBeenCalledWith("FPS creators");
    expect(recordAiUsageMock).toHaveBeenCalledWith(
      TENANT_ID,
      "discovery.semantic_search",
      0.0000005,
      expect.objectContaining({
        source: "semantic_search",
        queryText50: "FPS creators",
        cacheHit: false,
        kolIdsCount: 2,
      }),
    );
  });

  it("uses default topK = 50 (spec D2 / #2:B)", async () => {
    const { DEFAULT_TOP_K } = await import("@/lib/discovery/semantic-search");
    expect(DEFAULT_TOP_K).toBe(50);
  });

  it("trims whitespace before validation + cache lookup", async () => {
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    await runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "   FPS creators   " });
    // The trimmed query is what reaches the embed gateway.
    expect(embedOneMock).toHaveBeenCalledWith("FPS creators");
  });
});

describe("runSemanticKolSearch — cache hit (#8:C)", () => {
  it("returns cacheHit:true + cost:0 + skips embed / cost-cap / recordAiUsage", async () => {
    const mod = await import("@/lib/discovery/semantic-search");
    mod.__seedChipEmbeddingCache("FPS creators", makeFakeVec(7));

    const result = await mod.runSemanticKolSearch({
      tenantId: TENANT_ID,
      queryText: "FPS creators",
    });

    expect(result.cacheHit).toBe(true);
    expect(result.cost).toBe(0);
    expect(result.kolIds).toEqual(["kol-1", "kol-2"]);

    expect(embedOneMock).not.toHaveBeenCalled();
    expect(assertDailyCostBudgetMock).not.toHaveBeenCalled();
    expect(recordAiUsageMock).not.toHaveBeenCalled();
    // Rate-limit is still enforced on cache hits — they're cheap on the
    // gateway side but the per-tenant burst cap still applies.
    expect(rateLimitAiMock).toHaveBeenCalledTimes(1);
  });
});

describe("runSemanticKolSearch — embed failure", () => {
  it("wraps aigcgateway 5xx as SemanticSearchError code=EMBED_FAILED", async () => {
    embedOneMock.mockRejectedValue(new Error("aigcgateway 502 bad gateway"));
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "FPS creators" }),
    ).rejects.toMatchObject({ code: "EMBED_FAILED" });

    // Cosine SQL never runs when embed fails.
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(recordAiUsageMock).not.toHaveBeenCalled();
  });
});

describe("runSemanticKolSearch — DB failure", () => {
  it("wraps cosine top-K SQL errors as SemanticSearchError code=DB_ERROR", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("relation kol does not exist"));
    const { runSemanticKolSearch } = await import("@/lib/discovery/semantic-search");
    await expect(
      runSemanticKolSearch({ tenantId: TENANT_ID, queryText: "FPS creators" }),
    ).rejects.toMatchObject({ code: "DB_ERROR" });
    // Embed already ran + spent; we still report failure but do NOT record
    // AI usage when the search itself fell over (no kolIds delivered).
    expect(recordAiUsageMock).not.toHaveBeenCalled();
  });
});
