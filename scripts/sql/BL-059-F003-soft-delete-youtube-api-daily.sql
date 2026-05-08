-- BL-059-F003 · Soft delete every metadata.source='youtube-api-daily'
-- KOL row + write a per-row audit_log entry capturing FK fan-out and
-- engagement signals for the 30-day rollback window (spec §3.2).
--
-- Wrap in BEGIN/COMMIT so the audit trail and the deleted_at update
-- land together. A failure mid-stream rolls both back; a partial
-- audit-without-delete (or vice versa) would defeat the audit trail.
--
-- Spec §3.2 used the legacy column name `user_id`; the actual schema
-- (BL-051a-F008) names it `actor_user_id`. Same NULL semantics — no
-- attributable actor for a bulk ops run.
--
-- Verify post-COMMIT (spec §10.2 DoD):
--   1. SELECT COUNT(*) FROM kol
--      WHERE metadata->>'source'='youtube-api-daily' AND deleted_at IS NOT NULL  -- expect 2584
--   2. SELECT COUNT(*) FROM kol
--      WHERE metadata->>'source'='youtube-api-daily' AND deleted_at IS NULL      -- expect 0
--   3. SELECT COUNT(*) FROM audit_log
--      WHERE action='kol.bulk_soft_delete' AND created_at >= '2026-05-09'        -- expect 2584
--
-- Rollback (30-day window) — see BL-059 spec §3.3:
--   UPDATE kol SET deleted_at = NULL, updated_at = now()
--   WHERE metadata->>'source'='youtube-api-daily'
--     AND deleted_at >= '2026-05-09 00:00:00'
--     AND deleted_at <= '2026-05-09 23:59:59';

BEGIN;

-- 1. Audit_log first — one row per soft-deleted KOL with FK fan-out
--    and the engagement / value_score / handle context the spec calls
--    out so a future restore can re-derive scope without a join.
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
  'kol.bulk_soft_delete',
  'kol',
  k.id::text,
  jsonb_build_object(
    'source',              'youtube-api-daily',
    'reason',              'BL-059 deprecate B6 youtube-api-daily, switch to apify-kol single source',
    'kol_campaign_count',  (SELECT COUNT(*) FROM kol_campaign WHERE kol_id = k.id),
    'email_log_count',     (SELECT COUNT(*) FROM email_log WHERE kol_id = k.id),
    'engagement_rate',     k.engagement_rate,
    'value_score',         k.value_score,
    'follower_count',      k.follower_count,
    'platform',            k.platform,
    'handle',              k.handle
  ),
  now()
FROM kol k
WHERE k.metadata->>'source' = 'youtube-api-daily'
  AND k.deleted_at IS NULL;

-- 2. Soft delete — bulk_soft_delete sets deleted_at + bumps
--    updated_at so audit_log queries by created_at line up with kol
--    rows by updated_at to within a single transaction's clock skew.
UPDATE kol
SET deleted_at = now(),
    updated_at = now()
WHERE metadata->>'source' = 'youtube-api-daily'
  AND deleted_at IS NULL;

COMMIT;
