-- BAux1-F001 · AccessRequest intake table
--
-- Public pending table for invite-only signup flow (see docs/specs/
-- BAux1-auth-pages-spec.md §F001). Rows are created anonymously before a
-- tenant/user exists — the table is therefore NOT tenant-scoped and has
-- no RLS. Application code (platform-admin tooling) gates reads.
--
-- Column names deliberately match the Prisma model field names (no
-- @map) because this table is isolated from the existing snake_case
-- multi-tenant schema and the spec defines the canonical shape.

-- CreateTable
CREATE TABLE "access_request" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "firstName" VARCHAR(64) NOT NULL,
    "lastName" VARCHAR(64) NOT NULL,
    "company" VARCHAR(128) NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "campaignsPerQuarter" VARCHAR(32) NOT NULL,
    "games" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "reviewedBy" VARCHAR(320),
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_request_email_key" ON "access_request"("email");

-- CreateIndex
CREATE INDEX "access_request_status_createdAt_idx" ON "access_request"("status", "createdAt");

-- ROLLBACK:
-- DROP INDEX IF EXISTS "access_request_status_createdAt_idx";
-- DROP INDEX IF EXISTS "access_request_email_key";
-- DROP TABLE IF EXISTS "access_request";
