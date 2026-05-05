-- BL-034 F008: extend the NULLIF guard to `app.is_platform_admin`.
--
-- Sister fix to 20260420000000_rls_nullif_empty_tenant, which only
-- wrapped `app.tenant_id`. The same `current_setting(setting, true)`
-- behavior applies to `app.is_platform_admin`:
--
--   * NULL   — never touched in this session
--   * ''     — touched in a prior tx; current tx has no SET LOCAL
--   * <val>  — SET LOCAL active right now
--
-- Casting the empty string to `bool` raises:
--   "invalid input syntax for type boolean: """
-- which propagates out of the `user_isolation` policy USING clause and
-- breaks any subsequent tx on the same pooled connection that touches
-- the `user` table — the same flaky failure shape as BI1-F008. The
-- only reason prod has not tripped on this yet is `withPlatformAdmin`
-- being a niche path (login flow), but any refactor mixing
-- withPlatformAdmin with regular withTenant on the same connection
-- would surface the bug.
--
-- Wrap with NULLIF(..., '') so the empty branch degrades to NULL → the
-- `OR ... = true` clause evaluates to NULL → the policy falls through
-- to the tenant-id branch. No behavioral change for the legitimate
-- `app.is_platform_admin = 'true'` path.
--
-- Pattern parity with BL-020 F006 CSP enforce: 1-week staging
-- observation window before prod redeploy (spec §F008 + §6.1 #4).
--
-- ROLLBACK: restore the un-NULLIF'd boolean cast.
--   DROP POLICY IF EXISTS "user_isolation" ON "user";
--   CREATE POLICY "user_isolation" ON "user"
--     USING (
--       tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
--       OR current_setting('app.is_platform_admin', true)::bool = true
--     );

DROP POLICY IF EXISTS "user_isolation" ON "user";
CREATE POLICY "user_isolation" ON "user"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR NULLIF(current_setting('app.is_platform_admin', true), '')::bool = true
  );
