-- B6-kol-daily-sync F005 · KOL "suspicious" hide flag.
--
-- The B6 quality module flags rows whose follower count jumped 10×
-- between syncs (likely fake-follower buy). The Discovery / Database
-- UI must hide those rows.
--
-- Why a top-level boolean and not just `metadata.flags.suspicious_growth`:
-- Prisma's JSON filters can't reliably exclude rows whose JSON path
-- doesn't exist — verified empirically: `metadata: { path: [...],
-- not: true }` and `NOT { equals: true }` both treat missing-path
-- rows as "not matched" rather than "matched", so unflagged rows
-- would also be hidden. A plain boolean column with a default of
-- `false` sidesteps the JSON-null gotcha entirely and is also far
-- cheaper to filter (b-tree index vs jsonb path probe).
--
-- The wider `metadata.flags.suspicious_growth` JSONB stays in place
-- as the audit trail (when it fired, what the prior follower count
-- was, etc.); `is_suspicious` is just the canonical "hide me" bit.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "kol_tenant_is_suspicious_idx";
--   ALTER TABLE "kol" DROP COLUMN IF EXISTS "is_suspicious";

ALTER TABLE "kol"
  ADD COLUMN "is_suspicious" BOOLEAN NOT NULL DEFAULT false;

-- Most queries only want non-suspicious rows; partial index keeps
-- the index size small (only ever covers the flagged minority).
CREATE INDEX "kol_tenant_is_suspicious_idx"
  ON "kol" ("tenant_id", "is_suspicious")
  WHERE "is_suspicious" = true;
