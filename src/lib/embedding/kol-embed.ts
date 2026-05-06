/**
 * B7a-F001 · KOL/Product embedding pipeline orchestrator.
 *
 * Two entry points:
 *
 *   - `embedKolBatch(prisma, opts)`    — one-time backfill that walks
 *     every KOL row whose embedding is stale (NULL or hash mismatch)
 *     and embeds them in batches.
 *
 *   - `embedKolsForIds(prisma, ids)`   — incremental hook used by the
 *     B6 daily-sync after the import phase. Skips rows whose source
 *     text hash matches the stored `embedding_text_hash` (audit
 *     lock #6:B' — only re-embed when displayName/bio/categories/tags
 *     actually change, not when subscriber count changes).
 *
 * Failure isolation: a single batch failure (gateway 5xx, dim
 * mismatch) is logged + counted but doesn't abort the loop. The B6
 * hook (decision #8:B) treats the embedding step as a soft phase — a
 * gateway outage degrades to "embeddings stale by one day" rather than
 * "daily sync failed".
 */
import { Prisma, type PrismaClient } from "@prisma/client";

import { assertUuid } from "@/lib/uuid";

import {
  embedBatch,
  EmbeddingError,
  type EmbeddingClientOpts,
} from "./client";
import { logEmbeddingInvoked, type EmbeddingInvokedSource } from "./event-log";
import {
  buildKolEmbedText,
  buildProductEmbedText,
  hashEmbeddingText,
  type KolEmbedInput,
  type ProductEmbedInput,
} from "./text";
import {
  updateKolEmbeddingSql,
  updateProductEmbeddingSql,
} from "./sql";

const DEFAULT_BATCH_SIZE = 100;
const FALLBACK_BATCH_SIZES = [50, 20, 1] as const;
/**
 * aigcgateway per-key RPM cap is ~30. Sleeping 2.5s between batches
 * keeps us at ≤ 24 RPM with comfortable headroom. The client.ts layer
 * also honours 429 `retryAfterSeconds` as a fallback if a burst slips
 * through (e.g. concurrent runs against the same key).
 */
const INTER_BATCH_THROTTLE_MS = 2_500;

export interface EmbedRunStats {
  /** Rows considered for this run. */
  scanned: number;
  /** Rows skipped (hash matched / empty text / already embedded). */
  skipped: number;
  /** Rows successfully embedded + persisted. */
  embedded: number;
  /** Rows that failed in any way (logged but not raised). */
  failed: number;
  /** Aggregate batches sent. */
  batches: number;
  /** Aggregate prompt tokens consumed. */
  promptTokens: number;
  /** Estimated USD cost. */
  estimatedCostUsd: number;
}

function emptyStats(): EmbedRunStats {
  return {
    scanned: 0,
    skipped: 0,
    embedded: 0,
    failed: 0,
    batches: 0,
    promptTokens: 0,
    estimatedCostUsd: 0,
  };
}

/** Row shape we read for KOL embedding. Subset of `kol` columns. */
interface KolRowForEmbed {
  id: string;
  display_name: string;
  bio: string | null;
  categories: string[] | null;
  tags: string[] | null;
  country_code: string | null;
  language: string | null;
  embedding_text_hash: string | null;
  needs_init: boolean;
}

/** Row shape we read for Product embedding. */
interface ProductRowForEmbed {
  id: string;
  name: string;
  category: string;
  target_audience: string;
  unique_selling_points: string;
  embedding_text_hash: string | null;
  needs_init: boolean;
}

/** Filter rows whose locally computed hash matches the stored one. */
function pickStaleKol(rows: readonly KolRowForEmbed[]): {
  stale: Array<{ id: string; text: string; hash: string }>;
  skipped: number;
} {
  let skipped = 0;
  const stale: Array<{ id: string; text: string; hash: string }> = [];
  for (const r of rows) {
    const input: KolEmbedInput = {
      displayName: r.display_name,
      bio: r.bio,
      categories: r.categories,
      tags: r.tags,
      countryCode: r.country_code,
      language: r.language,
    };
    const text = buildKolEmbedText(input);
    if (!text) {
      // No usable source text → leave embedding NULL.
      skipped += 1;
      continue;
    }
    const hash = hashEmbeddingText(text);
    if (!r.needs_init && r.embedding_text_hash === hash) {
      skipped += 1;
      continue;
    }
    stale.push({ id: r.id, text, hash });
  }
  return { stale, skipped };
}

function pickStaleProduct(rows: readonly ProductRowForEmbed[]): {
  stale: Array<{ id: string; text: string; hash: string }>;
  skipped: number;
} {
  let skipped = 0;
  const stale: Array<{ id: string; text: string; hash: string }> = [];
  for (const r of rows) {
    const input: ProductEmbedInput = {
      name: r.name,
      category: r.category,
      targetAudience: r.target_audience,
      uniqueSellingPoints: r.unique_selling_points,
    };
    const text = buildProductEmbedText(input);
    if (!text) {
      skipped += 1;
      continue;
    }
    const hash = hashEmbeddingText(text);
    if (!r.needs_init && r.embedding_text_hash === hash) {
      skipped += 1;
      continue;
    }
    stale.push({ id: r.id, text, hash });
  }
  return { stale, skipped };
}

