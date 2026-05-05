/**
 * B7a-F001 · Raw SQL helpers for embedding columns.
 *
 * Prisma exposes `embedding` as `Unsupported("vector(1024)")` so all
 * reads/writes go through `$queryRaw` / `$executeRaw`. Centralising the
 * SQL here keeps the cast-to-vector / pgvector-operator quirks in one
 * file (callers don't need to know that "[1.0, 2.0, ...]"::vector is
 * the literal form pgvector accepts).
 *
 * Pre-impl audit lock #2:A — see
 * docs/specs/B7a-f001-embedding-preimpl-audit.md §9 #2.
 */
import { Prisma } from "@prisma/client";

import { EMBEDDING_DIMS } from "./types";

/**
 * Format a number[] as the pgvector literal form: `[1.0,2.0,...]`.
 *
 * Why we hand-format instead of letting pgvector parse arbitrary
 * arrays: passing the array through Prisma `Prisma.sql` then casting
 * with `::vector(N)` gets ambiguous when the driver maps JS arrays to
 * Postgres arrays of numeric. The literal form is unambiguous.
 */
export function vectorLiteral(v: readonly number[]): string {
  if (v.length !== EMBEDDING_DIMS) {
    throw new Error(
      `vectorLiteral: expected ${EMBEDDING_DIMS} dims, got ${v.length}`
    );
  }
  // Use parseFloat-roundtrip-safe formatting. JSON.stringify gives us
  // standard decimals; pgvector accepts that.
  return JSON.stringify(v);
}

/**
 * Build a `Prisma.sql` fragment that updates one row's embedding column
 * + its hash, used by both the one-time backfill and B6 daily hook.
 *
 * Caller is responsible for wrapping in withTenant() — the WHERE clause
 * here only narrows by primary key, RLS handles tenant isolation.
 */
export function updateKolEmbeddingSql(
  kolId: string,
  embedding: readonly number[],
  hash: string
): Prisma.Sql {
  const lit = vectorLiteral(embedding);
  return Prisma.sql`
    UPDATE "kol"
    SET "embedding" = ${lit}::vector(${Prisma.raw(String(EMBEDDING_DIMS))}),
        "embedding_text_hash" = ${hash}
    WHERE id = ${kolId}::uuid
  `;
}

export function updateProductEmbeddingSql(
  productId: string,
  embedding: readonly number[],
  hash: string
): Prisma.Sql {
  const lit = vectorLiteral(embedding);
  return Prisma.sql`
    UPDATE "product"
    SET "embedding" = ${lit}::vector(${Prisma.raw(String(EMBEDDING_DIMS))}),
        "embedding_text_hash" = ${hash}
    WHERE id = ${productId}
  `;
}

/**
 * Cosine top-k query — used by F002 Smart Match and F007 KOL similar.
 *
 * Returns rows ordered by distance ascending (closest first). `<=>` is
 * the pgvector cosine-distance operator (range [0, 2]).
 *
 * NOTE: caller must run this inside `withTenant(tenantId, tx => ...)` so
 * RLS narrows to the right tenant. We also defensively add the
 * `embedding IS NOT NULL` filter (audit lock #11:A).
 */
export interface CosineTopKArgs {
  /** Query vector (typically a Product or KOL embedding). */
  query: readonly number[];
  /** Number of rows to return. */
  limit: number;
  /** Optional: exclude this id (e.g. F007 "find similar to me, not me"). */
  excludeId?: string;
}

export function kolCosineTopKSql(args: CosineTopKArgs): Prisma.Sql {
  const lit = vectorLiteral(args.query);
  const dimsRaw = Prisma.raw(String(EMBEDDING_DIMS));

  // BL-034 F004: skip soft-deleted rows in cosine top-k. Without this
  // filter a deleted KOL still consumes recommendation slots and can be
  // surfaced by Smart Match / Find Similar paths until the partial
  // index `kol_embedding_active_idx` is repopulated.
  if (args.excludeId) {
    return Prisma.sql`
      SELECT id, ("embedding" <=> ${lit}::vector(${dimsRaw})) AS distance
      FROM "kol"
      WHERE "embedding" IS NOT NULL
        AND deleted_at IS NULL
        AND id != ${args.excludeId}::uuid
      ORDER BY distance ASC
      LIMIT ${args.limit}
    `;
  }
  return Prisma.sql`
    SELECT id, ("embedding" <=> ${lit}::vector(${dimsRaw})) AS distance
    FROM "kol"
    WHERE "embedding" IS NOT NULL
      AND deleted_at IS NULL
    ORDER BY distance ASC
    LIMIT ${args.limit}
  `;
}
