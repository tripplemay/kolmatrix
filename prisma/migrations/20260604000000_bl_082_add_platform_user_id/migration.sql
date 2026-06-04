-- BL-082-F001 · kol.platform_user_id — platform-native user id for refresh.
--
-- The fork's single-profile refresh endpoint `GET /kol/:platform/:userId`
-- keys on the platform-native id (`platformUserId`): YouTube channel id
-- "UC…", TikTok/Instagram numeric ids. KOLMatrix previously discarded
-- this field in the mapper — it stored `external_id` (the fork's own row
-- id, which 404s on refresh) and `handle` (username; only YouTube's handle
-- happens to equal the UC id). Persisting `platform_user_id` lets the
-- daily refresh phase (F003) build `<platform>:<platform_user_id>` ids
-- that the fork actually resolves (probed 2026-06-04: YT/TikTok/Instagram
-- all HTTP 200 with this value).
--
-- Type choice:
--   platform_user_id TEXT — ids are opaque strings across platforms
--     (UC-prefixed for YT, numeric strings for TT/IG); matches the
--     unbounded TEXT convention used for external_id / handle.
--
-- Additive + safe:
--   - Nullable, no DEFAULT, no backfill at apply time. Existing rows stay
--     NULL until F002's one-shot backfill populates them from the fork
--     (matched by external_id). New/refreshed rows get it via the F001
--     mapper change.
--   - Does not touch any existing column or data; RLS unchanged (column
--     lives on the already-tenant-isolated kol table).
--
-- ROLLBACK:
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "platform_user_id";

ALTER TABLE "kol"
  ADD COLUMN "platform_user_id" TEXT;
