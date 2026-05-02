-- BL-025-F001 · Migrate email_template rows into the unified asset table
--
-- ADR-011 §Implementation Notes 1: Step 1 (data copy) without dropping
-- email_template. The cleanup migration that drops email_template runs
-- after the dual-write window in BL-025 F006 settles (~1-2 weeks; not
-- in this batch).
--
-- Source mapping:
--   tenant_id IS NULL                 → source = system_seed
--   type = 'system' (defensive)       → source = system_seed
--   else                              → source = user_created
--
-- email_template has no ai_generated marker — those live in
-- Product.aiAssets JSON until F003 starts populating asset directly,
-- so no rows in this snapshot map to ai_generated.
--
-- Idempotency guard via metadata.migrated_from_email_template_id:
-- re-running the migration (e.g. partial-failure recovery, manual
-- re-deploy) is a no-op for rows already copied. The DO block at the
-- bottom asserts row counts match so a silent partial copy fails the
-- migration loudly.

INSERT INTO "asset" (
  id, tenant_id, product_id, type, name, content, source,
  parent_id, status, metadata, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  et.tenant_id,
  NULL,
  'email'::"AssetType",
  et.name,
  jsonb_build_object(
    'subject', et.subject,
    'body', et.body,
    'locale', et.locale,
    'variables', COALESCE(et.variables, '[]'::jsonb)
  ),
  CASE
    WHEN et.tenant_id IS NULL THEN 'system_seed'::"AssetSource"
    WHEN et.type = 'system' THEN 'system_seed'::"AssetSource"
    ELSE 'user_created'::"AssetSource"
  END,
  NULL,
  'published'::"AssetStatus",
  jsonb_build_object(
    'migrated_from_email_template_id', et.id::text,
    'migrated_at', now()
  ),
  NULL,
  et.created_at,
  et.updated_at
FROM "email_template" et
WHERE NOT EXISTS (
  SELECT 1 FROM "asset" a
  WHERE a.metadata->>'migrated_from_email_template_id' = et.id::text
);

-- Verify migration count parity. asset (type=email, migrated rows only)
-- must equal email_template count. If F001 ever lands ahead of this
-- migration with new email assets created via createAsset, those would
-- not carry the migrated_from_email_template_id tag and the inequality
-- would still hold for the migrated subset.

DO $$
DECLARE
  src_count    BIGINT;
  copied_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO src_count FROM "email_template";
  SELECT COUNT(*) INTO copied_count
    FROM "asset"
    WHERE type = 'email'
      AND metadata ? 'migrated_from_email_template_id';
  IF src_count <> copied_count THEN
    RAISE EXCEPTION
      'asset migration count mismatch: email_template=%, asset(migrated)=%',
      src_count, copied_count;
  END IF;
END $$;

-- ROLLBACK -------------------------------------------------------
-- Removes the migrated rows only (rows tagged with
-- metadata.migrated_from_email_template_id). Native Asset rows from
-- F002+ usage are untouched.
--
-- DELETE FROM "asset"
--   WHERE metadata ? 'migrated_from_email_template_id';
