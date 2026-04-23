-- BI4-F002 · event_log platform-level business event record
--
-- Not tenant-scoped at the RLS layer: writers are app code that logs
-- fire-and-forget events (kol.created, campaign.email_sent, etc);
-- readers are admin tooling and the future webhook dispatcher. The
-- tenant_id column is indexed for per-tenant admin queries but the
-- table carries no RLS policy (platform-level concern, like audit_log).
--
-- Indexes:
--   (tenant_id, type, created_at) — per-tenant, per-event-type timeline
--   (resource_id)                 — "all events that touched this resource"
--
-- CREATE TABLE
CREATE TABLE "event_log" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID,
    "actor_id" UUID,
    "type" VARCHAR(64) NOT NULL,
    "resource_id" VARCHAR(64),
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_log_tenant_id_type_created_at_idx" ON "event_log"("tenant_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "event_log_resource_id_idx" ON "event_log"("resource_id");

-- App-role privileges flow from ALTER DEFAULT PRIVILEGES set in
-- 20260418010000_app_role (SELECT/INSERT/UPDATE/DELETE on new tables)
-- — no per-table GRANT needed.

-- ROLLBACK:
-- DROP INDEX IF EXISTS "event_log_resource_id_idx";
-- DROP INDEX IF EXISTS "event_log_tenant_id_type_created_at_idx";
-- DROP TABLE IF EXISTS "event_log";
