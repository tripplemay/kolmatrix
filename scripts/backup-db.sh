#!/usr/bin/env bash
#
# Pre-deploy Postgres backup — dumps the live production DB to a
# gzipped .sql file under /opt/kolmatrix-backups/ and appends a
# manifest line (timestamp + git SHA) so we can map any backup
# back to the commit it was taken against.
#
# Called by scripts/deploy-prod.sh before migrate/build/reload. The
# user can set SKIP_BACKUP=true to bypass it (not recommended — the
# workflow input defaults to false).
#
# Retention: a crontab entry (`0 4 * * * find ... -mtime +30 -delete`)
# prunes files older than 30 days; see docs/dev/deployment-runbook.md
# §Backups for the exact line.
#
# Env overrides (all optional, defaults match the prod VPS):
#   PGUSER        postgres
#   PGDATABASE    kolmatrix_prod
#   BACKUP_DIR    /opt/kolmatrix-backups
#   REPO_DIR      /opt/kolmatrix         (for git-SHA manifest lookup)
#
# Spec: docs/specs/BI2-deployment-automation-spec.md §F004

set -euo pipefail

: "${PGUSER:=postgres}"
: "${PGDATABASE:=kolmatrix_prod}"
: "${BACKUP_DIR:=/opt/kolmatrix-backups}"
: "${REPO_DIR:=/opt/kolmatrix}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="db-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Resolve the git SHA for the manifest. When called out-of-repo (unit
# test) `git -C ... rev-parse HEAD` can fail; fall back to "unknown" so
# a backup never aborts because of metadata.
GIT_SHA=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")

echo "📦 pg_dump ${PGUSER}@${PGDATABASE} → ${BACKUP_DIR}/${FILENAME}"
pg_dump -U "$PGUSER" "$PGDATABASE" | gzip > "${BACKUP_DIR}/${FILENAME}"

# Manifest is append-only audit trail: one line per backup. Grep-friendly.
echo "${TIMESTAMP} ${GIT_SHA} ${FILENAME}" >> "${BACKUP_DIR}/manifest.log"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "✅ Backup done: ${BACKUP_DIR}/${FILENAME} (${SIZE})"
