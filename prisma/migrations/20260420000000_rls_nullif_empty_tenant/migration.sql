-- BI1-F008 · RLS NULLIF empty-string GUC fix
--
-- The original init migration (20260418000000_init) wrote:
--   tenant_id = current_setting('app.tenant_id', true)::uuid
--
-- `current_setting(setting, true)` returns one of three values for
-- a custom GUC:
--   * NULL   — setting has never been touched in this session
--   * ''     — setting was previously SET (even LOCAL) and the tx ended
--   * <val>  — a SET LOCAL is currently active
--
-- Casting '' → uuid raises "invalid input syntax for type uuid". PG
-- does NOT short-circuit OR across cast exceptions, so the
-- `user_isolation` policy's admin-bypass branch (`is_platform_admin
-- = true`) never gets a chance to succeed once the session has seen
-- even a single SET LOCAL on app.tenant_id. Reality under Prisma's
-- pg pool: the first request through a connection is fine, every
-- subsequent one on that same pooled connection (after any withTenant
-- call) throws — which is exactly the flaky CallbackRouteError
-- observed in F008 Marketer E2E tests.
--
-- Fix: wrap `current_setting(...)` with `NULLIF(..., '')` so the
-- empty-string branch degrades to NULL (and `tenant_id = NULL` is
-- NULL → filtered / default-deny), instead of throwing.
--
-- Planner decision: BI1-f008-rls-nullif-fix #方案:A (user-confirmed
-- 2026-04-19). See docs/specs/BI1-f008-rls-nullif-fix.md.

DROP POLICY IF EXISTS user_isolation ON "user";
CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_platform_admin', true)::bool = true
  );

DROP POLICY IF EXISTS tenant_isolation ON "kol";
CREATE POLICY tenant_isolation ON "kol"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON "campaign";
CREATE POLICY tenant_isolation ON "campaign"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON "kol_campaign";
CREATE POLICY tenant_isolation ON "kol_campaign"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON "email_template";
CREATE POLICY tenant_isolation ON "email_template"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation ON "email_log";
CREATE POLICY tenant_isolation ON "email_log"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ROLLBACK: restore original un-NULLIF'd USING clauses
--
-- DROP POLICY IF EXISTS tenant_isolation ON "email_log";
-- DROP POLICY IF EXISTS tenant_isolation ON "email_template";
-- DROP POLICY IF EXISTS tenant_isolation ON "kol_campaign";
-- DROP POLICY IF EXISTS tenant_isolation ON "campaign";
-- DROP POLICY IF EXISTS tenant_isolation ON "kol";
-- DROP POLICY IF EXISTS user_isolation ON "user";
--
-- CREATE POLICY user_isolation ON "user"
--   USING (
--     tenant_id = current_setting('app.tenant_id', true)::uuid
--     OR current_setting('app.is_platform_admin', true)::bool = true
--   );
-- CREATE POLICY tenant_isolation ON "kol"
--   USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- CREATE POLICY tenant_isolation ON "campaign"
--   USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- CREATE POLICY tenant_isolation ON "kol_campaign"
--   USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- CREATE POLICY tenant_isolation ON "email_template"
--   USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- CREATE POLICY tenant_isolation ON "email_log"
--   USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
