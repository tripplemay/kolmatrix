-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMPTZ,
    "hashed_password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'marketer',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "image" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL
);

-- CreateTable
CREATE TABLE "kol" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "country_code" TEXT,
    "language" TEXT,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DECIMAL(5,2),
    "avg_views" INTEGER,
    "categories" TEXT[],
    "audience_age_dist" JSONB,
    "audience_geo_dist" JSONB,
    "audience_gender_dist" JSONB,
    "ai_score" INTEGER,
    "ai_score_breakdown" JSONB,
    "ai_evaluated_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active',
    "external_id" TEXT,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "kol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT,
    "markets" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budget_amount" DECIMAL(12,2),
    "budget_currency" TEXT NOT NULL DEFAULT 'USD',
    "kpi_target" JSONB,
    "start_date" DATE,
    "end_date" DATE,
    "owner_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "kol_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "match_score" INTEGER,
    "match_reasoning" JSONB,
    "contacted_at" TIMESTAMPTZ,
    "replied_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kol_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "variables" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'outreach',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID,
    "kol_id" UUID,
    "template_id" UUID,
    "to_address" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "provider_message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "opened_at" TIMESTAMPTZ,
    "replied_at" TIMESTAMPTZ,
    "bounce_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "payload" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_tenant_id_idx" ON "user"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_session_token_key" ON "session"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_token_key" ON "verification_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_identifier_token_key" ON "verification_token"("identifier", "token");

-- CreateIndex
CREATE INDEX "kol_tenant_id_ai_score_idx" ON "kol"("tenant_id", "ai_score" DESC);

-- CreateIndex
CREATE INDEX "kol_tenant_id_platform_follower_count_idx" ON "kol"("tenant_id", "platform", "follower_count");

-- CreateIndex
CREATE UNIQUE INDEX "kol_tenant_id_platform_handle_key" ON "kol"("tenant_id", "platform", "handle");

-- CreateIndex
CREATE INDEX "campaign_tenant_id_status_start_date_idx" ON "campaign"("tenant_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "kol_campaign_tenant_id_campaign_id_status_idx" ON "kol_campaign"("tenant_id", "campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kol_campaign_tenant_id_kol_id_campaign_id_key" ON "kol_campaign"("tenant_id", "kol_id", "campaign_id");

-- CreateIndex
CREATE INDEX "email_template_tenant_id_locale_category_idx" ON "email_template"("tenant_id", "locale", "category");

-- CreateIndex
CREATE UNIQUE INDEX "email_log_provider_message_id_key" ON "email_log"("provider_message_id");

-- CreateIndex
CREATE INDEX "email_log_tenant_id_campaign_id_status_idx" ON "email_log"("tenant_id", "campaign_id", "status");

-- CreateIndex
CREATE INDEX "email_log_tenant_id_kol_id_idx" ON "email_log"("tenant_id", "kol_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_resource_type_resource_id_idx" ON "audit_log"("tenant_id", "resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol" ADD CONSTRAINT "kol_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_campaign" ADD CONSTRAINT "kol_campaign_kol_id_fkey" FOREIGN KEY ("kol_id") REFERENCES "kol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_campaign" ADD CONSTRAINT "kol_campaign_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_kol_id_fkey" FOREIGN KEY ("kol_id") REFERENCES "kol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- GIN indexes for JSONB / array columns (see B0-database-schema.md §3.4)
-- ============================================================
CREATE INDEX "kol_categories_gin_idx" ON "kol" USING GIN ("categories");
CREATE INDEX "kol_audience_geo_dist_gin_idx" ON "kol" USING GIN ("audience_geo_dist");

-- ============================================================
-- Row-Level Security (see B0-database-schema.md §5)
--
-- tenant_id scoping:
--   Every business table whose rows are tenant-owned enables RLS and
--   installs a USING policy keyed on `app.tenant_id` session var.
--
-- The bootstrap user (migrations + seed) is the PostgreSQL superuser
-- who implicitly BYPASSES RLS. Application code must NEVER connect
-- as superuser — it must connect as a role that has RLS enforced and
-- set `app.tenant_id` via `SET LOCAL` inside each transaction
-- (see src/lib/db.ts withTenant wrapper, F004).
-- ============================================================

ALTER TABLE "user"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kol"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kol_campaign"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_template"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_log"       ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON "user"
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR current_setting('app.is_platform_admin', true)::bool = true
  );

CREATE POLICY tenant_isolation ON "kol"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "campaign"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "kol_campaign"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "email_template"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON "email_log"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ROLLBACK:
-- DROP POLICY IF EXISTS tenant_isolation ON "email_log";
-- DROP POLICY IF EXISTS tenant_isolation ON "email_template";
-- DROP POLICY IF EXISTS tenant_isolation ON "kol_campaign";
-- DROP POLICY IF EXISTS tenant_isolation ON "campaign";
-- DROP POLICY IF EXISTS tenant_isolation ON "kol";
-- DROP POLICY IF EXISTS user_isolation ON "user";
-- DROP INDEX IF EXISTS "kol_audience_geo_dist_gin_idx";
-- DROP INDEX IF EXISTS "kol_categories_gin_idx";
-- DROP TABLE IF EXISTS "audit_log", "email_log", "email_template",
--   "kol_campaign", "campaign", "kol", "verification_token",
--   "session", "account", "user", "tenant" CASCADE;
