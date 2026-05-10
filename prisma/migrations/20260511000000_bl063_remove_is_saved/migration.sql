-- BL-063 F002 — Remove `is_saved` column from `kol`.
--
-- ADR-013 deprecates the saved/discovered split: every KOL belongs to
-- the tenant pool, full stop. The column and its index lose their
-- purpose; this migration drops both.
--
-- A backup of the `is_saved=true` rows is captured up front in case ops
-- need to roll back. The temp table only lives for the lifetime of the
-- migration session — rollback re-creates the column and re-applies
-- those id values from the backup before the temp table goes away.

-- 1. Backup ids that had is_saved=true at migration time. The temp
--    table is session-scoped; ops that needs a durable backup should
--    pg_dump the kol table BEFORE running this migration (see
--    F006 acceptance — prod ops uses pg_dump).
CREATE TEMP TABLE _bl063_is_saved_backup AS
  SELECT id, is_saved FROM "kol" WHERE is_saved = true;

-- 2. Drop the supporting index first (DROP COLUMN cascades in
--    practice, but explicit is better).
DROP INDEX IF EXISTS "kol_tenant_saved_idx";

-- 3. Drop the column itself.
ALTER TABLE "kol" DROP COLUMN "is_saved";

-- ----------------------------------------------------------------
-- ROLLBACK (manual; not auto-applied by Prisma)
-- ----------------------------------------------------------------
-- 1. ALTER TABLE "kol" ADD COLUMN "is_saved" BOOLEAN NOT NULL DEFAULT FALSE;
-- 2. -- Restore the previously-saved rows from a pre-migration pg_dump:
--    -- pg_restore --data-only --table=kol /opt/kolmatrix-backups/<dump>
--    -- or, for the in-session temp backup (only available within the
--    -- same migration transaction window):
--    UPDATE "kol" SET "is_saved" = true
--      WHERE id IN (SELECT id FROM _bl063_is_saved_backup);
-- 3. CREATE INDEX "kol_tenant_saved_idx" ON "kol"("tenant_id", "is_saved");
