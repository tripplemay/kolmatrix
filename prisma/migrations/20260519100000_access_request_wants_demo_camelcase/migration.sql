-- Rename wants_demo → wantsDemo to match the access_request
-- table's pre-existing camelCase column convention (firstName,
-- lastName, campaignsPerQuarter, etc. are all camelCase, NOT
-- snake_case + @map). Originally added as snake_case in
-- 20260519092852_access_request_wants_demo/; this migration aligns it.
ALTER TABLE "access_request" RENAME COLUMN "wants_demo" TO "wantsDemo";
