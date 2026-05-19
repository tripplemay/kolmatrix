-- Landing page secondary CTA: track "I want a 1v1 demo" intent.
-- Boolean with DEFAULT false — NOT NULL, safe backfill on existing rows.
-- Column name follows snake_case convention (@map("wants_demo")).
--
-- ROLLBACK:
--   ALTER TABLE "access_request" DROP COLUMN "wants_demo";

ALTER TABLE "access_request"
  ADD COLUMN "wants_demo" BOOLEAN NOT NULL DEFAULT false;
