import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCampaignSuggestions } from "../get-campaign-suggestions";
import type { SmartMatchKolHit } from "@/lib/discovery/smart-match";

// BL-084-F004: getCampaignSuggestions orchestration. All IO is mocked.

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

// Fake tx exposes campaign / product / kolCampaign finders driven by the
// per-test fixtures below.
const campaignFindFirst = vi.fn();
const productFindFirst = vi.fn();
const kolCampaignFindMany = vi.fn();
const fakeTx = {
  campaign: { findFirst: (...a: unknown[]) => campaignFindFirst(...a) },
  product: { findFirst: (...a: unknown[]) => productFindFirst(...a) },
  kolCampaign: { findMany: (...a: unknown[]) => kolCampaignFindMany(...a) },
};
vi.mock("@/lib/db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));

const rateLimitAiMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 9 });
vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: () => rateLimitAiMock(),
}));

const runSmartMatchMock = vi.fn();
vi.mock("@/lib/discovery/smart-match", async () => {
  const actual = await vi.importActual<typeof import("@/lib/discovery/smart-match")>(
    "@/lib/discovery/smart-match",
  );
  return {
    ...actual,
    runSmartMatch: (...a: unknown[]) => runSmartMatchMock(...a),
  };
});

const rerankMock = vi.fn();
vi.mock("@/lib/match/llm-rerank", () => ({
  rerankWithReason: (...a: unknown[]) => rerankMock(...a),
}));

const redisGet = vi.fn();
const redisSet = vi.fn().mockResolvedValue("OK");
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ get: redisGet, set: redisSet }),
}));

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

function hit(i: number): SmartMatchKolHit {
  return {
    id: `aaaaaaaa-0000-0000-0000-00000000000${i}`,
    displayName: `KOL ${i}`,
    handle: `kol${i}`,
    platform: "youtube",
    avatarUrl: null,
    followerCount: 1000 + i,
    countryCode: "US",
    categories: ["gaming"],
    distance: 0.1,
    similarity: 0.9,
    matchScore: 90 - i,
    valueScore: 50,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { tenantId: "t1", id: "u1" } });
  rateLimitAiMock.mockResolvedValue({ ok: true, remaining: 9 });
  campaignFindFirst.mockResolvedValue({
    name: "Camp",
    markets: ["US"],
    budgetAmount: { toNumber: () => 5000 },
    productId: "prod_1",
  });
  productFindFirst.mockResolvedValue({
    targetAudience: "gamers",
    embeddingTextHash: "hash123",
  });
  kolCampaignFindMany.mockResolvedValue([]);
  redisGet.mockResolvedValue(null);
});

describe("getCampaignSuggestions (BL-084-F004)", () => {
  it("case 1: cache miss → full path (smart-match + rerank), caches result", async () => {
    const pool = [hit(1), hit(2), hit(3)];
    runSmartMatchMock.mockResolvedValue({
      results: pool,
      product: {},
      durationMs: 10,
    });
    rerankMock.mockResolvedValue({
      rank: [pool[2], pool[0], pool[1]],
      matchReasons: new Map([
        [pool[0]!.id, "reason a"],
        [pool[2]!.id, "reason c"],
      ]),
      fallback: false,
    });

    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.fromCache).toBe(false);
    expect(res.data.suggestions).toHaveLength(3);
    expect(res.data.suggestions[0]!.id).toBe(pool[2]!.id);
    expect(res.data.suggestions[0]!.matchReason).toBe("reason c");
    expect(res.data.suggestions[2]!.matchReason).toBeNull(); // pool[1] had no reason
    expect(runSmartMatchMock).toHaveBeenCalledOnce();
    expect(rerankMock).toHaveBeenCalledOnce();
    // Cached with 24h TTL under the hash-suffixed key.
    expect(redisSet).toHaveBeenCalledWith(
      "campaign-ai-suggestions-t1-" + CAMPAIGN_ID + "-hash123",
      expect.any(String),
      "EX",
      86400,
    );
  });

  it("case 2: cache hit → returns cached, no smart-match / rerank / LLM", async () => {
    redisGet.mockResolvedValue(
      JSON.stringify({
        suggestions: [{ ...hit(1), matchReason: "cached reason" }],
        rerankFallback: false,
        generatedAt: "2026-06-05T00:00:00.000Z",
      }),
    );

    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.fromCache).toBe(true);
    expect(res.data.suggestions[0]!.matchReason).toBe("cached reason");
    expect(runSmartMatchMock).not.toHaveBeenCalled();
    expect(rerankMock).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("case 2b: force=true bypasses cache hit and regenerates", async () => {
    redisGet.mockResolvedValue(
      JSON.stringify({
        suggestions: [{ ...hit(9), matchReason: "stale" }],
        rerankFallback: false,
        generatedAt: "2026-06-05T00:00:00.000Z",
      }),
    );
    runSmartMatchMock.mockResolvedValue({ results: [hit(1)], product: {}, durationMs: 5 });
    rerankMock.mockResolvedValue({ rank: [hit(1)], matchReasons: new Map(), fallback: true });

    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID, force: true });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.fromCache).toBe(false);
    expect(res.data.rerankFallback).toBe(true);
    expect(runSmartMatchMock).toHaveBeenCalledOnce();
  });

  it("case 3: campaign not found → campaign_not_found error", async () => {
    campaignFindFirst.mockResolvedValue(null);
    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });
    expect(res).toEqual({ ok: false, error: "campaign_not_found" });
    expect(runSmartMatchMock).not.toHaveBeenCalled();
  });

  it("case 4: campaign.productId is null → product_missing error", async () => {
    campaignFindFirst.mockResolvedValue({
      name: "Camp",
      markets: ["US"],
      budgetAmount: null,
      productId: null,
    });
    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });
    expect(res).toEqual({ ok: false, error: "product_missing" });
    expect(runSmartMatchMock).not.toHaveBeenCalled();
  });

  it("case 5: excludes already-decided KOLs before rerank", async () => {
    const pool = [hit(1), hit(2), hit(3)];
    runSmartMatchMock.mockResolvedValue({ results: pool, product: {}, durationMs: 5 });
    kolCampaignFindMany.mockResolvedValue([{ kolId: pool[1]!.id }]); // kol2 decided
    rerankMock.mockResolvedValue({ rank: [pool[0], pool[2]], matchReasons: new Map(), fallback: false });

    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });
    expect(res.ok).toBe(true);
    // rerank received only the 2 non-decided candidates.
    const passedCandidates = rerankMock.mock.calls[0]![0] as SmartMatchKolHit[];
    expect(passedCandidates.map((c) => c.id)).toEqual([pool[0]!.id, pool[2]!.id]);
  });

  it("case 6: rate limit blocked → rate_limit_exceeded, no downstream", async () => {
    rateLimitAiMock.mockResolvedValue({ ok: false, retryAfter: 42 });
    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });
    expect(res).toEqual({ ok: false, error: "rate_limit_exceeded", retryAfter: 42 });
    expect(campaignFindFirst).not.toHaveBeenCalled();
  });

  it("case 7: unauthorized when no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await getCampaignSuggestions({ campaignId: CAMPAIGN_ID });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });
});
