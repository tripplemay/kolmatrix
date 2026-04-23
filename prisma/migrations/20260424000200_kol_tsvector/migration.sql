-- BI4-F005 · KOL full-text search index (tsvector)
--
-- Adds a maintained `search_vector` column on "kol" fed by a BEFORE
-- INSERT OR UPDATE trigger. Weights (per 2026-04-23 adjudication #B:A,
-- mapping to actual B0 kol columns):
--   A  display_name   — most relevant for person/channel name search
--   B  handle         — platform handle
--   C  categories     — gaming categories (array → space-joined)
--   D  bio            — long-tail match against free text
--
-- Country code is intentionally NOT indexed (#C:A): ISO 2-letter codes
-- have no meaning to the english tsvector dict; country filtering goes
-- through a separate WHERE clause.
--
-- Query path: see src/lib/search/tsvector.ts (searchKols helper uses
-- plainto_tsquery + ts_rank).

-- Add the tsvector column
ALTER TABLE "kol" ADD COLUMN "search_vector" tsvector;

-- Populate existing rows in one pass
UPDATE "kol" SET "search_vector" =
  setweight(to_tsvector('english', coalesce("display_name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("handle", '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string("categories", ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce("bio", '')), 'D');

-- GIN index for fast @@ lookup
CREATE INDEX "kol_search_vector_idx" ON "kol" USING GIN ("search_vector");

-- Trigger function: runs BEFORE INSERT OR UPDATE so every mutation
-- leaves search_vector consistent without the app layer having to know.
CREATE OR REPLACE FUNCTION kol_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."display_name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."handle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."categories", ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."bio", '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kol_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "kol"
  FOR EACH ROW
  EXECUTE FUNCTION kol_search_vector_update();

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS kol_search_vector_trigger ON "kol";
-- DROP FUNCTION IF EXISTS kol_search_vector_update();
-- DROP INDEX IF EXISTS "kol_search_vector_idx";
-- ALTER TABLE "kol" DROP COLUMN IF EXISTS "search_vector";
