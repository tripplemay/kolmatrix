/**
 * B7a-F001 · Embedding pipeline shared types.
 *
 * The pipeline calls aigcgateway `/v1/embeddings` (OpenAI-compatible)
 * with model `bge-m3` (1024 dims, multilingual). Vectors are persisted
 * in `kol.embedding` / `product.embedding` (pgvector type) and queried
 * with the cosine operator `<=>` for Smart Match (F002+).
 *
 * Pre-impl audit lock (2026-04-28): see
 * docs/specs/B7a-f001-embedding-preimpl-audit.md §9.
 */

/** bge-m3 dimensions — verified against the production model card. */
export const EMBEDDING_DIMS = 1024 as const;

/** Default model id surfaced by aigcgateway. */
export const EMBEDDING_MODEL = "bge-m3" as const;

/**
 * One embedding source row. We split text-building from API-calling so
 * batch workers can re-embed only when `embeddingTextHash` differs from
 * the locally computed hash (see `hashEmbeddingText`).
 */
export interface EmbeddingSource {
  /** Database row id (UUID for kol, cuid for product). */
  id: string;
  /** Composed embedding source text (see text.ts builders). */
  text: string;
  /** Hash of the source text (used for B6 dirty-check, decision #6:B'). */
  hash: string;
}

/**
 * One embedding result paired back with its source row id so callers
 * can fan-out updates without re-correlating.
 */
export interface EmbeddingResult {
  id: string;
  embedding: number[];
  hash: string;
  /** prompt_tokens reported by the gateway (per source row). May be
   *  undefined when batched and the gateway only returns aggregate
   *  usage (see client.ts handling). */
  promptTokens?: number;
}

/** Aggregate usage from one batch call. */
export interface EmbeddingBatchUsage {
  promptTokens: number;
  totalTokens: number;
  /** Estimated USD cost using bge-m3 input price ($0.084 / 1M tokens). */
  estimatedCostUsd: number;
}

/** OpenAI-compatible request envelope sent to aigcgateway. */
export interface EmbeddingApiRequest {
  model: string;
  input: string | string[];
}

/** OpenAI-compatible response envelope. */
export interface EmbeddingApiResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Outcome of a top-k similarity query (used by F002 Smart Match and
 * future F007 KOL similarity). Distances are returned by `<=>` and are
 * in [0, 2] (0 = identical, 2 = opposite); cosine *similarity* is
 * 1 - distance (clamped to [-1, 1]).
 */
export interface SimilarityResult<T = unknown> {
  row: T;
  distance: number;
  similarity: number;
}
