-- BL-059-F002 · Recompute engagement_rate for apify-kol KOL rows that
-- still have NULL engagement_rate but DO have metadata.raw preserved
-- (BL-059-F001 mapper + BL-059 import.ts metadata.raw additions land
-- on the next sync after deploy).
--
-- Spec §3.1 originally read engagement_rate from metadata.raw.* (the
-- fork's totalLikes / postsCount), assuming raw was preserved at
-- write time. The historical 237 prod apify-kol rows pre-dated the
-- import.ts metadata.raw addition, so this SQL updates 0 of them
-- today; engagement_rate populates naturally on the next daily sync
-- once F001 mapper code reaches prod (mapper computes the rate and
-- import.ts writes Kol.engagement_rate directly).
--
-- The SQL is retained as a safety-net for any future apify-kol rows
-- that have metadata.raw but missed the mapper write — for example,
-- if a partial-failure mid-batch ever leaves rows half-populated.
--
-- Verify post-COMMIT (spec §10.2 DoD #2):
--   SELECT COUNT(*) FROM kol
--   WHERE metadata->>'source'='apify-kol'
--     AND deleted_at IS NULL
--     AND engagement_rate IS NOT NULL;
--   -- expect ≥ 200 after first daily sync post-redeploy

UPDATE kol
SET engagement_rate = CASE
      WHEN follower_count > 0
        AND (metadata->'raw'->>'postsCount')::int > 0
        AND (metadata->'raw'->>'totalLikes') IS NOT NULL
      THEN
        ((metadata->'raw'->>'totalLikes')::bigint::float
         / NULLIF((metadata->'raw'->>'postsCount')::int, 0))
        / follower_count * 100
      ELSE NULL
    END,
    updated_at = now()
WHERE metadata->>'source' = 'apify-kol'
  AND deleted_at IS NULL
  AND engagement_rate IS NULL
  AND metadata ? 'raw';