/**
 * Send one batch with progressive halving on failure: 100 → 50 → 20 → 1.
 *
 * On final 1-by-1 retry we still report individual failures so the
 * caller can update stats correctly. Returns the per-row outcomes.
 */
async function sendBatchWithFallback(
  rows: ReadonlyArray<{ id: string; text: string; hash: string }>,
  clientOpts: EmbeddingClientOpts,
  onLog: (msg: string) => void
): Promise<{
  embedded: Array<{ id: string; vector: number[]; hash: string }>;
  failedIds: string[];
  promptTokens: number;
  estimatedCostUsd: number;
  batches: number;
}> {
  const embedded: Array<{ id: string; vector: number[]; hash: string }> = [];
  const failedIds: string[] = [];
  let promptTokens = 0;
  let estimatedCostUsd = 0;
  let batches = 0;

  // Build a single chunk-runner that on failure halves and retries.
  async function run(chunk: typeof rows): Promise<void> {
    if (chunk.length === 0) return;
    batches += 1;
    try {
      const res = await embedBatch(
        chunk.map((r) => r.text),
        clientOpts
      );
      for (let i = 0; i < chunk.length; i += 1) {
        embedded.push({
          id: chunk[i]!.id,
          vector: res.vectors[i]!,
          hash: chunk[i]!.hash,
        });
      }
      promptTokens += res.usage.promptTokens;
      estimatedCostUsd += res.usage.estimatedCostUsd;
    } catch (err) {
      const msg =
        err instanceof EmbeddingError
          ? `${err.kind}: ${err.message}`
          : (err as Error).message;
      onLog(
        `[kol-embed] batch size=${chunk.length} failed: ${msg.slice(0, 200)}`
      );
      // Decide whether to halve or give up.
      if (chunk.length === 1) {
        failedIds.push(chunk[0]!.id);
        return;
      }
      const next =
        FALLBACK_BATCH_SIZES.find((sz) => sz < chunk.length) ?? 1;
      for (let i = 0; i < chunk.length; i += next) {
        await run(chunk.slice(i, i + next));
      }
    }
  }

  await run(rows);
  return { embedded, failedIds, promptTokens, estimatedCostUsd, batches };
}

export interface KolBackfillOpts {
  /** Override default batch size (mainly for tests). */
  batchSize?: number;
  /** Embedding client options (fetchImpl override for tests, etc.). */
  client?: EmbeddingClientOpts;
  /** Tenant filter — when provided only this tenant's rows are scanned. */
  tenantId?: string;
  /** Logger; defaults to `console.log`. */
  logger?: (msg: string) => void;
  /** Source label for event_log emission (audit lock acceptance —
   *  emit `embedding.invoked` per batch with source breakdown). */
  source?: EmbeddingInvokedSource;
  /** Disable the event_log emit entirely (used by tests where the
   *  prisma mock doesn't carry an `eventLog.create` method). */
  emitEvent?: boolean;
}

/**
 * Walk every KOL whose embedding is missing or whose source-text hash
 * has drifted, and bring them up-to-date. Used by the one-time backfill
 * script (scripts/kol-embed-backfill.ts) and by the B6 cron hook
 * (called with a narrow id list via `embedKolsForIds`).
 */
