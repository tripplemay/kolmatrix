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
#   5. npx prisma generate (NODE_ENV=production skips postinstall — BL-025-F001 follow-up)
#   6. npx prisma migrate deploy — failure aborts before PM2 touches new code
#   7. npm run build
#   8. pm2 reload kolmatrix --update-env  (zero-downtime)
#   9. scripts/healthcheck.sh — 5× / 3s retry against /api/health
#  10. healthcheck fail → scripts/rollback.sh, exit 1
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

echo "── 4/9  npm ci"
npm ci --production=false

# Explicit prisma generate: NODE_ENV=production on the VPS makes npm skip the
# package.json `postinstall: prisma generate` hook, leaving node_modules/.prisma/client/
# absent → next build typecheck fails to resolve `@prisma/client`. (BL-025-F001 follow-up;
# previously masked because earlier batches didn't add new model fields imported at build time.)
echo "── 5/9  prisma generate"
npx prisma generate

echo "── 6/9  prisma migrate deploy"
npx prisma migrate deploy

echo "── 7/9  next build"
# Node default old-gen heap is 2 GB; the TypeScript-check pass on the
# current codebase + Next 16 Turbopack pipeline OOMs at ~2 GB.
# NODE_OPTIONS prefix didn't reach Next's worker fork through
# appleboy/ssh-action; invoke node directly so --max-old-space-size
# lands in the parent's execArgv and child workers inherit it.
node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build

echo "── 8/9  pm2 reload kolmatrix (zero-downtime)"
pm2 reload kolmatrix --update-env

echo "── 9/9  healthcheck"
if "$REPO_DIR/scripts/healthcheck.sh"; then
  echo "✅ Deploy successful: $GIT_SHA"
  exit 0
fi

echo "❌ Post-reload healthcheck failed — invoking rollback"
"$REPO_DIR/scripts/rollback.sh" || true
exit 1
