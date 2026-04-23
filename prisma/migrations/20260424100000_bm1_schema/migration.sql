-- BM1 F001 · Product table + Kol 15-dim filter extension + KolCampaign.kolFee
--
-- Per the 2026-04-23 pre-impl adjudication (docs/specs/BM1-f001-schema-
-- preimpl-audit.md §7):
--   #A skip — these columns already live in B0 init; do NOT re-add:
--     - kol.language
--     - kol.engagement_rate
--     - kol_campaign.match_score
--   #B reuse — existing kol.avg_views covers "avg views per video"; no
--     avg_views_per_video column is introduced.
--   #C reuse — existing kol.audience_age_dist / audience_geo_dist /
--     audience_gender_dist (granular JSONB) cover demographics; no
--     audience_demographics blob is introduced.
--   #D platform stays TEXT; normalization to lowercase happens at the
--     application layer (src/lib/kol/platform.ts).
--   #E value_score stores a normalized 0-100 int; formula still
--     produces a 0-85 raw that is scaled in application code.
--   #F two composite indexes: (tenant, is_gaming, value_score DESC)
--     + (tenant, is_saved).
--
-- tsvector trigger (BI4-F005) is NOT modified — the new columns do not
-- feed into the search vector (display_name / handle / categories / bio
-- only). Adding columns therefore does not invalidate the trigger.

-- 1) Product table ----------------------------------------------------

CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target_audience" TEXT,
    "unique_selling_points" TEXT NOT NULL,
    "download_url" TEXT,
    "launch_date" DATE,
    "ai_assets" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_tenant_id_fkey" FOREIGN KEY ("tenant_id")
      REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_tenant_id_idx" ON "product"("tenant_id");

-- RLS: tenant isolation with NULLIF guard (database-patterns.md §1 —
-- empty-string GUC must degrade to NULL, never cast to uuid).
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 2) Kol extensions (13 new columns) ----------------------------------

ALTER TABLE "kol"
  ADD COLUMN "value_score"              INTEGER,
  ADD COLUMN "tags"                     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "relationship_status"      VARCHAR(20) NOT NULL DEFAULT 'prospect',
  ADD COLUMN "uploads_per_month"        INTEGER,
  ADD COLUMN "last_upload_at"           TIMESTAMPTZ,
  ADD COLUMN "monetization_status"      VARCHAR(20),
  ADD COLUMN "brand_safety_rating"      VARCHAR(8),
  ADD COLUMN "known_brand_collabs"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "engagement_authenticity"  INTEGER,
  ADD COLUMN "is_gaming"                BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "is_saved"                 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "ai_tagged_at"             TIMESTAMPTZ,
  ADD COLUMN "ai_tag_confidence"        VARCHAR(8);

-- Discovery sorts by value_score within gaming KOLs; Database filters
-- by is_saved within a tenant. These two hot paths get dedicated
-- composite indexes (#F).
CREATE INDEX "kol_tenant_gaming_value_idx"
  ON "kol"("tenant_id", "is_gaming", "value_score" DESC);
CREATE INDEX "kol_tenant_saved_idx"
  ON "kol"("tenant_id", "is_saved");

-- 3) KolCampaign extension -------------------------------------------

ALTER TABLE "kol_campaign"
  ADD COLUMN "kol_fee" DECIMAL(10, 2);

-- ROLLBACK:
-- ALTER TABLE "kol_campaign" DROP COLUMN IF EXISTS "kol_fee";
-- DROP INDEX IF EXISTS "kol_tenant_saved_idx";
-- DROP INDEX IF EXISTS "kol_tenant_gaming_value_idx";
-- ALTER TABLE "kol"
--   DROP COLUMN IF EXISTS "ai_tag_confidence",
--   DROP COLUMN IF EXISTS "ai_tagged_at",
--   DROP COLUMN IF EXISTS "is_saved",
--   DROP COLUMN IF EXISTS "is_gaming",
--   DROP COLUMN IF EXISTS "engagement_authenticity",
--   DROP COLUMN IF EXISTS "known_brand_collabs",
--   DROP COLUMN IF EXISTS "brand_safety_rating",
--   DROP COLUMN IF EXISTS "monetization_status",
--   DROP COLUMN IF EXISTS "last_upload_at",
--   DROP COLUMN IF EXISTS "uploads_per_month",
--   DROP COLUMN IF EXISTS "relationship_status",
--   DROP COLUMN IF EXISTS "tags",
--   DROP COLUMN IF EXISTS "value_score";
-- DROP POLICY IF EXISTS tenant_isolation ON "product";
-- ALTER TABLE "product" DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS "product_tenant_id_idx";
-- DROP TABLE IF EXISTS "product";
