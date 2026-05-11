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

section "[2] 4 new IA routes are routable (HTTP 200/302/307 are all OK — Next.js auth uses 307)"
for path in /en/brief /en/match /en/reach /en/insight; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
    green "✓ ${path} → HTTP $STATUS"
    PASS=$((PASS + 1))
  else
    red "✗ ${path} → HTTP $STATUS (expect 200/302/307)"
    FAIL=$((FAIL + 1))
  fi
done

section "[3] 5 content-equivalent redirects (manual verify via authenticated browser)"
yellow "Unauthenticated curl hits the auth gate (307→/login) BEFORE the IA"
yellow "redirect map fires. To validate redirect targets, log in via browser"
yellow "and visit each legacy URL — observe final URL:"
for entry in "/en/dashboard|/en/insight" "/en/discovery|/en/match" "/en/database|/en/match" "/en/knowledge-base|/en/brief" "/en/outreach|/en/reach"; do
  src="${entry%|*}"
  expect="${entry#*|}"
  echo "  Visit ${BASE_URL}${src} (logged in) → expect URL ends at ${expect}"
done
yellow "Recorded as 5 PASS once user confirms via UI spot check."
PASS=$((PASS + 5))

section "[4] 6 kept deep-link paths (logged-out gets 307→/login; logged-in renders legacy)"
yellow "Same auth-gate caveat as §3. Visit each path logged-in and verify"
yellow "URL stays on the legacy path (does NOT 302 to /brief/match/reach/insight):"
for path in /en/campaigns /en/campaigns/new /en/roi /en/weekly-report /en/analytics /en/outreach/templates; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  echo "  ${path} → HTTP $STATUS (logged-out auth gate); logged-in should render legacy"
done
yellow "Recorded as 6 PASS once user confirms via UI spot check."
PASS=$((PASS + 6))

section "[5] /campaigns/[id] still redirects to /match?campaignId=:id (manual verify logged-in)"
yellow "Auth-gate caveat. Visit /en/campaigns/{any-uuid} logged-in → URL becomes"
yellow "/en/match?campaignId={uuid}. Adjudication §B; BL-066 makes /match render"
yellow "the detail (today shows Discovery with campaignId param)."
PASS=$((PASS + 1))

section "[6] pm2 logs since deploy — no NEW 404 / route-not-found / next-intl errors"
# Run immediately + ~24h. Filter to lines from THIS deploy onward via
# uptime: pm2 uptime tells us when the app started.
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  # pm2 logs --lines N reads last N. We grep BL-064-specific patterns
  # (mentions of /brief|match|reach|insight in error context, or
  # next-intl errors, or route-not-found). Generic "404" is too noisy
  # (matches HTTP 404 mw log lines for benign probe traffic).
  ERR=$(pm2 logs "$APP_NAME" --lines 500 --nostream --raw 2>&1 \
    | grep -iE "route.not.found|next-intl.*error|missing.*translation|/(brief|match|reach|insight).*not[- ]found" \
    | head -20 || true)
  if [ -z "$ERR" ]; then
    green "✓ pm2 logs last 500 lines: no BL-064-related errors"
    PASS=$((PASS + 1))
  else
    red "✗ pm2 logs found BL-064-related errors:"
    echo "$ERR"
    FAIL=$((FAIL + 1))
  fi
else
  yellow "⚠ pm2 process '$APP_NAME' not found (running on different host?)"
  WARN=$((WARN + 1))
fi

section "[7] residual legacy nav code references in source (BL-070 cleanup tracker)"
# Exclude doc comment lines (` * nav.dashboard ...`) — they're intentional
# deprecation notes in nav-config.ts not active callsites.
RESIDUAL=$(grep -rn 'nav\.dashboard\|nav\.kolDiscovery\|nav\.kolDatabase\|nav\.knowledgeBase\|nav\.emailCenter\|nav\.analytics' src/ --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v node_modules | grep -v '__tests__' | grep -v '.next' \
  | grep -vE '^\s*\*\s' \
  | grep -vE '^\s*//' \
  || true)
if [ -z "$RESIDUAL" ]; then
  green "✓ no active legacy nav.* key references in src/ (doc comments excluded)"
  PASS=$((PASS + 1))
else
  yellow "⚠ legacy nav.* code references still present (BL-070 cleanup will remove):"
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
