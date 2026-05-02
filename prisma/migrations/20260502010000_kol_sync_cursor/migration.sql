-- BIx-mvp-polish-pass F004-P2 · `kol_sync_cursor` table
--
-- Persists `nextPageToken` for the YouTube `search.list` matrix so the
-- daily cron can rotate through pages 1 → 2 → 3 over a 6-day cycle
-- (see `src/lib/kol-sync/adapters/youtube.ts:pickDailyPage`). Without
-- this table, every cron run pulls page 1 only, missing the deeper
-- channel cohorts that PRD §10.1 (micro-influencers) targets.
--
-- Cron-level table (no tenant scope) — daily sync runs against the
-- platform's discovery surface, not against any tenant's data. Unique
-- (region, keyword) so look-ups inside the matrix walk are O(1).
--
-- Type choices:
--   id              UUID            — matches the schema's other tables
--                                     (gen_random_uuid() default).
--   region          TEXT            — ISO-3166-1 alpha-2 (CN/HK/.../IN);
--                                     no enum so adding a region is a
--                                     code change only.
--   keyword         TEXT            — pool entry from
--                                     DAILY_KEYWORD_POOL_BY_REGION;
--                                     unbounded TEXT for future
--                                     localization without migration.
--   page            SMALLINT        — current page (1 / 2 / 3); SMALLINT
--                                     is sufficient and matches BL-012
--                                     incoming crawler convention.
--   next_page_token TEXT            — opaque YouTube cursor; nullable
--                                     because page-1 calls don't have
--                                     one to begin with.
--   updated_at      TIMESTAMPTZ     — populated via Prisma @updatedAt.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "kol_sync_cursor_region_keyword_key";
--   DROP TABLE  IF EXISTS "kol_sync_cursor";

CREATE TABLE "kol_sync_cursor" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "region"          TEXT         NOT NULL,
  "keyword"         TEXT         NOT NULL,
  "page"            SMALLINT     NOT NULL DEFAULT 1,
  "next_page_token" TEXT,
  "updated_at"      TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "kol_sync_cursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kol_sync_cursor_region_keyword_key"
  ON "kol_sync_cursor" ("region", "keyword");
