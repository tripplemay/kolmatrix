-- BL-052 F001 · KpiDailySnapshot table (Part A · BL-050 dashboard trends)
--
-- One row per (tenant_id, snapshot_date) holds the 5 KPI scalars at
-- cron time. computeKpiTrend / computeSparkline (F002) read trailing
-- N rows; UI fallback "—" + tooltip when < 7 snapshots
-- (hasEnoughData=false; D4 lock). Cron entry scripts/kpi-snapshot-daily.ts
-- (F003) chains after kol-sync:daily 08:30 BJ.
--
-- RLS: spec §3.1 omitted RLS but every tenant-scoped table in this
-- repo enables it (audit_log / event_log / asset / weekly_report /
-- product / campaign_metric / saved_search). Following the standard
-- NULLIF policy template (framework/harness/database-patterns.md §8
-- v0.9.11) so a tenant cannot read another tenant's KPI history via
-- raw SQL paths. The kpi_daily_snapshot has no system-level rows, so
-- the IS NULL branch is defensive only (matches sibling-table shape).
--
-- ROLLBACK: apply these statements in reverse order.
--   ALTER TABLE "kpi_daily_snapshot" DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "kpi_daily_snapshot_tenant_isolation" ON "kpi_daily_snapshot";
--   REVOKE SELECT, INSERT, UPDATE ON "kpi_daily_snapshot" FROM kolmatrix_app;
--   DROP INDEX IF EXISTS "kpi_daily_snapshot_recent_idx";
--   DROP TABLE IF EXISTS "kpi_daily_snapshot";

CREATE TABLE "kpi_daily_snapshot" (
  "tenant_id" UUID NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "kol_count" INTEGER NOT NULL,
  "active_campaigns" INTEGER NOT NULL,
  "emails_sent_7d" INTEGER NOT NULL,
  "product_count" INTEGER NOT NULL,
  "avg_value_score" DECIMAL(5, 2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "kpi_daily_snapshot_pkey" PRIMARY KEY ("tenant_id", "snapshot_date"),
  CONSTRAINT "kpi_daily_snapshot_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "kpi_daily_snapshot_recent_idx"
  ON "kpi_daily_snapshot" ("tenant_id", "snapshot_date" DESC);

GRANT SELECT, INSERT, UPDATE ON "kpi_daily_snapshot" TO kolmatrix_app;

ALTER TABLE "kpi_daily_snapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kpi_daily_snapshot_tenant_isolation" ON "kpi_daily_snapshot";
CREATE POLICY "kpi_daily_snapshot_tenant_isolation" ON "kpi_daily_snapshot"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
