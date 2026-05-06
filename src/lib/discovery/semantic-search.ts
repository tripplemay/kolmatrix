/**
 * BL-044 F001 · Semantic KOL search server logic.
 *
 * Free-text natural-language query → top-K KOLs by cosine similarity
 * against `kol.embedding`. Forks the SmartMatch (B7a-F002) range pattern
 * but the input is an embedded query string, not a Product row. Used by
 * /discovery `?ai=<query>` to power the AI suggestion chips and any
 * future free-text semantic input.
 *
 * Pre-impl audit lock (2026-05-06 16:30, see
 * docs/specs/BL-044-pre-impl-audit.md §9):
 *   - #1:B fork inline cosine SQL (with `is_suspicious=false` + soft-delete
 *     filter) — keep the "what suspicious KOLs are hidden" rule in one
 *     SQL site rather than after-the-fact filtering during hydration.
 *   - #2:B default topK = 50 (spec D2). SmartMatch's 10 is a "top
 *     recommendations" pattern; semantic search is "give me a page of
 *     candidates", so 50 = grid pageSize is the right ceiling.
 *   - #3:A rate-limit at module top (fail-fast, before embed/DB) — same
 *     order as roi/actions.ts:43, database/actions.ts:163.
 *   - #8:C cost-cap counter only on the free-text path. Chip cache hits
 *     have $0 actual cost (no aigcgateway call); counting them would
 *     burn the $5/day cap on read-only chip clicks.
 *
 * RLS: cosine query runs inside withTenant(), so KOLs from other
 * tenants are invisible even though the SQL itself doesn't include
 * `tenant_id` — the RLS policy on `kol` adds it.
 */
import { Prisma } from "@prisma/client";

import { recordAiUsage, assertDailyCostBudget } from "@/lib/ai/cost-cap";
import { withTenant } from "@/lib/db";
import { embedBatch, embedOne } from "@/lib/embedding/client";
import { vectorLiteral } from "@/lib/embedding/sql";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";
import { rateLimitAi } from "@/lib/rate-limit-ai";

/** Default cosine top-K (spec D2 = 50; pre-impl #2:B). */
export const DEFAULT_TOP_K = 50;

/** Hard upper bound on the request topK to keep the LIMIT parameter
 *  controllable when interpolated via `Prisma.raw` below. */
export const MAX_TOP_K = 200;

/** Hard cap on input length — keeps embedding cost bounded and rejects
 *  pathological inputs early (the gateway already truncates internally
 *  but the policy is clearer here). */
export const QUERY_TEXT_MAX_LEN = 200;

/**
 * Process-local chip embedding cache. Populated by F003
 * `preWarmChipCache()` for the 5-locale × 3-chip = 15 known chip texts.
 * Cache key = trimmed queryText (canonical form). Cache hits skip the
 * aigcgateway call AND the cost-cap counter (#8:C — chip clicks have
 * $0 real cost).
 */
const CHIP_EMBEDDING_CACHE = new Map<string, number[]>();

/**
 * Set of "known chip texts" registered via `registerChipTexts`. Only
 * queryTexts in this set are written into `CHIP_EMBEDDING_CACHE` after
 * a cache miss. Free-text queries embed normally but are NOT cached
 * (pre-impl #6:C — bounded chip set guarantees deterministic cache
 * shape, and free-text queries have unbounded cardinality so caching
 * them would gradually leak memory).
 */
const KNOWN_CHIP_TEXTS = new Set<string>();

export class SemanticSearchError extends Error {
  constructor(
    public readonly code:
      | "INVALID_QUERY"
      | "RATE_LIMIT_EXCEEDED"
      | "EMBED_FAILED"
      | "DB_ERROR",
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "SemanticSearchError";
  }
}

export interface SemanticSearchInput {
  tenantId: string;
  /** Natural-language search text. Trimmed; rejected if empty / >200 chars. */
  queryText: string;
  /** Override default cosine top-K (default 50, spec D2). 1..200. */
  topK?: number;
}

export interface SemanticSearchResult {
  /** KOL ids ordered by cosine distance ASC (closest first). */
  kolIds: string[];
  /** USD cost of this call. 0 when the chip cache served the embedding. */
  cost: number;
  /** Wall-clock latency in ms. */
  latencyMs: number;
  /** Whether the chip embedding cache served the query (skips embed + cost-cap). */
  cacheHit: boolean;
}

