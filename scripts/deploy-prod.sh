#!/usr/bin/env bash
#
# Production deploy driver — runs on the VPS, invoked over SSH by
# .github/workflows/deploy-prod.yml (appleboy/ssh-action).
#
# Sequence (spec §F003):
#   1. Record current HEAD to /tmp/prev-sha (consumed by rollback.sh)
#   2. pg_dump + gzip under /opt/kolmatrix-backups/  (unless SKIP_BACKUP=true)
#   3. git fetch + checkout $GIT_SHA
#   4. npm ci (dev deps needed for `next build`)
#   5. npx prisma migrate deploy — failure aborts before PM2 touches new code
#   6. npm run build
#   7. pm2 reload kolmatrix --update-env  (zero-downtime)
#   8. scripts/healthcheck.sh — 5× / 3s retry against /api/health
#   9. healthcheck fail → scripts/rollback.sh, exit 1
#
# `set -e` means any step's non-zero exit halts the deploy. The one
# explicit `|| { rollback.sh; exit 1; }` is scoped to the healthcheck
# because we want deterministic "reload drops traffic → revert" handling
# rather than `set -e`'s abrupt bail.
#
# Env expected from the workflow:
#   GIT_SHA        — commit to deploy (`${{ github.sha }}`)
#   SKIP_BACKUP    — "true" | "false" (workflow input)
#
# Spec: docs/specs/BI2-deployment-automation-spec.md §F003

set -euo pipefail

: "${REPO_DIR:=/opt/kolmatrix}"
: "${GIT_SHA:=}"
: "${SKIP_BACKUP:=false}"

cd "$REPO_DIR"

echo "── 1/8  recording current HEAD"
PREV_SHA=$(git rev-parse HEAD)
echo "$PREV_SHA" > /tmp/prev-sha
echo "   prev SHA = $PREV_SHA"

echo "── 2/8  pre-deploy DB backup (SKIP_BACKUP=$SKIP_BACKUP)"
if [[ "$SKIP_BACKUP" != "true" ]]; then
  "$REPO_DIR/scripts/backup-db.sh"
else
  echo "   ⚠️  backup skipped by workflow input — NOT recommended"
fi

echo "── 3/8  git fetch + checkout $GIT_SHA"
git fetch --all --prune
git checkout "${GIT_SHA:-origin/main}"

echo "── 4/8  npm ci"
npm ci --production=false

echo "── 5/8  prisma migrate deploy"
npx prisma migrate deploy

echo "── 6/8  next build"
npm run build

echo "── 7/8  pm2 reload kolmatrix (zero-downtime)"
pm2 reload kolmatrix --update-env

echo "── 8/8  healthcheck"
if "$REPO_DIR/scripts/healthcheck.sh"; then
  echo "✅ Deploy successful: $GIT_SHA"
  exit 0
fi

echo "❌ Post-reload healthcheck failed — invoking rollback"
"$REPO_DIR/scripts/rollback.sh" || true
exit 1
