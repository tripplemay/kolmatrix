import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  rerankWithReason,
  MAX_REASON_LEN,
  type RerankCampaignMeta,
  type RerankFallbackReason,
} from "@/lib/match/llm-rerank";
import type { SmartMatchKolHit } from "@/lib/discovery/smart-match";

// BL-084-F002: LLM rerank service. The aigcgateway call is stubbed via
// opts.runAction so these are pure unit tests (no network / DB).

function makeHit(i: number): SmartMatchKolHit {
  return {
    id: `kol-${i}`,
    displayName: `KOL ${i}`,
    handle: `kol${i}`,
    platform: "youtube",
    avatarUrl: null,
    followerCount: 10_000 + i,
    countryCode: "US",
    categories: ["gaming"],
    distance: 0.1 + i / 100,
    similarity: 0.9 - i / 100,
    matchScore: 90 - i,
    valueScore: 50,
  };
}

function makePool(n: number): SmartMatchKolHit[] {
  return Array.from({ length: n }, (_, i) => makeHit(i));
}

const META: RerankCampaignMeta = {
  name: "Summer Gaming Push",
  markets: ["US", "JP"],
  targetAudience: "18-24 mobile gamers",
  budget: 5000,
};

beforeEach(() => {
  vi.stubEnv("AIGCGATEWAY_MATCH_RERANK_ACTION_ID", "test-action-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rerankWithReason (BL-084-F002)", () => {
  it("case 1: reranks 30 candidates with reasons (real reorder)", async () => {
    const pool = makePool(30);
    // Stub returns REVERSED rank order with a reason for each.
    const runAction = vi.fn(async () => ({
      output: {
        ranked: pool.map((c, idx) => ({
          kolId: c.id,
          rank: pool.length - 1 - idx, // reverse: last input → rank 0
          reason: `Great fit ${idx}`,
        })),
      },
      usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
      traceId: "trc-1",
    }));

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
    });

    expect(result.fallback).toBe(false);
    expect(result.rank).toHaveLength(30);
    expect(result.matchReasons.size).toBe(30);
    // Proves a genuine rerank: input[0] is now last.
    expect(result.rank[0]!.id).toBe("kol-29");
    expect(result.rank[29]!.id).toBe("kol-0");
    // Every reason present + within length bound.
    for (const hit of result.rank) {
      const reason = result.matchReasons.get(hit.id);
      expect(reason).toBeTruthy();
      expect(reason!.length).toBeLessThanOrEqual(MAX_REASON_LEN);
    }
    expect(runAction).toHaveBeenCalledOnce();
  });

  it("case 2: LLM timeout → cosine fallback (input order, no reasons)", async () => {
    const pool = makePool(30);
    const timeoutErr = new Error("timed out");
    timeoutErr.name = "AigcActionTimeoutError";
    const runAction = vi.fn(async () => {
      throw timeoutErr;
    });
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(result.rank).toEqual(pool); // unchanged cosine order
    expect(result.matchReasons.size).toBe(0);
    expect(fallbacks).toEqual(["timeout"]);
  });

  it("case 3: invalid JSON (parse error) → fallback + log", async () => {
    const pool = makePool(5);
    const parseErr = new Error("not json");
    parseErr.name = "AigcActionParseError";
    const runAction = vi.fn(async () => {
      throw parseErr;
    });
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(result.rank).toEqual(pool);
    expect(fallbacks).toEqual(["unparsable"]);
  });

  it("case 4: empty candidates → empty result, no LLM call", async () => {
    const runAction = vi.fn();
    const result = await rerankWithReason([], META, {
      tenantId: "t1",
      runAction: runAction as never,
    });
    expect(result.fallback).toBe(false);
    expect(result.rank).toEqual([]);
    expect(result.matchReasons.size).toBe(0);
    expect(runAction).not.toHaveBeenCalled();
  });

  it("case 5: schema mismatch (valid JSON, wrong shape) → fallback", async () => {
    const pool = makePool(3);
    const runAction = vi.fn(async () => ({
      output: { wrong: "shape" },
      usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
      traceId: null,
    }));
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(fallbacks).toEqual(["schema_mismatch"]);
  });

  it("case 6: hallucinated/duplicate kolId → permutation_invalid fallback", async () => {
    const pool = makePool(3);
    const runAction = vi.fn(async () => ({
      output: {
        ranked: [
          { kolId: "kol-0", rank: 0, reason: "a" },
          { kolId: "kol-0", rank: 1, reason: "b" }, // duplicate
          { kolId: "kol-99", rank: 2, reason: "c" }, // hallucinated
        ],
      },
      usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
      traceId: null,
    }));
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(result.rank).toEqual(pool);
    expect(fallbacks).toEqual(["permutation_invalid"]);
  });

  it("case 7: action id not configured → fallback before any call", async () => {
    vi.stubEnv("AIGCGATEWAY_MATCH_RERANK_ACTION_ID", "");
    const pool = makePool(2);
    const runAction = vi.fn();
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(fallbacks).toEqual(["action_not_configured"]);
    expect(runAction).not.toHaveBeenCalled();
  });

  it("case 8: reason exceeding 120 chars fails schema → fallback", async () => {
    const pool = makePool(2);
    const longReason = "x".repeat(MAX_REASON_LEN + 1);
    const runAction = vi.fn(async () => ({
      output: {
        ranked: [
          { kolId: "kol-0", rank: 0, reason: longReason },
          { kolId: "kol-1", rank: 1, reason: "ok" },
        ],
      },
      usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
      traceId: null,
    }));
    const fallbacks: RerankFallbackReason[] = [];

    const result = await rerankWithReason(pool, META, {
      tenantId: "t1",
      runAction: runAction as never,
      onFallback: (r) => fallbacks.push(r),
    });

    expect(result.fallback).toBe(true);
    expect(fallbacks).toEqual(["schema_mismatch"]);
  });
});