/**
 * Run a semantic KOL search for one tenant. Throws SemanticSearchError on
 * predictable failures; any other DB error is wrapped as `DB_ERROR`.
 *
 * Order of operations (spec §F001 + audit #3:A fail-fast):
 *   1. Validate query (cheap)
 *   2. Rate-limit gate (Redis hop, fast reject)
 *   3. Cache check; if hit → skip cost-cap + embed
 *   4. Cost-cap gate (DB count, free-text path only — #8:C)
 *   5. Embed via aigcgateway (free-text path only)
 *   6. Cosine top-K via inline raw SQL inside withTenant()
 *   7. Record usage (free-text path only — chip hits cost $0)
 */
export async function runSemanticKolSearch(
  input: SemanticSearchInput,
): Promise<SemanticSearchResult> {
  const startedAt = Date.now();
  const queryText = (input.queryText ?? "").trim();
  const topK = input.topK ?? DEFAULT_TOP_K;

  // 1. Query validation
  if (queryText.length === 0) {
    throw new SemanticSearchError("INVALID_QUERY", "queryText is empty");
  }
  if (queryText.length > QUERY_TEXT_MAX_LEN) {
    throw new SemanticSearchError(
      "INVALID_QUERY",
      `queryText length ${queryText.length} exceeds ${QUERY_TEXT_MAX_LEN}`,
    );
  }
  if (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K) {
    throw new SemanticSearchError(
      "INVALID_QUERY",
      `topK must be an integer in [1, ${MAX_TOP_K}], got ${topK}`,
    );
  }

  // 2. Rate-limit (fail-fast — pre-impl #3:A)
  const rl = await rateLimitAi(input.tenantId);
  if (!rl.ok) {
    throw new SemanticSearchError(
      "RATE_LIMIT_EXCEEDED",
      `AI rate limit exceeded; retry after ${rl.retryAfter}s`,
      rl.retryAfter,
    );
  }

  // 3-5. Resolve query embedding: cache hit → 0 cost; miss → cost-cap + embed
  const cached = CHIP_EMBEDDING_CACHE.get(queryText);
  let queryVec: number[];
  let cost = 0;
  let cacheHit = false;

  if (cached !== undefined) {
    queryVec = cached;
    cacheHit = true;
  } else {
    // Free-text path only — #8:C: count this against the per-tenant
    // daily AI cost cap. Chip cache hits skip this gate intentionally.
    await assertDailyCostBudget(input.tenantId);

    let embedded;
    try {
      embedded = await embedOne(queryText);
    } catch (err) {
      throw new SemanticSearchError(
        "EMBED_FAILED",
        `embed failed: ${(err as Error).message.slice(0, 160)}`,
      );
    }
    queryVec = embedded.vector;
    cost = embedded.usage.estimatedCostUsd;

    // Opportunistic cache write — only for registered chip texts.
    // Free-text queries embed once and stay uncached so the Map can't
    // grow unbounded across an unbounded query space (pre-impl #6:C).
    if (KNOWN_CHIP_TEXTS.has(queryText)) {
      CHIP_EMBEDDING_CACHE.set(queryText, queryVec);
    }
  }

  // 6. Cosine top-K via inline raw SQL (pre-impl #1:B — fork SmartMatch
  //    pattern with explicit is_suspicious=false + deleted_at IS NULL
  //    filter so suspicious KOLs are filtered at the SQL boundary, not
  //    later during hydration).
  const lit = vectorLiteral(queryVec);
  const dimsRaw = Prisma.raw(String(EMBEDDING_DIMS));
  const limitRaw = Prisma.raw(String(topK));

  let rows: Array<{ id: string }>;
  try {
    rows = await withTenant(input.tenantId, (tx) =>
      tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM "kol"
        WHERE "embedding" IS NOT NULL
          AND "deleted_at" IS NULL
          AND "is_suspicious" = false
        ORDER BY ("embedding" <=> ${lit}::vector(${dimsRaw})) ASC
        LIMIT ${limitRaw}
      `),
    );
  } catch (err) {
    throw new SemanticSearchError(
      "DB_ERROR",
      `cosine top-K failed: ${(err as Error).message.slice(0, 160)}`,
    );
  }

  const kolIds = rows.map((r) => r.id);

  // 7. Record AI usage on the free-text path (#8:C — chip cache hits
  //    do not contribute to cost-cap). The recordAiUsage call is wrapped
  //    in try/catch inside cost-cap.ts via logEvent, so a DB hiccup here
  //    cannot tank the search response. extras carries monitoring fields
  //    (source/queryText preview/cacheHit/kolIdsCount) per pre-impl
  //    audit decision #7:C — these enrich event_log payload without
  //    breaking the cost-cap counter SSOT.
  if (!cacheHit) {
    await recordAiUsage(input.tenantId, "discovery.semantic_search", cost, {
      source: "semantic_search",
      queryText50: queryText.slice(0, 50),
      cacheHit: false,
      kolIdsCount: kolIds.length,
    });
  }

  return {
    kolIds,
    cost,
    latencyMs: Date.now() - startedAt,
    cacheHit,
  };
}

// ---------------------------------------------------------------------
// F003 · Chip cache pre-warming + ENABLE_AI_SEARCH escape hatch.
// ---------------------------------------------------------------------

/**
 * Returns true when AI semantic search should run for incoming requests.
 * Default = enabled; set `ENABLE_AI_SEARCH=false` to short-circuit to
 * the ILIKE fallback path (page.tsx checks this and routes accordingly).
 *
 * Same shape as BL-020 F005 `DISABLE_LOGIN_RATELIMIT` / BL-034 F005
 * cost-cap escape hatch — env var-driven kill switch for prod incidents
 * without a redeploy. Spec §F003 acceptance.
 */
export function isAiSearchEnabled(): boolean {
  return process.env.ENABLE_AI_SEARCH !== "false";
}

/**
 * Register chip texts (typically called from a layout / page server
 * component once per request). The set is process-local; idempotent
 * additions are cheap. Only queryTexts in this set are cached after a
 * miss, so free-text queries do not pollute the cache (pre-impl #6:C).
 */
export function registerChipTexts(texts: readonly string[]): void {
  for (const t of texts) {
    const trimmed = t.trim();
    if (trimmed.length > 0) KNOWN_CHIP_TEXTS.add(trimmed);
  }
}

/**
 * Lazy first-request cache pre-warm. Embeds the supplied chip texts in
 * a single batch call and populates the cache. Skips texts that are
 * already cached. Returns counts so callers (health endpoint / dev
 * tooling) can verify the warmup ran.
 *
 * Pre-impl #6:C — chip clicks 100% cache hit after preWarm; free text
 * is not part of the bounded set and is NOT pre-warmed.
 *
 * Failures are wrapped in SemanticSearchError(EMBED_FAILED) but never
 * thrown to the caller in fire-and-forget contexts — wrap with
 * `.catch(() => undefined)` at the call site.
 */
export async function preWarmChipCache(
  chipTexts: readonly string[],
): Promise<{ warmed: number; alreadyCached: number; cost: number }> {
  registerChipTexts(chipTexts);
  const targets = Array.from(new Set(chipTexts.map((t) => t.trim()).filter(Boolean)));
  const toEmbed = targets.filter((t) => !CHIP_EMBEDDING_CACHE.has(t));
  if (toEmbed.length === 0) {
    return {
      warmed: 0,
      alreadyCached: targets.length,
      cost: 0,
    };
  }

  let result;
  try {
    result = await embedBatch(toEmbed);
  } catch (err) {
    throw new SemanticSearchError(
      "EMBED_FAILED",
      `chip pre-warm failed: ${(err as Error).message.slice(0, 160)}`,
    );
  }
  for (let i = 0; i < toEmbed.length; i += 1) {
    const text = toEmbed[i]!;
    const vec = result.vectors[i];
    if (vec && vec.length === EMBEDDING_DIMS) {
      CHIP_EMBEDDING_CACHE.set(text, vec);
    }
  }
  return {
    warmed: toEmbed.length,
    alreadyCached: targets.length - toEmbed.length,
    cost: result.usage.estimatedCostUsd,
  };
}

// ---------------------------------------------------------------------
// Test-only helpers — internal API for unit tests + cache introspection.
// Consumers in production code should NOT touch the cache directly.
// ---------------------------------------------------------------------

/** Read-only snapshot of the chip embedding cache (debug / tests). */
export function __getChipEmbeddingCache(): ReadonlyMap<string, number[]> {
  return CHIP_EMBEDDING_CACHE;
}

/** Manually seed a (queryText → vector) entry. Used by F003 preWarm
 *  + unit tests. queryText must already be trimmed. */
export function __seedChipEmbeddingCache(queryText: string, vector: number[]): void {
  if (vector.length !== EMBEDDING_DIMS) {
    throw new Error(
      `__seedChipEmbeddingCache: expected ${EMBEDDING_DIMS} dims, got ${vector.length}`,
    );
  }
  CHIP_EMBEDDING_CACHE.set(queryText, vector);
}

/** Drop all cache entries. Tests + future cache-invalidation hook. */
export function __clearChipEmbeddingCache(): void {
  CHIP_EMBEDDING_CACHE.clear();
  KNOWN_CHIP_TEXTS.clear();
}

/** Read-only snapshot of registered chip texts (debug / tests). */
export function __getKnownChipTexts(): ReadonlySet<string> {
  return KNOWN_CHIP_TEXTS;
}
