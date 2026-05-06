-- BL-040 F001: enforce Product.targetAudience NOT NULL at DB level.
-- PRD §13 Q5 user-locked answer: targetAudience must be required.
--
-- Prod 5 rows already filled (128-151 chars high-quality content);
-- backfill placeholder defends staging/local rows that may still be
-- NULL from the bm1_schema migration era when the column was added
-- as nullable TEXT.
--
-- ROLLBACK: ALTER TABLE "product" ALTER COLUMN "target_audience" DROP NOT NULL;

UPDATE "product"
   SET "target_audience" = '<未填写，请补充>'
 WHERE "target_audience" IS NULL OR "target_audience" = '';

ALTER TABLE "product" ALTER COLUMN "target_audience" SET NOT NULL;
