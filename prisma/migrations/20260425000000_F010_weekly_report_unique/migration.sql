-- BM2-F010 · WeeklyReport upsert key (per Planner adjudication §13 #I:B + #I.1)
--
-- Adds UNIQUE (tenant_id, week_start, week_end, locale) so the
-- "Generate Weekly Report" Server Action can upsert deterministically:
-- a re-generation overwrites contentMd / summaryJson and resets the
-- share token (so old share URLs do not surface stale content).
--
-- prod weekly_report table is empty at the time of this migration
-- (F001 created the table 2026-04-24, no rows have been written yet),
-- so dup-row risk is zero.

ALTER TABLE "weekly_report"
  ADD CONSTRAINT "uq_weekly_report_tenant_week_locale"
  UNIQUE ("tenant_id", "week_start", "week_end", "locale");

-- ROLLBACK:
-- ALTER TABLE "weekly_report" DROP CONSTRAINT "uq_weekly_report_tenant_week_locale";
