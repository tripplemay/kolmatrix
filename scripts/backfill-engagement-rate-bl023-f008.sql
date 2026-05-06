-- BL-023-F008 · One-shot backfill: convert pre-existing engagement_rate
-- fraction values to percentage values.
--
-- Context: BIx F004 P4 (kol-sync-daily.ts engagement batch, deployed
-- 2026-05-01) wrote `totalEngagements / totalViews` (a fraction in
-- [0, 1]) into `kol.engagement_rate`. The Decimal(5,2) column rounded
-- those to 2 decimals (e.g. real 4.2% → fraction 0.042 → stored 0.04),
-- and the rest of the app (UI cards, filters, seed, BL-023 value-score
-- buckets) treats the column as a percentage. As of 2026-05-06 this
-- affected ~137 prod KOLs.
--
-- BL-023 changed `computeEngagementRate` to return a percentage so all
-- *future* writes are correct. This script fixes the data already in
-- the table by multiplying every value in [0, 1) by 100. Seed data
-- (5.8, 8.2, ...) is all > 1 and is therefore untouched.
--
-- Idempotent: re-running is safe — once a row is multiplied to ≥ 1 it
-- no longer matches the WHERE clause.
--
-- Run on prod (sudo psql peer auth, per environment.md §Postgres):
--   ssh tripplezhou@34.180.93.185
--   sudo -u postgres psql -d kolmatrix -f /opt/kolmatrix/scripts/backfill-engagement-rate-bl023-f008.sql
--
-- Run on staging (after BL-023 deploy):
--   ssh tripplezhou@34.180.93.185
--   sudo -u postgres psql -d kolmatrix_staging -f /opt/kolmatrix-staging/scripts/backfill-engagement-rate-bl023-f008.sql

\echo '--- Pre-backfill counts ---'
SELECT
  count(*) FILTER (WHERE engagement_rate IS NULL) AS null_count,
  count(*) FILTER (WHERE engagement_rate = 0) AS zero_count,
  count(*) FILTER (WHERE engagement_rate > 0 AND engagement_rate < 1) AS fraction_count,
  count(*) FILTER (WHERE engagement_rate >= 1) AS percent_count
FROM kol;

\echo '--- Backfill (multiplies fractions [0, 1) by 100) ---'
UPDATE kol
SET engagement_rate = engagement_rate * 100
WHERE engagement_rate > 0
  AND engagement_rate < 1;

\echo '--- Post-backfill counts ---'
SELECT
  count(*) FILTER (WHERE engagement_rate IS NULL) AS null_count,
  count(*) FILTER (WHERE engagement_rate = 0) AS zero_count,
  count(*) FILTER (WHERE engagement_rate > 0 AND engagement_rate < 1) AS fraction_count_should_be_zero,
  count(*) FILTER (WHERE engagement_rate >= 1) AS percent_count
FROM kol;
