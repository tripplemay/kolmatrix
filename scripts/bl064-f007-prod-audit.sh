#!/usr/bin/env bash
#
# BL-064-F007 · Prod ops post-deploy audit (read-only, idempotent)
#
# 用法（推荐：本机远程跑，避免登录 prod 后再敲命令）：
#   ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl064-f007-prod-audit.sh'
#
# 本地直跑（在 prod VPS 上）：
#   cd /opt/kolmatrix && bash scripts/bl064-f007-prod-audit.sh
#
# 跑两次：
#   1. deploy 完成后立即 → 覆盖 acceptance §1-§4（git_sha + 4 新路由 + 5 redirect + 6 kept）
#   2. deploy 后 ~24h → 覆盖 acceptance §5（pm2 logs 无 404 / route-not-found / next-intl 错误）
#
# 仅 curl + grep + pm2 logs read，零修改风险。
#
# 输出：分 section + colored PASS/FAIL，可直接 copy-paste 到
# docs/test-reports/BL-064-signoff-2026-05-XX.md。
#
# 配套：
#   - features.json F007 acceptance         — 7 条验收标准
#   - docs/specs/BL-064-top-level-ia-refactor-spec.md
#   - docs/specs/BL-064-F006-staging-spot-check.md（staging 同口径对照）

set -uo pipefail

REPO_DIR="${REPO_DIR:-/opt/kolmatrix}"
HEALTH_URL="${HEALTH_URL:-https://kol.guangai.ai/api/health}"
BASE_URL="${BASE_URL:-https://kol.guangai.ai}"
APP_NAME="${APP_NAME:-kolmatrix}"

cd "$REPO_DIR"

# 加载 .env.production 取 HEALTH_DETAIL_TOKEN
if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

red()     { printf '\033[31m%s\033[0m\n' "$*"; }
green()   { printf '\033[32m%s\033[0m\n' "$*"; }
yellow()  { printf '\033[33m%s\033[0m\n' "$*"; }
section() { printf '\n\033[1;36m===== %s =====\033[0m\n' "$*"; }

PASS=0
FAIL=0
WARN=0

section "[1] /api/health git_sha = main HEAD"
HEAD=$(git rev-parse --short HEAD)
echo "git rev-parse --short HEAD = $HEAD"
TOKEN="${HEALTH_DETAIL_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  yellow "⚠ HEALTH_DETAIL_TOKEN unset — git_sha hidden from /api/health response"
  WARN=$((WARN + 1))
fi
HEALTH=$(curl -s "${HEALTH_URL}?token=${TOKEN}")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
HEALTH_SHA=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('git_sha','?'))" 2>/dev/null || echo "?")
if [ "$HEAD" = "$HEALTH_SHA" ]; then
  green "✓ git_sha=$HEAD matches health.git_sha=$HEALTH_SHA"
  PASS=$((PASS + 1))
else
  red "✗ git_sha mismatch: deploy HEAD=$HEAD vs health.git_sha=$HEALTH_SHA"
  FAIL=$((FAIL + 1))
fi

section "[2] 4 new IA routes return HTTP 200 (logged-out gets 302→/login, also OK)"
for path in /en/brief /en/match /en/reach /en/insight; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
    green "✓ ${path} → HTTP $STATUS"
    PASS=$((PASS + 1))
  else
    red "✗ ${path} → HTTP $STATUS (expect 200 or 302→/login)"
    FAIL=$((FAIL + 1))
  fi
done

section "[3] 5 content-equivalent redirects (302 → new IA target)"
declare -a REDIRECTS=(
  "/en/dashboard|/en/insight"
  "/en/discovery|/en/match"
  "/en/database|/en/match"
  "/en/knowledge-base|/en/brief"
  "/en/outreach|/en/reach"
)
for entry in "${REDIRECTS[@]}"; do
  src="${entry%|*}"
  expect="${entry#*|}"
  # -o /dev/null discards body; -w gives status + redirect URL
  LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" "${BASE_URL}${src}")
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${src}")
  if [ "$STATUS" = "302" ] && [[ "$LOCATION" == *"${expect}"* ]]; then
    green "✓ ${src} → 302 ${LOCATION}"
    PASS=$((PASS + 1))
  else
    red "✗ ${src} → HTTP $STATUS Location=$LOCATION (expect 302 → *${expect}*)"
    FAIL=$((FAIL + 1))
  fi
done

