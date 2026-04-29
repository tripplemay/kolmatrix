-- B5-kol-data-enrichment F001 · Promote metadata.youtube.* into
-- dedicated Kol columns.
--
-- The MVP-kol-seed-redo F003 import wrote per-row YouTube provenance
-- (videoCount / totalViewCount / channelCreatedAt / bannerUrl) into
-- the kol.metadata JSONB blob so we wouldn't have to re-fetch from
-- the YouTube API later. B5 promotes those four fields into proper
-- columns so Discovery / Detail Page / Filters can index and query
-- them directly without a JSONB path probe.
--
-- F002 backfills the columns by re-running channels.list (cost ~20
-- units per 1000 KOLs); F004 lazy-loads search.list + videos.list on
-- detail-page open to compute the true engagementRate and writes it
-- back into the existing kol.engagement_rate column (A1 — see B5
-- spec §F004 #4 for the full DB state lifecycle).
--
-- Per the 2026-04-30 user adjudication (A2): metadata.youtube.* is
-- preserved for historical reads but no longer written. New code only
-- writes the dedicated columns — no double-write. Crawler team's
-- BL-012 dataset (~2026-06-25) will populate the dedicated columns
-- directly.
--
-- Additive migration — all columns are nullable, no backfill at apply
-- time, no breaking changes. Existing rows get NULL until F002's
-- enrich script runs.
--
-- Type choices:
--   channel_created_at TIMESTAMPTZ — YouTube returns ISO-8601 with
--     timezone; matches the rest of the schema's @db.Timestamptz
--     convention.
--   video_count        INTEGER     — YouTube channel videoCount fits
--     comfortably under INT32_MAX (max channel ≈ 5M videos << 2^31).
--   total_view_count   BIGINT      — lifetime view counts on top
--     channels exceed INT32_MAX (T-Series ~3×10^11), so BIGINT is
--     required.
--   banner_url         TEXT        — YouTube CDN URL, no length cap
--     enforced; matches kol.avatar_url which is also unbounded TEXT.
--
-- ROLLBACK:
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "banner_url";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "total_view_count";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "video_count";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "channel_created_at";

ALTER TABLE "kol"
  ADD COLUMN "channel_created_at" TIMESTAMPTZ,
  ADD COLUMN "video_count"        INTEGER,
  ADD COLUMN "total_view_count"   BIGINT,
  ADD COLUMN "banner_url"         TEXT;
