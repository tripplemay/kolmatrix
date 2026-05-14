-- BL-066-F006: backfill kol_campaign.source 'manual' → 'manual_legacy' so the
-- AcceptedKolsPanel source-chip filter (source IN ('ai_smart_match',
-- 'csv_import', 'manual_legacy')) covers pre-F004 rows from the BM2-F005 +
-- BL-063 era. F004's prior migration shipped with DEFAULT 'manual' which
-- was a thinko — spec §F006 acceptance locks 'manual_legacy' as the legacy
-- bucket label. We deliberately leave the column DEFAULT as 'manual' so any
-- future writer that forgets to set source explicitly produces a row that
-- the filter hides (dev signal — spec lock implies every writer sets source).
--
-- Scope: small (kol_campaign has ~10K rows on prod); single UPDATE finishes
-- in <1s under the migrate-deploy window.
--
-- F009 staging deploy step verifies audit_log captures the backfill row_count
-- alongside the BL-048 valueScore recompute audit (same pattern).
--
-- ROLLBACK:
--   UPDATE "kol_campaign" SET "source" = 'manual' WHERE "source" = 'manual_legacy';

UPDATE "kol_campaign" SET "source" = 'manual_legacy' WHERE "source" = 'manual';
