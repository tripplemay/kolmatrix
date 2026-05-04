-- F001: decouple application role password from migration history.
-- The original 20260418010000_app_role/migration.sql baked
-- 'kolmatrix_app' literal password into git, leaking the runtime
-- credential. New deploys inject the password via deploy-prod.sh
-- using the KOLMATRIX_APP_PASSWORD env var (random per environment).
--
-- This migration only rotates the password when a `kolmatrix.app_role_password`
-- GUC is set on the running session — typically `psql -v` from a deploy
-- script. During `prisma migrate deploy` the GUC is not set, so this
-- migration is a no-op there; the actual rotation is performed by
-- scripts/deploy-prod.sh's ALTER ROLE step (idempotent).

DO $$
BEGIN
  IF current_setting('kolmatrix.app_role_password', true) IS NOT NULL
     AND current_setting('kolmatrix.app_role_password', true) != ''
  THEN
    EXECUTE format(
      'ALTER ROLE kolmatrix_app WITH PASSWORD %L',
      current_setting('kolmatrix.app_role_password')
    );
  END IF;
END $$;
