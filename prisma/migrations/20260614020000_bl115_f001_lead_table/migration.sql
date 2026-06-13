-- BL-115-F001 — landing-page trial-request leads (ad-funnel intake).
--
-- Lightweight 3-field trial form (name / company email / game studio) + UTM
-- attribution captured from the marketing landing page. Like access_request,
-- these rows are anonymous public intake created before any tenant/user
-- exists, so the table is NOT tenant-scoped and carries no RLS policy —
-- reads are gated in application code (platform-admin / marketing tooling).
-- Additive new table; zero backfill, safe to `prisma migrate deploy` with no
-- downtime.

CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "studio" VARCHAR(160) NOT NULL,
    "utm_source" VARCHAR(128),
    "utm_medium" VARCHAR(128),
    "utm_campaign" VARCHAR(128),
    "utm_term" VARCHAR(128),
    "utm_content" VARCHAR(128),
    "referrer" TEXT,
    "landing_path" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_created_at_idx" ON "lead"("created_at");

CREATE INDEX "lead_email_idx" ON "lead"("email");

-- ROLLBACK:
-- DROP TABLE "lead";
