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
# Retention: a durable /etc/cron.d/kolmatrix-backup-retention file
# (`0 4 * * * root find ... -mtime +14 -delete`) prunes dumps older than
# 14 days. Installed as cron.d (not crontab -e) because the latter was
# lost on the 2026-06-07 VM reset; MUST be re-created after any VM
# rebuild. See docs/dev/deployment-runbook.md §Backups.
#
# Connection strategy (2026-04-20 revision, bootstrap round 2):
#   1. If DATABASE_ADMIN_URL is already in env → use as-is.
#   2. Else if $REPO_DIR/.env.production exists → source it (that's how
#      the prod VPS stores DATABASE_ADMIN_URL with the superuser
#      credentials needed for pg_dump on ALL tables).
#   3. Else fall back to PGUSER/PGDATABASE unix-socket peer-auth, which
#      only works if the caller is the postgres OS user (ad-hoc local
#      testing). The prod VPS path (1+2) connects over TCP with
#      password auth because the deploy user (tripplezhou) is NOT the
#      postgres peer.
#
# Env overrides (all optional):
#   DATABASE_ADMIN_URL   postgresql://superuser:pass@host:port/db  (preferred)
#   PGUSER               postgres              (peer-auth fallback only)
#   PGDATABASE           kolmatrix             (peer-auth fallback only)
#   BACKUP_DIR           /opt/kolmatrix-backups
#   REPO_DIR             /opt/kolmatrix        (for env + git-SHA manifest)
#
# Spec: docs/specs/BI2-deployment-automation-spec.md §F004

set -euo pipefail

: "${BACKUP_DIR:=/opt/kolmatrix-backups}"
: "${REPO_DIR:=/opt/kolmatrix}"

# Source .env.production if we don't already have the admin URL. Using
# `set -a` so every KEY=VALUE in the file becomes exported — DATABASE_
# ADMIN_URL and friends. Quiet about a missing file; the peer-auth
# fallback below will still work for local ad-hoc runs.
if [[ -z "${DATABASE_ADMIN_URL:-}" && -r "${REPO_DIR}/.env.production" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_DIR}/.env.production"
  set +a
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="db-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Resolve the git SHA for the manifest. When called out-of-repo (unit
# test) `git -C ... rev-parse HEAD` can fail; fall back to "unknown" so
# a backup never aborts because of metadata.
GIT_SHA=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")

if [[ -n "${DATABASE_ADMIN_URL:-}" ]]; then
  # Prisma's URL tacks on a ?schema=public query param that pg_dump
  # rejects ("invalid URI query parameter"). Strip the query string —
  # we always dump the whole DB, so the schema selector is moot.
  DUMP_URL=${DATABASE_ADMIN_URL%%\?*}
  # Mask the password for the log line.
  SAFE_URL=$(printf '%s' "$DUMP_URL" | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#')
  echo "📦 pg_dump ${SAFE_URL} → ${BACKUP_DIR}/${FILENAME}"
  pg_dump "$DUMP_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"
else
  PGUSER_EFFECTIVE=${PGUSER:-postgres}
  PGDATABASE_EFFECTIVE=${PGDATABASE:-kolmatrix}
  echo "📦 pg_dump ${PGUSER_EFFECTIVE}@${PGDATABASE_EFFECTIVE} → ${BACKUP_DIR}/${FILENAME}"
  pg_dump -U "$PGUSER_EFFECTIVE" "$PGDATABASE_EFFECTIVE" | gzip > "${BACKUP_DIR}/${FILENAME}"
fi

# Manifest is append-only audit trail: one line per backup. Grep-friendly.
echo "${TIMESTAMP} ${GIT_SHA} ${FILENAME}" >> "${BACKUP_DIR}/manifest.log"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "✅ Backup done: ${BACKUP_DIR}/${FILENAME} (${SIZE})"
