-- BL-035 F009: per-column indexes on kol_campaign.kol_id and tenant_id.
--
-- Audit DB-H5/H6 — kol_campaign was missing standalone indexes for
-- kol_id and tenant_id, so:
--   - "show every campaign that featured KOL X" (CRM detail page)
--     fell back to a seq scan + filter
--   - tenant-scoped read joins from RLS (`current_setting(app.tenant_id)`
--     comparison) had no covering index
-- The composite (tenantId, campaignId, status) index already exists, but
-- it cannot serve queries that lead with kol_id, and Postgres planners
-- prefer per-FK indexes when the join key is the leading column.
--
-- IF NOT EXISTS makes the migration idempotent so an ops-driven CONCURRENT
-- pre-deploy build is also safe (kol_campaign on prod has < 10K rows
-- today; the brief AccessExclusiveLock from a regular CREATE INDEX is
-- acceptable inside the migrate-deploy window). Larger tables ( > 50K
-- rows) should pre-build with `CREATE INDEX CONCURRENTLY` outside the
-- migration; this statement then no-ops.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS kol_campaign_kol_id_idx;
--   DROP INDEX IF EXISTS kol_campaign_tenant_id_idx;

CREATE INDEX IF NOT EXISTS kol_campaign_kol_id_idx
  ON "kol_campaign" ("kol_id");

CREATE INDEX IF NOT EXISTS kol_campaign_tenant_id_idx
  ON "kol_campaign" ("tenant_id");
