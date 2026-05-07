-- BL-051a Lifecycle Management — combined schema migration (F001 + F006).
--
-- Part A (F001) · weekly_report.revoked_at — explicit revocation
-- timestamp for share links. Reuses the existing share_token_expires_at
-- column for expiration semantics (pre-impl audit A1: avoids dup
-- column with same meaning); only revoked_at is new.
--
-- Part B (F006) · product.deleted_at + partial active index. Non-NULL =
-- tombstoned. Existing referencing rows (campaign.product_id /
-- asset.product_id) keep their FK pointers; F009 UI defends against
-- product=NULL display. Cascade behavior: see F008 (counts only;
-- asset.deleted_at not in scope this batch — Asset has no deleted_at
-- column, so spec D2 "如有" hedge fires as no-op).
--
-- Part C (F008 follow-on) · audit_log.resource_id type widening.
-- Pre-BL-051a all audit_log resource_id values were UUIDs (campaign /
-- KOL / asset / weekly_report). F008's product.deleted audit writes
-- the Product.id (cuid, NOT a UUID; see PRODUCT_ID_RE in actions.ts
-- + ADR-of-BL-020 #1:A). The original UUID type rejects cuid input
-- (`invalid input syntax for type uuid`), so we widen to VARCHAR(64)
-- to match event_log.resource_id and accept both UUIDs and cuids.
-- VARCHAR(64) holds any 36-char UUID and any reasonable cuid (cuid v1
-- is 25 chars, cuid v2 ≤ 32). Existing UUID rows convert losslessly.
--
-- ROLLBACK: apply these statements in reverse order.
--   ALTER TABLE "audit_log" ALTER COLUMN "resource_id" TYPE UUID
--     USING "resource_id"::uuid;  -- only safe if no cuid rows exist
--   DROP INDEX "product_tenant_active_idx";
--   ALTER TABLE "product" DROP COLUMN "deleted_at";
--   ALTER TABLE "weekly_report" DROP COLUMN "revoked_at";

ALTER TABLE "audit_log"
  ALTER COLUMN "resource_id" TYPE VARCHAR(64);

-- ===== Part A · weekly_report ============================================

ALTER TABLE "weekly_report"
  ADD COLUMN "revoked_at" TIMESTAMPTZ;

-- ===== Part B · product ==================================================

ALTER TABLE "product"
  ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Partial index: active rows only. List queries filter
-- WHERE deleted_at IS NULL (F007), so the existing tenant_id index
-- gets diluted by tombstones over time. Partial index keeps active
-- lookups O(log active_rows).
CREATE INDEX "product_tenant_active_idx"
  ON "product" ("tenant_id")
  WHERE "deleted_at" IS NULL;
