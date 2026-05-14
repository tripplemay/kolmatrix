-- BL-066-F004: add kol_campaign.source so we can distinguish AI-recommended
-- accepts ("ai_smart_match") from legacy manual adds and CSV imports.
-- Default is "manual" so all pre-existing rows (BM2-F005 era + CSV import
-- path) keep a stable provenance. The AcceptedKolsPanel rebuild in F006
-- groups by this column to show a "source" chip per KOL.
--
-- 20-char varchar mirrors KOL.email_source style (line 186 of schema.prisma).
-- NOT NULL with default works on existing rows (Postgres backfills in a
-- single pass). kol_campaign has ~10K rows on prod so the table rewrite
-- finishes in < 1s under the migrate-deploy window's brief lock.
--
-- ROLLBACK:
--   ALTER TABLE "kol_campaign" DROP COLUMN "source";

ALTER TABLE "kol_campaign"
  ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'manual';
