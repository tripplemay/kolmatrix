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
#   8b. ensure durable /etc/cron.d/kolmatrix-kpi-snapshot (+ self-heal
#       backup-retention) — BL-107-F004 / BL-106, rebuilt every deploy so a
#       VM reset can't drop the KPI snapshot schedule
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

# F001: rotate kolmatrix_app role password on every deploy (idempotent).
# Reads KOLMATRIX_APP_PASSWORD from .env.production via the SSH workflow's
# `set -a; source .env.production; set +a` (added in the GH Actions step).
# BL-024-F007 retroactive (2026-05-06 — Planner ops 用户授权): use
# `sudo -u postgres psql` + unix socket peer auth instead of PGPASSWORD
# over TCP. .env never had POSTGRES_SUPERUSER_PASSWORD configured, so
# the prior PGPASSWORD path silently fell back to empty and psql
# prompted for an interactive password — fail in GH Actions
# non-interactive shell. `sudo -u postgres` requires passwordless sudo
# for the SSH user (configured per environment.md "sudo passwordless").
# The postgres OS user owns the cluster and can ALTER ROLE on any role.
# BL-043-F001 (2026-05-06): fail-fast when the env var is unset.
# Mirrors deploy-staging.sh — the prior silent-skip branch let
# configuration drift become a hidden 28P01 auth failure (same root
# cause as the BL-040 staging deploy 25415574990 health 503). Prod
# always has KOLMATRIX_APP_PASSWORD configured, so this cannot break
# the current deployment; first-time bootstraps must populate .env
# before deploying (the expected ops flow).
if [ -z "${KOLMATRIX_APP_PASSWORD:-}" ]; then
  echo "❌ FATAL: KOLMATRIX_APP_PASSWORD is unset" >&2
  echo "   This var must be set so deploy-prod.sh can ALTER ROLE on the" >&2
  echo "   kolmatrix_app role and keep the .env / DB password in sync." >&2
  echo "   Add KOLMATRIX_APP_PASSWORD=<random_hex> to /opt/kolmatrix/.env.production" >&2
  echo "   (and keep it identical to /opt/kolmatrix-staging/.env.staging), then redeploy." >&2
  echo "   See .auto-memory/environment.md §Postgres kolmatrix_app role 密码 sync 协议." >&2
  exit 1
fi
echo "   • rotating kolmatrix_app password (idempotent)"
sudo -u postgres psql \
  -d "${POSTGRES_DB:-kolmatrix}" \
  -v "ON_ERROR_STOP=1" \
  -c "ALTER ROLE kolmatrix_app WITH PASSWORD '$KOLMATRIX_APP_PASSWORD';"

echo "── 7/9  next build"
# Node default old-gen heap is 2 GB; the TypeScript-check pass on the
# current codebase + Next 16 webpack pipeline OOMs at ~2 GB.
# NODE_OPTIONS prefix didn't reach Next's worker fork through
# appleboy/ssh-action; invoke node directly so --max-old-space-size
# lands in the parent's execArgv and child workers inherit it.
#
# BL-067 fix-round 1 (2026-05-15 reviewer blocker) — force webpack to
# avoid Next.js 16.2.4 Turbopack production-build bug. `next build`
# without --webpack defaults to Turbopack on 16.2.x, which emits a
# .next/build/ dir + .next/turbopack 0-byte sentinel but does NOT
# write .next/BUILD_ID. Then server.js bootstraps `next({ dev: false })`
# → app.prepare() throws "Could not find a production build in the .next
# directory" (https://nextjs.org/docs/messages/production-start-no-build-id).
# Symptom: per-page chunks 404 with text/plain "Not found" (PM2 keeps the
# prior worker alive because the new one crashes at boot).
# Wipe stale Turbopack outputs so a partial Turbopack pass from an earlier
# deploy can't poison the webpack output (cache/ stays for speed).
rm -rf .next/build .next/turbopack .next/static/[A-Za-z0-9]*
node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build --webpack

echo "── 8/9  pm2 reload kolmatrix (zero-downtime)"
pm2 reload kolmatrix --update-env

