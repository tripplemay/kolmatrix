-- BL-034 F003: enable RLS on `audit_log` and `event_log`.
--
-- Both tables previously carried no RLS policy ("platform-level concern"
-- per the original 20260418000000_init + 20260424000000_event_log
-- migrations). The 2026-05-04 backend audit (CRIT-3) confirmed the
-- consequences: the audit_log read at
-- src/app/[locale]/(app)/campaigns/[id]/ai-suggestions-actions.ts:64
-- filtered only by resourceId / resourceType, so a tenant whose
-- campaignId collided with another tenant's resourceId could read the
-- other tenant's audit timeline. event_log.payload also stores KOL
-- email + outreach metadata that must not cross tenants.
--
-- Policy template per framework/harness/database-patterns.md §8 (v0.9.11):
--   USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
--
-- The `tenant_id IS NULL` branch keeps platform-level events visible to
-- every tenant — this matches existing semantics (e.g. user-login audit
-- entries written before a tenant context exists).
--
-- ROLLBACK (manual):
--   ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "audit_log_tenant_isolation" ON "audit_log";
--   ALTER TABLE "event_log" DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "event_log_tenant_isolation" ON "event_log";

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_tenant_isolation" ON "audit_log";
CREATE POLICY "audit_log_tenant_isolation" ON "audit_log"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

ALTER TABLE "event_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_log_tenant_isolation" ON "event_log";
CREATE POLICY "event_log_tenant_isolation" ON "event_log"
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
