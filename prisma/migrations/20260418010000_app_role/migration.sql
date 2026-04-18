-- F004: dedicated non-superuser application role so RLS is actually enforced
-- at runtime. Superuser (POSTGRES_USER) still owns the schema and runs
-- migrations / seed — superusers implicitly bypass RLS, which is exactly
-- what we want for infra tasks. The application runtime must use this
-- kolmatrix_app role, which has the base CRUD grants and nothing more,
-- so policies in the init migration actually take effect.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kolmatrix_app') THEN
    CREATE ROLE kolmatrix_app WITH LOGIN PASSWORD 'kolmatrix_app';
  END IF;
END $$;

GRANT CONNECT ON DATABASE kolmatrix TO kolmatrix_app;
GRANT USAGE ON SCHEMA public TO kolmatrix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kolmatrix_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kolmatrix_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kolmatrix_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kolmatrix_app;

-- ROLLBACK:
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kolmatrix_app;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kolmatrix_app;
-- REVOKE ALL ON SCHEMA public FROM kolmatrix_app;
-- REVOKE CONNECT ON DATABASE kolmatrix FROM kolmatrix_app;
-- DROP ROLE IF EXISTS kolmatrix_app;
