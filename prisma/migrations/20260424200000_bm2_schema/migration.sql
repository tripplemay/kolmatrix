-- BM2 F001 · Campaign / outreach / CRM / ROI / weekly-report schema extensions
--
-- Per the 2026-04-24 pre-impl adjudication (docs/specs/BM2-f001-schema-
-- preimpl-audit.md §8):
--   #A A — email_template rebuilt via DROP + CREATE (B0 shape is not a
--     salvage target; 4 pre-existing rows are legacy test fixtures with
--     no production dependency).
--   #B A — new shape matches spec: tenantId nullable (null = system
--     template), single `body`, type column, locale VarChar(5).
--   #C A — discard the 4 legacy rows; F002 seed supplies the canonical
--     system templates (5 × en/zh).
--   #D A — campaign.product_id is TEXT (not UUID) because product.id is
--     cuid() at the BM1 layer; FK type must match.
--   #E A — kol_campaign.status default: 'candidate' → 'pending'. No
--     historical rows exist (kol_campaign has zero rows on staging and
--     prod per 2026-04-24 verification), so no data migration is
--     required.
--   #F A — email_log.template_id FK added with ON DELETE SET NULL;
--     ai_customized column added with NOT NULL DEFAULT false.
--
-- RLS policies for every new tenant-scoped table use NULLIF guards
-- (database-patterns.md §1) so an empty-string GUC degrades to NULL
-- rather than a cast error.

-- 1) Tenant ------------------------------------------------------------

ALTER TABLE "tenant"
  ADD COLUMN "logo_url" TEXT;

-- 2) Kol outreach fields ----------------------------------------------

ALTER TABLE "kol"
  ADD COLUMN "email"        VARCHAR(320),
  ADD COLUMN "email_source" VARCHAR(20) DEFAULT 'manual';

-- 3) Campaign extensions ----------------------------------------------

ALTER TABLE "campaign"
  ADD COLUMN "product_id"       TEXT,
  ADD COLUMN "spend_total"      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "revenue_recorded" NUMERIC(12, 2),
  ADD COLUMN "started_at"       TIMESTAMPTZ,
  ADD COLUMN "closed_at"        TIMESTAMPTZ;

ALTER TABLE "campaign"
  ADD CONSTRAINT "campaign_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "campaign_tenant_id_product_id_idx"
  ON "campaign"("tenant_id", "product_id");

CREATE INDEX "campaign_tenant_id_status_closed_at_idx"
  ON "campaign"("tenant_id", "status", "closed_at" DESC);

-- 4) KolCampaign status default change --------------------------------

ALTER TABLE "kol_campaign"
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- 5) EmailTemplate rebuild (audit #A + #B + #C) ------------------------
--
-- Drop the B0 shape with CASCADE so email_log.template_id rows (none on
-- staging/prod but defensive) don't block. The FK is re-established in
-- step 8 below against the rebuilt table.

DROP TABLE IF EXISTS "email_template" CASCADE;

CREATE TABLE "email_template" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"   UUID,
    "name"        TEXT        NOT NULL,
    "subject"     TEXT        NOT NULL,
    "body"        TEXT        NOT NULL,
    "variables"   JSONB       NOT NULL,
    "locale"      VARCHAR(5)  NOT NULL DEFAULT 'en',
    "type"        VARCHAR(20) NOT NULL DEFAULT 'system',
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id"),
    -- Optional relation (system templates have tenant_id=NULL); matches
    -- Prisma's default ON DELETE SET NULL for nullable FKs.
    CONSTRAINT "email_template_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "email_template_tenant_id_type_idx"
  ON "email_template"("tenant_id", "type");

CREATE INDEX "email_template_type_locale_idx"
  ON "email_template"("type", "locale");

-- RLS: tenant-isolation OR system template (tenant_id IS NULL).
ALTER TABLE "email_template" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "email_template"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id IS NULL
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id IS NULL
  );

-- 6) CampaignMetric new table -----------------------------------------

CREATE TABLE "campaign_metric" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"          UUID        NOT NULL,
    "campaign_id"        UUID        NOT NULL,
    "recorded_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions"        INTEGER,
    "clicks"             INTEGER,
    "conversions"        INTEGER,
    "attributed_revenue" NUMERIC(12, 2),
    "source"             VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_metric_pkey" PRIMARY KEY ("id"),
    -- Required relation; matches Prisma's default ON DELETE RESTRICT.
    CONSTRAINT "campaign_metric_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaign_metric_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "campaign_metric_tenant_id_campaign_id_recorded_at_idx"
  ON "campaign_metric"("tenant_id", "campaign_id", "recorded_at" DESC);

