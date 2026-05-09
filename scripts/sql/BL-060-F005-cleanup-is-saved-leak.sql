-- BL-060-F005 · Clear `is_saved=true` flag from rows that BL-059 F003
-- soft-deleted but didn't reset. Prod observed 4 such rows (all
-- youtube-api-daily) on 2026-05-09; they showed up in /database
-- QuickStats `total` because the pre-fix `loadDatabaseStats` query
-- forgot `deleted_at IS NULL` (fixed in F002 of this batch). Resetting
-- `is_saved` defends against any future query that filters by
-- `is_saved=true` without also checking `deleted_at`.
--
-- Wrapped in BEGIN/COMMIT so the audit_log fan-out and the UPDATE
-- land atomically — half-applied state would leave audit rows
-- referencing a kol that was never updated, or vice versa.
--
-- Audit action `kol.bulk_unset_is_saved` mirrors the BL-051a
-- soft-delete + BL-059 F003 `kol.bulk_*` audit naming pattern.
--
-- Verify post-COMMIT (spec §3 #5):
--   1. SELECT COUNT(*) FROM kol
--      WHERE is_saved=true AND deleted_at IS NOT NULL          -- expect 0
--   2. SELECT COUNT(*) FROM audit_log
--      WHERE action='kol.bulk_unset_is_saved'
--        AND created_at >= '2026-05-09'                        -- expect 4
--   3. SELECT id, is_saved, deleted_at FROM kol
--      WHERE deleted_at IS NOT NULL AND is_saved = false
--        AND id IN (<4 ids from step 2 audit_log resource_id);
--
-- Rollback (uncommon — only run within minutes of COMMIT):
--   BEGIN;
--   UPDATE kol SET is_saved = true, updated_at = now()
--   WHERE id IN (
--     SELECT resource_id::uuid FROM audit_log
--     WHERE action='kol.bulk_unset_is_saved'
--       AND created_at >= '<COMMIT timestamp>'
--   );
--   DELETE FROM audit_log
--   WHERE action='kol.bulk_unset_is_saved'
--     AND created_at >= '<COMMIT timestamp>';
--   COMMIT;

BEGIN;

-- 1. Audit_log first — one row per affected KOL, capturing the
--    previous is_saved=true state so a future restore can recover
--    the original flag without rebuilding from logs.
INSERT INTO audit_log (
  tenant_id,
  actor_user_id,
  action,
  resource_type,
  resource_id,
  payload,
  created_at
)
SELECT
  k.tenant_id,
  NULL,
  'kol.bulk_unset_is_saved',
  'kol',
  k.id::text,
  jsonb_build_object(
    'reason',            'BL-060-F005 cleanup is_saved leak after BL-059 F003 soft delete',
    'previous_is_saved', true,
    'deleted_at',        k.deleted_at,
    'platform',          k.platform,
    'handle',            k.handle
  ),
  now()
FROM kol k
WHERE k.is_saved = true
  AND k.deleted_at IS NOT NULL;

-- 2. Reset the flag on the same row set. updated_at bumps to keep
--    the row's mtime consistent with the audit_log entry.
UPDATE kol
SET is_saved = false,
    updated_at = now()
WHERE is_saved = true
  AND deleted_at IS NOT NULL;

COMMIT;