# BL-107-F004 (BL-106) — ensure the durable KPI-snapshot cron exists and is
# rebuilt on EVERY deploy so a VM reset can't silently drop it. Root cause
# this fixes: prod had no KPI cron at all → `kpi_daily_snapshot` sat empty
# (count=0) → the dashboard KPI trend chips were permanently "—". Written to
# /etc/cron.d/ (system cron survives reboot + VM-rebuild) — unlike a
# `crontab -e` entry, which was lost on the 2026-06-07 reset (same lesson as
# backup-retention). Every sudo write is wrapped in `if … ; then` so `set -e`
# is suspended and a cron hiccup never fails an otherwise-healthy deploy;
# Codex L2 verifies the file + a manual run post-deploy.
echo "── ensure durable cron.d (KPI snapshot + backup-retention self-heal)"

# Pre-create the append-only logs owned by the cron user so the first
# `tee -a` from cron (running as tripplezhou) can open them under the
# root-owned /var/log dir.
sudo touch /var/log/kolmatrix-kol-sync.log /var/log/kolmatrix-kpi-snapshot.log 2>/dev/null || true
sudo chown tripplezhou:tripplezhou /var/log/kolmatrix-kol-sync.log /var/log/kolmatrix-kpi-snapshot.log 2>/dev/null || true

# Single-rooted schedule: one line runs kol-sync:daily then chains
# kpi-snapshot:daily via && (so the KPI counts already include this
# morning's fresh sync). 00:30 UTC = 08:30 BJ, matching the prior kol-sync
# timing (kpi-snapshot-runbook.md §Cron line). This file supersedes the
# legacy kol-sync-only entry.
if sudo tee /etc/cron.d/kolmatrix-kpi-snapshot >/dev/null <<'CRON'; then
# /etc/cron.d/kolmatrix-kpi-snapshot — BL-106 (managed by deploy-prod.sh; idempotent, rebuilt every deploy)
# Daily KOL sync ⇒ KPI snapshot, single-rooted at 00:30 UTC (08:30 BJ).
30 0 * * * tripplezhou cd /opt/kolmatrix && npm run kol-sync:daily 2>&1 | tee -a /var/log/kolmatrix-kol-sync.log && npm run kpi-snapshot:daily 2>&1 | tee -a /var/log/kolmatrix-kpi-snapshot.log
CRON
  sudo chmod 0644 /etc/cron.d/kolmatrix-kpi-snapshot
  # The new file now owns the kol-sync schedule too — drop the legacy
  # kol-sync-only file so kol-sync isn't double-scheduled. `rm -f` is a
  # no-op if that file was already lost on a VM reset; kol-sync is never
  # dropped because the new file runs it first.
  sudo rm -f /etc/cron.d/kolmatrix-kol-sync
  echo "   ✓ /etc/cron.d/kolmatrix-kpi-snapshot (kol-sync ⇒ kpi-snapshot, 00:30 UTC)"
else
  echo "   ⚠️  could not write kpi-snapshot cron (non-fatal; install manually — see docs/dev/kpi-snapshot-runbook.md)"
fi

# Self-heal the backup-retention cron in the same pass (same VM-reset
# lesson: it vanished on 2026-06-07, letting backups grow to 1.6G).
if sudo tee /etc/cron.d/kolmatrix-backup-retention >/dev/null <<'CRON'; then
# /etc/cron.d/kolmatrix-backup-retention — BI2 (managed by deploy-prod.sh; idempotent)
# Prune DB dumps older than 14 days nightly at 04:00 local.
0 4 * * * root find /opt/kolmatrix-backups -name 'db-*.sql.gz' -mtime +14 -delete
CRON
  sudo chmod 0644 /etc/cron.d/kolmatrix-backup-retention
  echo "   ✓ /etc/cron.d/kolmatrix-backup-retention"
else
  echo "   ⚠️  could not write backup-retention cron (non-fatal; install manually — see docs/dev/deployment-runbook.md §Backups)"
fi

echo "── 9/9  healthcheck"
if "$REPO_DIR/scripts/healthcheck.sh"; then
  echo "✅ Deploy successful: $GIT_SHA"
  exit 0
fi

echo "❌ Post-reload healthcheck failed — invoking rollback"
"$REPO_DIR/scripts/rollback.sh" || true
exit 1
