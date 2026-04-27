-- MVP-kol-seed-redo F003 · Add Kol.metadata JSONB column.
--
-- The YouTube seed (scripts/import-kol-from-youtube.ts) writes
-- per-row provenance into this column so a single one-shot SQL
-- statement can retire the demo seed when the crawler team's real
-- dataset lands (BL-012, ~2026-06-25):
--
--   DELETE FROM kol WHERE metadata->>'is_demo' = 'true';
--
-- The B5-kol-data-enrichment batch will later promote
-- metadata.youtube.videoCount / totalViewCount / channelCreatedAt /
-- bannerUrl into proper columns; until then we keep them nested in
-- this JSONB so we don't have to re-fetch from the YouTube API.
--
-- Additive migration — no data backfill, no breaking changes. All
-- existing rows (B0 demo + BM1 enriched seed) get NULL.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "kol_metadata_is_demo_idx";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "metadata";

ALTER TABLE "kol" ADD COLUMN "metadata" JSONB;

-- Partial index targeting the cleanup query specifically. Stays small
-- (only rows with metadata IS NOT NULL contribute) and supports the
-- BL-012 retirement DELETE in one bitmap scan.
CREATE INDEX "kol_metadata_is_demo_idx"
  ON "kol" ((metadata->>'is_demo'))
  WHERE metadata IS NOT NULL;
