-- B7b-F003 · Saved Search table for /discovery.
--
-- ROLLBACK:
-- DROP POLICY IF EXISTS saved_search_tenant_isolation ON "saved_search";
-- DROP TABLE IF EXISTS "saved_search";

CREATE TABLE "saved_search" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "filters" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "saved_search"
  ADD CONSTRAINT "saved_search_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE;

ALTER TABLE "saved_search"
  ADD CONSTRAINT "saved_search_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;

CREATE INDEX "saved_search_tenant_user_created_idx"
  ON "saved_search" ("tenant_id", "user_id", "created_at" DESC);

ALTER TABLE "saved_search" ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_search_tenant_isolation ON "saved_search"
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
