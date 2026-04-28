import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  embedBatch,
  embedOne,
  EmbeddingError,
} from "@/lib/embedding/client";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.AIGCGATEWAY_API_KEY = "pk_test";
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.test/v1";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function buildOk(vectors: number[][]): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        object: "list",
        data: vectors.map((v, i) => ({
          object: "embedding",
          index: i,
          embedding: v,
        })),
        model: "bge-m3",
        usage: { prompt_tokens: 100, total_tokens: 100 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  ) as unknown as typeof fetch;
}

function makeVec(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) => (i + seed) / 1000);
}

describe("embedBatch happy path", () => {
  it("returns vectors in input order + estimates cost", async () => {
    const fetchImpl = buildOk([makeVec(0), makeVec(1), makeVec(2)]);
    const r = await embedBatch(["a", "b", "c"], { fetchImpl });
    expect(r.vectors).toHaveLength(3);
    expect(r.vectors[0]).toHaveLength(EMBEDDING_DIMS);
    expect(r.usage.promptTokens).toBe(100);
    expect(r.usage.estimatedCostUsd).toBeCloseTo(
      (100 * 0.084) / 1_000_000,
      9
    );
  });

  it("re-orders out-of-order responses by index", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [
            { object: "embedding", index: 2, embedding: makeVec(20) },
            { object: "embedding", index: 0, embedding: makeVec(0) },
            { object: "embedding", index: 1, embedding: makeVec(10) },
          ],
          model: "bge-m3",
          usage: { prompt_tokens: 50, total_tokens: 50 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;
    const r = await embedBatch(["a", "b", "c"], { fetchImpl });
    expect(r.vectors[0]?.[0]).toBeCloseTo(0 / 1000, 6);
    expect(r.vectors[1]?.[0]).toBeCloseTo(10 / 1000, 6);
    expect(r.vectors[2]?.[0]).toBeCloseTo(20 / 1000, 6);
  });

  it("collapses single-element input to scalar `input` (gateway compatibility)", async () => {
    const captured: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(async (url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      captured.push({ url: String(url), body });
      return new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: makeVec(0) }],
          model: "bge-m3",
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    await embedBatch(["only"], { fetchImpl });
    expect(captured[0]?.body).toMatchObject({ input: "only" });
  });

  it("returns empty result when no input rows", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await embedBatch([], { fetchImpl });
    expect(r.vectors).toEqual([]);
    expect(r.usage.promptTokens).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("embedBatch error paths", () => {
  it("throws config error when API key missing", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    await expect(embedBatch(["x"])).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("throws http error on 500", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("upstream blew up", { status: 502 })
    ) as unknown as typeof fetch;
    await expect(
      embedBatch(["x"], { fetchImpl })
    ).rejects.toMatchObject({ kind: "http" });
  });

  it("throws schema error when payload missing fields", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ wrong: true }), { status: 200 })
    ) as unknown as typeof fetch;
    await expect(
      embedBatch(["x"], { fetchImpl })
    ).rejects.toMatchObject({ kind: "schema" });
  });

  it("throws dim_mismatch when vector length wrong", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2] }],
          model: "bge-m3",
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;
    await expect(
      embedBatch(["x"], { fetchImpl })
    ).rejects.toMatchObject({ kind: "dim_mismatch" });
  });

  it("throws schema error when response count != input count", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: makeVec(0) }],
          model: "bge-m3",
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;
    await expect(
      embedBatch(["a", "b"], { fetchImpl })
    ).rejects.toMatchObject({ kind: "schema" });
  });
});

describe("embedOne", () => {
  it("returns single vector + usage", async () => {
    const fetchImpl = buildOk([makeVec(7)]);
    const r = await embedOne("solo", { fetchImpl });
    expect(r.vector).toHaveLength(EMBEDDING_DIMS);
    expect(r.usage.promptTokens).toBe(100);
  });
});
