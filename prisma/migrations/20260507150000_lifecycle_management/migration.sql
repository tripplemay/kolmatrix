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
-- ROLLBACK ORDER (apply in reverse):
--   DROP INDEX "product_tenant_active_idx";
--   ALTER TABLE "product" DROP COLUMN "deleted_at";
--   ALTER TABLE "weekly_report" DROP COLUMN "revoked_at";

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
