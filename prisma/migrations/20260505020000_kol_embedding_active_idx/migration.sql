-- BL-034 F004: partial index for active KOL embedding lookups.
--
-- Skip soft-deleted rows + non-embedded rows so the cosine top-k path
-- (kol-embed.ts + sql.ts kolCosineTopKSql) and embedAllKols backfill scan
-- only the rows we actually want.
--
-- ivfflat is build-once / read-many; the table is ~3K rows today so a
-- plain (non-concurrent) CREATE INDEX on a fresh DB finishes in a few
-- hundred ms and the brief AccessExclusiveLock is acceptable inside the
-- prisma `migrate deploy` window. For prod tables that grow well past
-- ~50K rows, ops should run `CREATE INDEX CONCURRENTLY ...` against the
-- DB *before* the deploy migration so the IF NOT EXISTS clause makes
-- this migration a no-op.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS kol_embedding_active_idx;

CREATE INDEX IF NOT EXISTS kol_embedding_active_idx
  ON "kol" USING ivfflat (embedding vector_cosine_ops)
  WHERE deleted_at IS NULL
    AND embedding IS NOT NULL;
