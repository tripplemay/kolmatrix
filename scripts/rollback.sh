#!/usr/bin/env bash
#
# Last-resort rollback path triggered by scripts/deploy-prod.sh when
# the post-reload healthcheck fails 5× in a row. Reverts the application
# to the SHA recorded at deploy-start (/tmp/prev-sha) via PM2 reload.
#
# Intentionally does NOT roll back the database. If the failed deploy
# ran a migration, the previous app SHA may be incompatible with the
# new schema — that mismatch needs human judgement (apply the migration's
# `-- ROLLBACK:` recipe manually, restore from backup, etc.). Spec §F006.
#
# Exit codes:
#   0 — rollback succeeded, post-rollback healthcheck green
#   1 — prev-sha missing (deploy-prod.sh never ran / never finished step 1)
#   2 — post-rollback healthcheck ALSO failed → MANUAL INTERVENTION REQUIRED
#
# Spec: docs/specs/BI2-deployment-automation-spec.md §F006

set -euo pipefail

: "${REPO_DIR:=/opt/kolmatrix}"
: "${PREV_SHA_FILE:=/tmp/prev-sha}"

if [[ ! -s "$PREV_SHA_FILE" ]]; then
  echo "❌ No previous SHA recorded at $PREV_SHA_FILE — cannot roll back"
  echo "   (deploy-prod.sh records /tmp/prev-sha before any destructive step)"
  exit 1
fi

PREV_SHA=$(cat "$PREV_SHA_FILE")
echo "🔄 Rolling back $REPO_DIR → $PREV_SHA"

cd "$REPO_DIR"
git checkout "$PREV_SHA"
npm ci --production=false
npm run build
pm2 reload kolmatrix --update-env

# Give PM2's cluster handoff a moment before we poll again. The
# healthcheck itself also waits 3s between retries, so 3s of slack
# here is enough to avoid hitting the in-flight reload window.
sleep 3

# Re-run the same healthcheck script. `set -e` is disabled on this
# single line so we can inspect the exit code and emit a louder
# message if rollback itself fails to land.
set +e
/opt/kolmatrix/scripts/healthcheck.sh
HEALTH_EXIT=$?
set -e

if [[ $HEALTH_EXIT -eq 0 ]]; then
  echo "✅ Rollback successful — $PREV_SHA is now serving traffic"
  exit 0
fi

echo "❌ Rollback ALSO failed healthcheck — MANUAL INTERVENTION REQUIRED"
echo "   Follow docs/dev/deployment-runbook.md §Manual rollback from here."
exit 2
