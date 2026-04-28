/**
 * B7a-F001 · aigcgateway embedding client.
 *
 * Pre-impl audit lock #9:A (2026-04-28) — sticks to the project's
 * existing aigcgateway pattern: raw `fetch` + zod validation, same
 * shape as `src/lib/products/generateAiAssets.ts` and
 * `src/lib/roi/insights.ts`. No new SDK dependency.
 *
 * Endpoint is OpenAI-compatible: `POST /v1/embeddings` with
 * `{ model, input }` where input is a single string or an array of
 * strings (batch). The gateway returns one embedding per input row in
 * the same order, plus aggregate token usage.
 */
import { z } from "zod";

import {
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  type EmbeddingApiRequest,
  type EmbeddingApiResponse,
  type EmbeddingBatchUsage,
} from "./types";

/** bge-m3 input price per 1M tokens (USD). Mirrors aigcgateway model card. */
const BGE_M3_INPUT_USD_PER_M = 0.084;

/** Default request timeout. Single batch usually returns in < 5s. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The shape of one error reachable from a failed call. Mirrors the
 * EmbeddingError patterns in roi/insights.ts so logging code can
 * `instanceof` cleanly.
 */
export class EmbeddingError extends Error {
  constructor(
    public readonly kind:
      | "config"
      | "timeout"
      | "fetch"
      | "http"
      | "parse"
      | "schema"
      | "dim_mismatch",
    message: string
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

const responseSchema: z.ZodType<EmbeddingApiResponse> = z.object({
  object: z.literal("list"),
  data: z.array(
    z.object({
      object: z.literal("embedding"),
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number()),
    })
  ),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }),
});

export interface EmbeddingClientOpts {
  /** Override fetch (tests inject mock). */
  fetchImpl?: typeof fetch;
  /** Override base URL (defaults to `process.env.AIGCGATEWAY_BASE_URL`
   *  or `https://aigc.guangai.ai/v1`). */
  baseUrl?: string;
  /** Override API key (defaults to `process.env.AIGCGATEWAY_API_KEY`). */
  apiKey?: string;
  /** Override timeout in ms. */
  timeoutMs?: number;
  /** Override model id (defaults to `bge-m3`). */
  model?: string;
}

export interface EmbeddingBatchResult {
  /** One vector per input row, in the same order. */
  vectors: number[][];
  usage: EmbeddingBatchUsage;
}

function resolveConfig(opts: EmbeddingClientOpts): {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  model: string;
  fetchImpl: typeof fetch;
} {
  const baseUrl =
    opts.baseUrl ??
    process.env.AIGCGATEWAY_BASE_URL ??
    "https://aigc.guangai.ai/v1";
  const apiKey = opts.apiKey ?? process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError("config", "AIGCGATEWAY_API_KEY not set");
  }
  return {
    baseUrl,
    apiKey,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    model: opts.model ?? EMBEDDING_MODEL,
    fetchImpl: opts.fetchImpl ?? fetch,
  };
}

/**
 * Embed an array of texts in one batch call.
 *
 * Batch size limits: aigcgateway upper bound is undocumented; the
 * batch script (kol-embed-batch.ts) uses progressive halving on
 * failure (100 → 50 → 20 → 1). Single-call max is enforced here only
 * by the gateway's own response.
 */
export async function embedBatch(
  inputs: readonly string[],
  opts: EmbeddingClientOpts = {}
): Promise<EmbeddingBatchResult> {
  if (inputs.length === 0) {
    return {
      vectors: [],
      usage: { promptTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    };
  }

  const cfg = resolveConfig(opts);
  const body: EmbeddingApiRequest = {
    model: cfg.model,
    input: inputs.length === 1 ? inputs[0]! : [...inputs],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let res: Response;
  try {
    res = await cfg.fetchImpl(`${cfg.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new EmbeddingError(
        "timeout",
        `aigcgateway /v1/embeddings timed out after ${cfg.timeoutMs}ms`
      );
    }
    throw new EmbeddingError(
      "fetch",
      `aigcgateway fetch failed: ${(err as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    throw new EmbeddingError(
      "http",
      `aigcgateway responded ${res.status}: ${text.slice(0, 200)}`
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw new EmbeddingError(
      "parse",
      `aigcgateway response not JSON: ${(err as Error).message}`
    );
  }

  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new EmbeddingError(
      "schema",
      `aigcgateway response failed schema: ${parsed.error.message.slice(0, 200)}`
    );
  }

  const data = parsed.data;
  if (data.data.length !== inputs.length) {
    throw new EmbeddingError(
      "schema",
      `expected ${inputs.length} embeddings, got ${data.data.length}`
    );
  }

  // The gateway is allowed to return `data` in arbitrary order; reorder
  // by `index` so callers can rely on positional pairing with `inputs`.
  const sorted = [...data.data].sort((a, b) => a.index - b.index);

  const vectors: number[][] = [];
  for (const row of sorted) {
    if (row.embedding.length !== EMBEDDING_DIMS) {
      throw new EmbeddingError(
        "dim_mismatch",
        `expected ${EMBEDDING_DIMS}-dim vector, got ${row.embedding.length}`
      );
    }
    vectors.push(row.embedding);
  }

  const promptTokens = data.usage.prompt_tokens;
  const totalTokens = data.usage.total_tokens;
  const estimatedCostUsd = (promptTokens * BGE_M3_INPUT_USD_PER_M) / 1_000_000;

  return {
    vectors,
    usage: { promptTokens, totalTokens, estimatedCostUsd },
  };
}

/** Convenience for the single-row case (e.g. just-in-time Product embed). */
export async function embedOne(
  input: string,
  opts: EmbeddingClientOpts = {}
): Promise<{ vector: number[]; usage: EmbeddingBatchUsage }> {
  const { vectors, usage } = await embedBatch([input], opts);
  return { vector: vectors[0]!, usage };
}
