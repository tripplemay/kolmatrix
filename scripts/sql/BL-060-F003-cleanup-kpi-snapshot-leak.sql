-- BL-060-F003 · Clean kpi_daily_snapshot rows polluted by the
-- pre-filter `tx.kol.count` / `tx.kol.aggregate` calls in
-- src/lib/dashboard/kpi-snapshot.ts (2 sites). Until F003 of this
-- batch added `deletedAt: null` filters, the daily cron persisted a
-- `kol_count` that included BL-059 F003's 2584 tombstoned
-- youtube-api-daily rows — every snapshot since the soft delete
-- (5/8 onwards) shows an inflated trend point.
--
-- Strategy: delete the offending dates per-tenant. The deletion is
-- gated on `kol_count > active_gaming_count` so tenants whose
-- snapshot already happened to be correct are untouched. Next cron
-- run (02:00 UTC = 北京 10:00 the following day) re-writes a fresh
-- row at the composite PK (tenantId, snapshotDate).
--
-- Verify post-COMMIT (spec §6 #6):
--   1. SELECT snapshot_date, kol_count
--      FROM kpi_daily_snapshot
--      WHERE snapshot_date >= '2026-05-08'
--      ORDER BY snapshot_date DESC;
--      → expect 0 rows whose kol_count > active_gaming_count
--   2. After the next 02:00 UTC cron, the row for that day shows
--      kol_count = SELECT COUNT(*) FROM kol
--                  WHERE deleted_at IS NULL AND is_gaming = true.

BEGIN;

DELETE FROM kpi_daily_snapshot s
WHERE s.snapshot_date >= '2026-05-08'
  AND s.kol_count > (
    SELECT COUNT(*)
    FROM kol k
    WHERE k.tenant_id = s.tenant_id
      AND k.deleted_at IS NULL
      AND k.is_gaming = true
  );

COMMIT;
