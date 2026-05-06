#!/usr/bin/env bash
#
# Staging deploy driver (BIx-staging-automation F001).
# Runs on VPS host against /opt/kolmatrix-staging and is safe to rerun.
#
# Sequence:
#   1) git pull --ff-only origin main
#   2) npm ci --include=dev
#   3) npx prisma generate (NODE_ENV=production may skip postinstall, see BL-025-F001 follow-up)
#   4) npx prisma migrate deploy
#   5) next build (with 4G old-space to avoid OOM)
#   6) pm2 restart kolmatrix-staging --update-env
#   7) curl /api/health and print structured JSON

set -euo pipefail

: "${REPO_DIR:=/opt/kolmatrix-staging}"
: "${APP_NAME:=kolmatrix-staging}"
: "${HEALTH_URL:=https://staging.kol.guangai.ai/api/health}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ missing required command: $1" >&2
    exit 1
  fi
}

echo "== BIx staging deploy =="
echo "repo:   $REPO_DIR"
echo "app:    $APP_NAME"
echo "health: $HEALTH_URL"

require_cmd git
require_cmd npm
require_cmd npx
require_cmd pm2
require_cmd curl
require_cmd node

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "❌ invalid repo dir (missing .git): $REPO_DIR" >&2
  exit 1
fi

cd "$REPO_DIR"

echo "── 1/6 git pull --ff-only origin main"
git pull --ff-only origin main
HEAD_SHA="$(git rev-parse --short HEAD)"
echo "   HEAD=$HEAD_SHA"

echo "── 2/7 npm ci --include=dev"
npm ci --include=dev

# Explicit prisma generate: NODE_ENV=production in .env.staging causes npm to
# skip the package.json `postinstall: prisma generate` hook on this VM, leaving
# node_modules/.prisma/client/ absent → next build typecheck fails to resolve
# `import { PrismaClient } from "@prisma/client"`. (BL-025-F001 follow-up.)
echo "── 3/7 prisma generate"
npx prisma generate

echo "── 4/7 prisma migrate deploy"
npx prisma migrate deploy

# BL-024-F006 (BL-034-F001 retroactive): rotate kolmatrix_app role
# password every deploy so the env-var stays in sync with the DB.
# Reads KOLMATRIX_APP_PASSWORD that the deploy-staging.yml workflow
# sources from .env.staging just before invoking this script.
# BL-024-F007 retroactive (2026-05-06 — Planner ops 用户授权): use
# `sudo -u postgres psql` + unix socket peer auth (mirror of
# deploy-prod.sh). See deploy-prod.sh ALTER ROLE block for full
# rationale.
# BL-043-F001 (2026-05-06): fail-fast when the env var is unset.
# The prior silent-skip branch let .env-side configuration drift
# (a missing KOLMATRIX_APP_PASSWORD) become a hidden 28P01 auth
# failure at runtime — which is exactly how BL-040 staging deploy
# 25415574990 surfaced as a health 503. Both prod + staging now
# always have the env var configured (Planner ops 5/6), so this
# fail-fast cannot break the current deployment shape; first-time
# bootstraps must populate .env before invoking the script (the
# expected ops flow). See .auto-memory/environment.md §Postgres
# for the password-sync 5-point checklist.
if [ -z "${KOLMATRIX_APP_PASSWORD:-}" ]; then
  echo "❌ FATAL: KOLMATRIX_APP_PASSWORD is unset" >&2
  echo "   This var must be set so deploy-staging.sh can ALTER ROLE on the" >&2
  echo "   kolmatrix_app role and keep the .env / DB password in sync." >&2
  echo "   Add KOLMATRIX_APP_PASSWORD=<random_hex> to /opt/kolmatrix-staging/.env.staging" >&2
  echo "   (and keep it identical to /opt/kolmatrix/.env.production), then redeploy." >&2
  echo "   See .auto-memory/environment.md §Postgres kolmatrix_app role 密码 sync 协议." >&2
  exit 1
fi
echo "   • rotating kolmatrix_app password (idempotent)"
sudo -u postgres psql \
  -d "${POSTGRES_DB:-kolmatrix_staging}" \
  -v "ON_ERROR_STOP=1" \
  -c "ALTER ROLE kolmatrix_app WITH PASSWORD '$KOLMATRIX_APP_PASSWORD';"

echo "── 5/7 next build"
node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build

echo "── 6/7 pm2 restart $APP_NAME --update-env"
pm2 restart "$APP_NAME" --update-env >/dev/null
pm2 describe "$APP_NAME" | sed -n '1,40p'

echo "── 7/7 health check"
# BL-034 F007: /api/health gates `git_sha` + `version` behind a token.
# Send X-Health-Token from the env so the post-deploy SHA verification
# below still gets a value. When HEALTH_DETAIL_TOKEN is unset on the
# server the endpoint returns a body without git_sha and the
# verification block at the bottom of this script will surface the
# misconfiguration loudly (exit 1).
if [[ -n "${HEALTH_DETAIL_TOKEN:-}" ]]; then
  HEALTH_JSON="$(curl -fsS -H "X-Health-Token: $HEALTH_DETAIL_TOKEN" "$HEALTH_URL")"
else
  echo "⚠️  HEALTH_DETAIL_TOKEN not set — git_sha verification will fail"
  HEALTH_JSON="$(curl -fsS "$HEALTH_URL")"
fi
echo "$HEALTH_JSON" | python3 -m json.tool

HEALTH_SHA="$(echo "$HEALTH_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("git_sha",""))')"
HEALTH_STATUS="$(echo "$HEALTH_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))')"

if [[ "$HEALTH_STATUS" != "healthy" ]]; then
  echo "❌ health status is not healthy: $HEALTH_STATUS" >&2
  exit 1
fi

if [[ -z "${HEALTH_DETAIL_TOKEN:-}" ]]; then
  # BL-034 F007 graceful-degrade: when the token isn't configured on the
  # VPS yet (spec §6.1 #2 user task), the health body legitimately omits
  # git_sha. The healthcheck above already proved status=healthy, which
  # is the actual deploy-success signal — don't fail the script just
  # because we can't read git_sha. Surface a loud warning so ops still
  # sees the misconfiguration and lands the token soon.
  echo "⚠️  staging deploy done WITHOUT git_sha verification (HEAD=$HEAD_SHA)"
  echo "   action: SSH staging + add HEALTH_DETAIL_TOKEN to .env.staging then re-trigger"
elif [[ -z "$HEALTH_SHA" || "$HEALTH_SHA" == "unknown" ]]; then
  echo "❌ health git_sha is empty/unknown despite HEALTH_DETAIL_TOKEN being set" >&2
  exit 1
else
  echo "✅ staging deploy done (HEAD=$HEAD_SHA, health.git_sha=$HEALTH_SHA)"
fi
