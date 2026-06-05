-- BL-084-F003 · kol_campaign suggestion lifecycle (ADR-016).
--
-- The AI Match Panel (BL-084) turns /match?campaignId=X into a 3-column
-- workbench: 推荐池 (suggested) / 已接受 (accepted) / 候补池 (swap_pool).
-- A KOL's column is driven by a new `suggestion_status` enum-by-convention
-- column on the existing kol_campaign join table (data model A — reuse,
-- no new table).
--
-- Columns added (additive, all nullable):
--   suggestion_status VARCHAR(20) — suggested | accepted | skipped | swap_pool
--   suggested_at      TIMESTAMPTZ — when the AI surfaced the row (NULL legacy)
--   decided_at        TIMESTAMPTZ — when the marketer decided (backfill=created_at)
--
-- NOTE: match_score already exists on kol_campaign (BM1-F001 INT column) —
-- it is reused as the cosine score snapshot, so this migration does NOT
-- re-add it (spec §F003 listed 4 fields but match_score is pre-existing).
--
-- Index:
--   kol_campaign_suggestion_status_idx ON (campaign_id, suggestion_status)
--   accelerates the per-column query the 3-column panel issues.
--
-- Backfill (spec §2.3 不变量 #3): every pre-BL-084 row predates the
-- lifecycle and represents a KOL already attached to the campaign — map
-- those to 'accepted' so the AcceptedKolsPanel (BM1 behaviour) keeps
-- showing them. decided_at backfills to created_at. The backfill is
-- recorded as a platform-level audit_log row carrying the affected count.
--
-- Idempotent (IF NOT EXISTS) so a re-apply on prod (per §5: low-peak
-- deploy with retry safety) is a no-op.
--
-- ============================================================
-- ROLLBACK:
--   DROP INDEX IF EXISTS "kol_campaign_suggestion_status_idx";
--   ALTER TABLE "kol_campaign"
--     DROP COLUMN IF EXISTS "suggestion_status",
--     DROP COLUMN IF EXISTS "suggested_at",
--     DROP COLUMN IF EXISTS "decided_at";
--   -- (match_score is NOT dropped — it predates this migration.)
-- ============================================================

ALTER TABLE "kol_campaign"
  ADD COLUMN IF NOT EXISTS "suggestion_status" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "suggested_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "decided_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "kol_campaign_suggestion_status_idx"
  ON "kol_campaign" ("campaign_id", "suggestion_status");

-- Backfill legacy rows → 'accepted' + decided_at = created_at, and write
-- a single platform-level audit_log entry with the affected row count.
WITH updated AS (
  UPDATE "kol_campaign"
  SET "suggestion_status" = 'accepted',
      "decided_at" = COALESCE("decided_at", "created_at")
  WHERE "suggestion_status" IS NULL
  RETURNING 1
)
INSERT INTO "audit_log"
  ("tenant_id", "actor_user_id", "action", "resource_type", "resource_id", "payload")
SELECT
  NULL,
  NULL,
  'migration.kol_campaign_suggestion_status_backfill',
  'kol_campaign',
  NULL,
  jsonb_build_object(
    'backfilled_rows', (SELECT count(*) FROM updated),
    'set_suggestion_status', 'accepted',
    'migration', '20260605160000_bl_084_add_kol_campaign_suggestion_status'
  );
