-- BL-081-F002 · kol.country_enrichment_attempted_at — one-shot enrichment
-- attempt marker that stops the silent LLM retry storm (root cause R3).
--
-- Background: the daily country-enrichment stage filtered KOLs purely on
-- `country_code IS NULL OR language IS NULL`. When the LLM returned a
-- null country (≈84% of attempts), nothing was written, so the same KOL
-- was re-scanned every single day — ~500 LLM calls/day, ~97% of them
-- wasted re-attempts. This column records WHEN a KOL was last attempted
-- (regardless of success), so F003's reworked WHERE can skip KOLs that
-- have already been tried and only re-attempt when fresher source data
-- arrives (last_synced_at > country_enrichment_attempted_at).
--
-- Type choice:
--   country_enrichment_attempted_at TIMESTAMPTZ — matches the schema's
--     @db.Timestamptz convention (created_at / last_synced_at / etc.).
--
-- Additive + safe:
--   - Nullable, no DEFAULT, no backfill at apply time. The 2081 existing
--     country_code-NULL rows stay NULL ("never attempted") until F005's
--     one-shot backfill stamps them = NOW() to halt the retry storm.
--   - Does NOT touch the existing 90 rows that already have country_code;
--     the new column is independent of the country_code write path
--     (data-integrity invariant §2.3 #1).
--   - RLS unchanged — the column lives on the already-RLS-protected kol
--     table and inherits its tenant_id isolation policy.
--
-- Index:
--   kol_tenant_country_attempted_idx (tenant_id, country_enrichment_attempted_at)
--   — drives F003's tenant-scoped enrichment WHERE scan over the marker.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "kol_tenant_country_attempted_idx";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "country_enrichment_attempted_at";

ALTER TABLE "kol"
  ADD COLUMN "country_enrichment_attempted_at" TIMESTAMPTZ;

CREATE INDEX "kol_tenant_country_attempted_idx"
  ON "kol" ("tenant_id", "country_enrichment_attempted_at");