export async function embedAllKols(
  prisma: PrismaClient,
  opts: KolBackfillOpts = {}
): Promise<EmbedRunStats> {
  const stats = emptyStats();
  const log = opts.logger ?? ((m: string) => console.log(m));
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  // BL-034 F004: switch from string-concat raw-SQL to Prisma.sql tagged
  // template + assertUuid() entry guard so caller-supplied tenantId can
  // never become a SQL injection vector even if upstream validation
  // breaks. Also adds the `deleted_at IS NULL` filter so soft-deleted KOL
  // rows do not consume embedding quota.
  let tenantSql: Prisma.Sql;
  if (opts.tenantId) {
    assertUuid(opts.tenantId, "tenantId");
    tenantSql = Prisma.sql`WHERE tenant_id = ${opts.tenantId}::uuid AND deleted_at IS NULL`;
  } else {
    tenantSql = Prisma.sql`WHERE deleted_at IS NULL`;
  }

  // We pull the whole candidate set via raw SQL in a single pass so the
  // hash compare happens client-side (cheap, ~3K rows). For prod scale
  // (~100K) this would chunk by created_at; not needed yet.
  const rows = await prisma.$queryRaw<KolRowForEmbed[]>(Prisma.sql`
    SELECT id, display_name, bio, categories, tags, country_code, language,
           embedding_text_hash,
           (embedding IS NULL) AS needs_init
    FROM "kol"
    ${tenantSql}
  `);
  stats.scanned = rows.length;

  const { stale, skipped } = pickStaleKol(rows);
  stats.skipped = skipped;
  if (stale.length === 0) return stats;

  for (let i = 0; i < stale.length; i += batchSize) {
    if (i > 0) await sleep(INTER_BATCH_THROTTLE_MS);
    const chunk = stale.slice(i, i + batchSize);
    const result = await sendBatchWithFallback(chunk, opts.client ?? {}, log);
    stats.batches += result.batches;
    stats.promptTokens += result.promptTokens;
    stats.estimatedCostUsd += result.estimatedCostUsd;
    stats.failed += result.failedIds.length;

    // Persist successful rows. A `for ... of` over $executeRaw keeps it
    // simple; ~3K rows finishes in seconds. We do not parallelize to
    // avoid overwhelming the connection pool.
    for (const row of result.embedded) {
      try {
        await prisma.$executeRaw(
          updateKolEmbeddingSql(row.id, row.vector, row.hash)
        );
        stats.embedded += 1;
      } catch (err) {
        log(
          `[kol-embed] persist failed for ${row.id}: ${(err as Error).message}`
        );
        stats.failed += 1;
      }
    }
  }

  if (opts.emitEvent !== false) {
    await logEmbeddingInvoked(
      prisma,
      opts.source ?? "one-time-backfill",
      stats
    );
  }
  return stats;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * B6 cron hook entry. Given a narrow id list (the rows the daily sync
 * just inserted/updated), embed only those whose source text changed.
 */
export async function embedKolsForIds(
  prisma: PrismaClient,
  ids: readonly string[],
  opts: KolBackfillOpts = {}
): Promise<EmbedRunStats> {
  const stats = emptyStats();
  if (ids.length === 0) return stats;

  const log = opts.logger ?? ((m: string) => console.log(m));
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  // BL-034 F004: convert to Prisma.sql tagged template (zero raw-SQL
  // unsafe paths in this module) and add the soft-delete filter so we
  // never re-embed a row marked deleted.
  const rows = await prisma.$queryRaw<KolRowForEmbed[]>(Prisma.sql`
    SELECT id, display_name, bio, categories, tags, country_code, language,
           embedding_text_hash,
           (embedding IS NULL) AS needs_init
    FROM "kol"
    WHERE id = ANY(${ids}::uuid[])
      AND deleted_at IS NULL
  `);
  stats.scanned = rows.length;

  const { stale, skipped } = pickStaleKol(rows);
  stats.skipped = skipped;

  for (let i = 0; i < stale.length; i += batchSize) {
    if (i > 0) await sleep(INTER_BATCH_THROTTLE_MS);
    const chunk = stale.slice(i, i + batchSize);
    const result = await sendBatchWithFallback(chunk, opts.client ?? {}, log);
    stats.batches += result.batches;
    stats.promptTokens += result.promptTokens;
    stats.estimatedCostUsd += result.estimatedCostUsd;
    stats.failed += result.failedIds.length;
    for (const row of result.embedded) {
      try {
        await prisma.$executeRaw(
          updateKolEmbeddingSql(row.id, row.vector, row.hash)
        );
        stats.embedded += 1;
      } catch (err) {
        log(
          `[kol-embed] persist failed for ${row.id}: ${(err as Error).message}`
        );
        stats.failed += 1;
      }
    }
  }

  if (opts.emitEvent !== false) {
    await logEmbeddingInvoked(
      prisma,
      opts.source ?? "b6-daily-hook",
      stats
    );
  }
  return stats;
}

/** Same shape for Product table — used by F002 just-in-time embed. */
export async function embedProductIfStale(
  prisma: PrismaClient,
  productId: string,
  opts: KolBackfillOpts = {}
): Promise<EmbedRunStats> {
  const stats = emptyStats();
  const log = opts.logger ?? ((m: string) => console.log(m));

  // BL-034 F004: tagged-template form so the module is free of unsafe
  // raw-SQL paths (audit hardening).
  const rows = await prisma.$queryRaw<ProductRowForEmbed[]>(Prisma.sql`
    SELECT id, name, category, target_audience, unique_selling_points,
           embedding_text_hash,
           (embedding IS NULL) AS needs_init
    FROM "product"
    WHERE id = ${productId}
  `);
  stats.scanned = rows.length;

  const { stale, skipped } = pickStaleProduct(rows);
  stats.skipped = skipped;
  if (stale.length === 0) return stats;

  const result = await sendBatchWithFallback(stale, opts.client ?? {}, log);
  stats.batches += result.batches;
  stats.promptTokens += result.promptTokens;
  stats.estimatedCostUsd += result.estimatedCostUsd;
  stats.failed += result.failedIds.length;

  for (const row of result.embedded) {
    try {
      await prisma.$executeRaw(
        updateProductEmbeddingSql(row.id, row.vector, row.hash)
      );
      stats.embedded += 1;
    } catch (err) {
      log(
        `[product-embed] persist failed for ${row.id}: ${(err as Error).message}`
      );
      stats.failed += 1;
    }
  }

  if (opts.emitEvent !== false) {
    await logEmbeddingInvoked(
      prisma,
      opts.source ?? "product-jit",
      stats,
      productId
    );
  }
  return stats;
}