ALTER TABLE "campaign_metric" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campaign_metric"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 7) WeeklyReport new table -------------------------------------------
--
-- Anonymous share-token reads live in a future F010 route that hits a
-- superuser connection (bypassing RLS). This policy covers the normal
-- tenant-scoped app path.

CREATE TABLE "weekly_report" (
    "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"              UUID        NOT NULL,
    "week_start"             DATE        NOT NULL,
    "week_end"               DATE        NOT NULL,
    "locale"                 VARCHAR(5)  NOT NULL DEFAULT 'en',
    "content_md"             TEXT        NOT NULL,
    "summary_json"           JSONB,
    "share_token"            VARCHAR(32),
    "share_token_expires_at" TIMESTAMPTZ,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id"     UUID        NOT NULL,

    CONSTRAINT "weekly_report_pkey" PRIMARY KEY ("id"),
    -- Required relation; matches Prisma's default ON DELETE RESTRICT.
    CONSTRAINT "weekly_report_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "weekly_report_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "weekly_report_share_token_key"
  ON "weekly_report"("share_token");

CREATE INDEX "weekly_report_tenant_id_week_end_idx"
  ON "weekly_report"("tenant_id", "week_end" DESC);

ALTER TABLE "weekly_report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "weekly_report"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 8) EmailLog: FK + ai_customized (audit #F) ---------------------------
--
-- template_id column already existed (B0) without an FK. Attach the new
-- constraint pointing at the rebuilt email_template table and add the
-- AI-customization flag for PRD §2.2 adoption metrics.

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "email_template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_log"
  ADD COLUMN "ai_customized" BOOLEAN NOT NULL DEFAULT false;

-- =====================================================================
-- ROLLBACK: manual-execution SQL for BM2 F001 (not auto-run by Prisma)
-- =====================================================================
--
-- -- 1) Revert Tenant.logo_url
-- ALTER TABLE "tenant" DROP COLUMN "logo_url";
--
-- -- 2) Revert Kol outreach fields
-- ALTER TABLE "kol" DROP COLUMN "email_source", DROP COLUMN "email";
--
-- -- 3) Revert Campaign extensions
-- DROP INDEX IF EXISTS "campaign_tenant_id_status_closed_at_idx";
-- DROP INDEX IF EXISTS "campaign_tenant_id_product_id_idx";
-- ALTER TABLE "campaign" DROP CONSTRAINT "campaign_product_id_fkey";
-- ALTER TABLE "campaign"
--   DROP COLUMN "closed_at",
--   DROP COLUMN "started_at",
--   DROP COLUMN "revenue_recorded",
--   DROP COLUMN "spend_total",
--   DROP COLUMN "product_id";
--
-- -- 4) Revert KolCampaign default
-- ALTER TABLE "kol_campaign" ALTER COLUMN "status" SET DEFAULT 'candidate';
--
-- -- 5) Revert EmailTemplate to B0 shape
-- DROP TABLE IF EXISTS "email_template" CASCADE;
-- CREATE TABLE "email_template" (
--     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
--     "tenant_id" UUID NOT NULL,
--     "name" TEXT NOT NULL,
--     "subject" TEXT NOT NULL,
--     "body_html" TEXT NOT NULL,
--     "body_text" TEXT NOT NULL,
--     "variables" JSONB,
--     "locale" TEXT NOT NULL DEFAULT 'en',
--     "category" TEXT NOT NULL DEFAULT 'outreach',
--     "created_by" UUID NOT NULL,
--     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "updated_at" TIMESTAMPTZ NOT NULL,
--     "deleted_at" TIMESTAMPTZ,
--     CONSTRAINT "email_template_pkey" PRIMARY KEY ("id"),
--     CONSTRAINT "email_template_tenant_id_fkey"
--       FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
--       ON DELETE CASCADE ON UPDATE CASCADE,
--     CONSTRAINT "email_template_created_by_fkey"
--       FOREIGN KEY ("created_by") REFERENCES "user"("id")
--       ON DELETE RESTRICT ON UPDATE CASCADE
-- );
-- CREATE INDEX "email_template_tenant_id_locale_category_idx"
--   ON "email_template"("tenant_id", "locale", "category");
-- ALTER TABLE "email_template" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON "email_template"
--   USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
--   WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--
-- -- 6) Drop CampaignMetric
-- DROP TABLE IF EXISTS "campaign_metric" CASCADE;
--
-- -- 7) Drop WeeklyReport
-- DROP TABLE IF EXISTS "weekly_report" CASCADE;
--
-- -- 8) Revert EmailLog additions
-- ALTER TABLE "email_log" DROP COLUMN "ai_customized";
-- ALTER TABLE "email_log" DROP CONSTRAINT IF EXISTS "email_log_template_id_fkey";
