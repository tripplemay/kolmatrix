-- BL-063-F006 · Prod post-deploy audit (read-only)
--
-- 用法：
--   ssh tripplezhou@34.180.93.185 \
--     'sudo -u postgres psql -d kolmatrix -f /opt/kolmatrix/scripts/sql/BL-063-F006-prod-audit.sql'
--
-- 配套 wrapper：scripts/bl063-f006-prod-audit.sh（含 curl + pm2 logs + 自动 PASS/FAIL 汇总）
-- spec：features.json F006 acceptance §5 (prod SQL audit) + §3 (health git_sha)
-- 仅 SELECT，零修改风险。
--
-- 期望结果（与 staging dry-run report §2 同口径）：
--   #1 _prisma_migrations: 1 row, finished=t, rolled_back_at=null
--   #2 information_schema: 0 rows (is_saved column gone)
--   #3 pg_indexes:         0 rows (kol_tenant_saved_idx gone)
--   #4 engagement_rate non_null_rows ≥ 95（per F005 §3 修订后 acceptance — Planner ruling 0ea747d）
--   #5 kol 行数：total ~prod 当前行数，active ~total - soft_deleted（migration 不丢行）
--   #6 _bl063_is_saved_backup = NULL（TEMP，session-scoped，post-deploy expected）

\echo ''
\echo '===== [1] _prisma_migrations: BL-063 migration applied ====='
SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at
FROM _prisma_migrations
WHERE migration_name LIKE '%bl063%' OR migration_name LIKE '%is_saved%'
ORDER BY started_at DESC LIMIT 3;

\echo ''
\echo '===== [2] is_saved column should NOT exist ====='
SELECT column_name FROM information_schema.columns
WHERE table_name='kol' AND column_name='is_saved';

\echo ''
\echo '===== [3] kol_tenant_saved_idx should NOT exist ====='
SELECT indexname FROM pg_indexes
WHERE tablename='kol' AND indexname='kol_tenant_saved_idx';

\echo ''
\echo '===== [4] engagement_rate non-null rows (acceptance §3: ≥ 95) ====='
SELECT COUNT(*) AS total_kol,
       COUNT(engagement_rate) AS non_null,
       ROUND(COUNT(engagement_rate)::numeric * 100 / NULLIF(COUNT(*), 0), 2) AS non_null_pct
FROM kol WHERE deleted_at IS NULL;

\echo ''
\echo '===== [5] kol row count sanity (migration must not lose rows) ====='
SELECT COUNT(*) AS total_kol_all,
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_kol
FROM kol;

\echo ''
\echo '===== [6] _bl063_is_saved_backup TEMP (expected: not_found post-deploy) ====='
SELECT to_regclass('public._bl063_is_saved_backup') AS backup_table;