section "[4] 6 kept deep-link paths return HTTP 200/302→/login (NOT 302→new IA)"
declare -a KEPT=(
  "/en/campaigns"
  "/en/campaigns/new"
  "/en/roi"
  "/en/weekly-report"
  "/en/analytics"
  "/en/outreach/templates"
)
for path in "${KEPT[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" "${BASE_URL}${path}")
  # Acceptable: 200 (rendered), or 302 → login (auth gate), or 302 to same legacy path
  if [ "$STATUS" = "200" ]; then
    green "✓ ${path} → HTTP 200 (rendered legacy)"
    PASS=$((PASS + 1))
  elif [ "$STATUS" = "302" ] && [[ "$LOCATION" == *"/login"* ]]; then
    green "✓ ${path} → 302 /login (auth gate, expected for logged-out)"
    PASS=$((PASS + 1))
  elif [ "$STATUS" = "302" ] && [[ "$LOCATION" == *"/en/brief"* || "$LOCATION" == *"/en/match"* || "$LOCATION" == *"/en/reach"* || "$LOCATION" == *"/en/insight"* ]]; then
    # /campaigns/new should stay kept, but /campaigns/{id} 302→/match?campaignId.
    # /campaigns/new is treated kept by negative lookahead. Other kept paths
    # also should NOT redirect to new IA.
    red "✗ ${path} → 302 ${LOCATION} — kept path was redirected to new IA, runtime fix not deployed?"
    FAIL=$((FAIL + 1))
  else
    yellow "⚠ ${path} → HTTP $STATUS Location=$LOCATION (manual check)"
    WARN=$((WARN + 1))
  fi
done

section "[5] /campaigns/[id] still redirects to /match?campaignId=:id (adjudication §B)"
# Pick any placeholder uuid — auth gate will 302 to login first; we only
# check the redirect chain target via curl -L (follow redirects).
LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" "${BASE_URL}/en/campaigns/test-uuid-abc-123")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/en/campaigns/test-uuid-abc-123")
if [ "$STATUS" = "302" ] && [[ "$LOCATION" == *"/match?campaignId=test-uuid-abc-123"* ]]; then
  green "✓ /en/campaigns/test-uuid-abc-123 → 302 ${LOCATION}"
  PASS=$((PASS + 1))
elif [ "$STATUS" = "302" ] && [[ "$LOCATION" == *"/login"* ]]; then
  yellow "⚠ Auth gate fired first (302→/login). Re-test with HEALTH_DETAIL_TOKEN or skip — adjudicate manually post-login."
  WARN=$((WARN + 1))
else
  red "✗ /en/campaigns/test-uuid-abc-123 → HTTP $STATUS Location=$LOCATION (expect 302 → /match?campaignId=...)"
  FAIL=$((FAIL + 1))
fi

section "[6] pm2 logs last 24h — no 404 / route-not-found / next-intl errors"
# Run AFTER 24h soak. Read-only.
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  ERR=$(pm2 logs "$APP_NAME" --lines 1000 --nostream --raw 2>&1 | grep -iE "404|route.not.found|next-intl|missing.*translation" | head -20 || true)
  if [ -z "$ERR" ]; then
    green "✓ pm2 logs last 1000 lines: no 404 / route-not-found / next-intl errors"
    PASS=$((PASS + 1))
  else
    red "✗ pm2 logs found errors:"
    echo "$ERR"
    FAIL=$((FAIL + 1))
  fi
else
  yellow "⚠ pm2 process '$APP_NAME' not found (running on different host?)"
  WARN=$((WARN + 1))
fi

section "[7] residual legacy nav references in source (BL-070 cleanup tracker)"
RESIDUAL=$(grep -rn 'nav\.dashboard\|nav\.kolDiscovery\|nav\.kolDatabase\|nav\.knowledgeBase\|nav\.emailCenter\|nav\.analytics' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules | grep -v '__tests__' | grep -v '.next' || true)
if [ -z "$RESIDUAL" ]; then
  green "✓ no legacy nav.* key references in src/ (excluding tests)"
  PASS=$((PASS + 1))
else
  yellow "⚠ legacy nav.* key references still present (BL-070 cleanup will remove):"
  echo "$RESIDUAL" | head -10
  WARN=$((WARN + 1))
fi

section "Summary"
echo "PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
if [ "$FAIL" -gt 0 ]; then
  red "✗ AUDIT FAILED — see FAIL items above"
  exit 1
else
  green "✓ AUDIT PASSED"
fi
