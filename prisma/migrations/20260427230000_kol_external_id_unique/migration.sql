-- MVP-kol-seed-redo F003 fix-round 1 · Switch dedupe key to externalId.
--
-- Spec calls for upsert-by-channelId (`(tenantId, platform, externalId)`)
-- because the YouTube `channel.id` is permanent while `customUrl` /
-- `handle` is mutable — a creator can change @handle and the import
-- would create a duplicate row under the existing
-- (tenantId, platform, handle) constraint.
--
-- This migration adds a SECOND unique constraint to support the new
-- upsert key without removing the existing handle-based one — handle
-- still has to stay unique within (tenantId, platform) because the
-- KOL discovery UI looks up channels by handle in places.
--
-- PostgreSQL treats NULLs as distinct in unique indexes by default, so
-- the 12 B0 demo rows + 2,524 BM1 enriched rows that have
-- external_id IS NULL all coexist under this constraint without
-- conflict. The 760 YouTube-seeded rows already carry distinct
-- channel.id values per import, so the constraint passes the existing
-- data unchanged.
--
-- ROLLBACK SQL:
--   ALTER TABLE "kol" DROP CONSTRAINT "kol_tenantId_platform_externalId_key";

ALTER TABLE "kol"
  ADD CONSTRAINT "kol_tenantId_platform_externalId_key"
  UNIQUE ("tenant_id", "platform", "external_id");
