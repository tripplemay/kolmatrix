-- B7a-F001 · pgvector + bge-m3 embedding columns + IVFFlat indexes.
--
-- Pre-impl audit lock (2026-04-28):
--   #1:A apt postgresql-17-pgvector + restart (user prerequisite, done)
--   #2:A Prisma Unsupported("vector(1024)")
--   #3:A IVFFlat lists=4 (N=3,303 staging / 768 prod, well below 10K threshold)
--   #10:A single migration (CREATE EXTENSION + 2 ALTER + 2 INDEX, atomic in tx)
--
-- Acceptance: pgvector extension enabled + Kol/Product embedding columns +
-- IVFFlat indexes ready for cosine similarity (`<=>` operator).

-- 1. Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding columns (vector(1024) nullable, matches bge-m3 dims)
ALTER TABLE "kol" ADD COLUMN "embedding" vector(1024);
ALTER TABLE "product" ADD COLUMN "embedding" vector(1024);

-- 3. Track per-row hash of fields used to derive embedding text (B7a-F001 #6:B').
--    NULL means "never embedded yet"; non-NULL means "this hash matches the
--    current embedding". When a B6 sync produces a row whose hash differs,
--    the embedding hook re-embeds and updates the hash.
ALTER TABLE "kol" ADD COLUMN "embedding_text_hash" text;
ALTER TABLE "product" ADD COLUMN "embedding_text_hash" text;

-- 4. IVFFlat indexes (cosine ops). lists=4 is right-sized for the current
--    KOL volume (~3,300 staging) per pgvector guidance N >= lists * 32.
--    When KOL count exceeds 10K, plan a B8/Post-MVP REINDEX to HNSW.
CREATE INDEX "kol_embedding_ivfflat_idx"
  ON "kol" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 4);

CREATE INDEX "product_embedding_ivfflat_idx"
  ON "product" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 4);

-- 5. ANALYZE so the planner has stats for the new columns immediately.
ANALYZE "kol";
ANALYZE "product";

-- ===================================================================
-- ROLLBACK: (database-patterns.md §3 requirement)
-- ===================================================================
-- BEGIN;
--   DROP INDEX IF EXISTS "product_embedding_ivfflat_idx";
--   DROP INDEX IF EXISTS "kol_embedding_ivfflat_idx";
--   ALTER TABLE "product" DROP COLUMN IF EXISTS "embedding_text_hash";
--   ALTER TABLE "product" DROP COLUMN IF EXISTS "embedding";
--   ALTER TABLE "kol"     DROP COLUMN IF EXISTS "embedding_text_hash";
--   ALTER TABLE "kol"     DROP COLUMN IF EXISTS "embedding";
--   DROP EXTENSION IF EXISTS vector;
-- COMMIT;
--
-- Notes on rollback:
-- 1) DROP EXTENSION CASCADE would also drop the columns, but the explicit
--    DROP COLUMN above is safer if other migrations later add vector
--    columns we don't want to nuke.
-- 2) RLS policies do NOT need to change; the new columns inherit the
--    existing tenant_id-based RLS (kol/product already protected).
