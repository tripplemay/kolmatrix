-- BL-099-F003 (ADR-018 D2) — snapshot template name on email_log + decouple FK.
--
-- email_log.template_id stops being a foreign key into email_template
-- (which F005 drops). The template name as-sent is frozen into a new
-- template_name column so audit history survives rename / delete / the
-- table drop. analytics getTopTemplates (F004) reads this column instead
-- of joining email_template.

-- 1. Add the snapshot column (nullable; historical rows backfilled below,
--    rows with no resolvable template stay NULL).
ALTER TABLE "email_log" ADD COLUMN "template_name" TEXT;

-- 2. Backfill from email_template while it still exists (before F005).
UPDATE "email_log" AS el
SET "template_name" = et."name"
FROM "email_template" AS et
WHERE el."template_id" = et."id"
  AND el."template_id" IS NOT NULL;

-- 3. Drop the FK constraint; template_id remains a plain uuid for
--    historical correlation.
ALTER TABLE "email_log" DROP CONSTRAINT "email_log_template_id_fkey";

-- ROLLBACK:
-- ALTER TABLE "email_log" ADD CONSTRAINT "email_log_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE "email_log" DROP COLUMN "template_name";
