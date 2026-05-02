-- BL-025-F001 · Unified Asset table (素材中心 / Asset Library)
--
-- ADR-011 方案 X: 1 row per asset (email / video_script / future
-- types) instead of one table per type. content JSONB carries the
-- per-type shape (see src/lib/assets/schemas.ts in F002 for the Zod
-- contracts). EmailTemplate rows migrate into this table in the
-- follow-up migration `20260502120100_migrate_email_template_to_asset`;
-- both tables coexist for a 1-sprint dual-write window before the
-- separate cleanup migration drops email_template.
--
-- RLS shape mirrors email_template's union policy: tenant_id IS NULL
-- means system_seed (visible across tenants); a UUID match restricts
-- a row to its owning tenant. Empty-string GUC degrades to NULL via
-- NULLIF (BI1-F008 pattern, see 20260420000000_rls_nullif_empty_tenant
-- for context).

-- 1) Enums --------------------------------------------------------

CREATE TYPE "AssetType" AS ENUM ('email', 'video_script');
CREATE TYPE "AssetSource" AS ENUM (
  'ai_generated', 'user_created', 'imported', 'system_seed'
);
CREATE TYPE "AssetStatus" AS ENUM ('draft', 'published', 'archived');

-- 2) Table --------------------------------------------------------

CREATE TABLE "asset" (
    "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID,
    "product_id" TEXT,
    "type"       "AssetType"   NOT NULL,
    "name"       VARCHAR(200)  NOT NULL,
    "content"    JSONB         NOT NULL,
    "source"     "AssetSource" NOT NULL,
    "parent_id"  UUID,
    "status"     "AssetStatus" NOT NULL DEFAULT 'draft',
    "metadata"   JSONB         NOT NULL DEFAULT '{}'::jsonb,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ   NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asset_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "asset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asset_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3) Indexes ------------------------------------------------------

CREATE INDEX "asset_tenant_id_type_status_idx"
  ON "asset"("tenant_id", "type", "status");
CREATE INDEX "asset_tenant_id_product_id_idx"
  ON "asset"("tenant_id", "product_id");
CREATE INDEX "asset_parent_id_idx"
  ON "asset"("parent_id");

-- 4) RLS policy ---------------------------------------------------
--
-- Same union shape as email_template: a row is visible when
-- (a) tenant_id matches the session GUC, or (b) tenant_id IS NULL
-- (system_seed). The empty-string GUC case degrades to NULL through
-- NULLIF, so the second branch still lets system rows through.

ALTER TABLE "asset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_tenant_isolation ON "asset"
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id IS NULL
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "asset" TO kolmatrix_app;

-- ROLLBACK: drop policy + table + 3 enum types. The follow-up
-- migration 20260502120100_migrate_email_template_to_asset must be
-- rolled back first (its own ROLLBACK section deletes the migrated
-- rows) so DROP TABLE asset CASCADE has no FK dependents that matter.
--
-- DROP POLICY IF EXISTS asset_tenant_isolation ON "asset";
-- ALTER TABLE "asset" DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS "asset" CASCADE;
-- DROP TYPE IF EXISTS "AssetStatus";
-- DROP TYPE IF EXISTS "AssetSource";
-- DROP TYPE IF EXISTS "AssetType";
