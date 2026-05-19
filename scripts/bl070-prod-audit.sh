#!/usr/bin/env bash
#
# BL-070-F008 · Prod ops post-deploy audit (read-only, idempotent)
#
# 用法（推荐：本机远程跑，避免登录 prod 后再敲命令）：
#   ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'
#
# 本地直跑（在 prod VPS 上）：
#   cd /opt/kolmatrix && bash scripts/bl070-prod-audit.sh
#
# 跑两次：
#   1. prod deploy 完成后立即 → 覆盖 §1-§7（git_sha + 4 路由 active + 7 老路由 404 +
#      5 locale routable + 6 BL-066 unmount 组件残余 + i18n deprecated keys 残余 +
#      kol_campaign.source 分布）
#   2. deploy 后 ~24h → 覆盖 §8（pm2 logs 无 BL-070 相关错误）
#
# 仅 curl + grep + pm2 logs read + sudo psql SELECT，零修改风险。
#
# 输出：分 section + colored PASS/FAIL，可直接 copy-paste 到
# docs/test-reports/BL-070-signoff-2026-05-19.md。
#
# 配套：
#   - features.json F008 acceptance (12 项 checklist)
#   - docs/specs/BL-070-reach-insight-cleanup-spec.md §10
#   - scripts/bl066-f009-prod-audit.sh (template + 同口径对照)

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

section "[1] /api/health git_sha on origin/main (== HEAD or recent ancestor)"
# 同 bl066-f009 §1 模式 — accept exact match OR ancestor within last 10 commits.
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
RECENT_MAIN_LOG=$(git --no-pager log --color=never --oneline -10 origin/main 2>/dev/null || echo "")
if [ "$HEAD" = "$HEALTH_SHA" ]; then
  green "✓ git_sha=$HEAD matches health.git_sha=$HEALTH_SHA exactly"
  PASS=$((PASS + 1))
elif [ "$HEALTH_SHA" != "?" ] && echo "$RECENT_MAIN_LOG" | grep -q "^$HEALTH_SHA"; then
  COMMITS_BEHIND=$(git rev-list --count "${HEALTH_SHA}..origin/main" 2>/dev/null || echo "?")
  green "✓ health.git_sha=$HEALTH_SHA is $COMMITS_BEHIND commit(s) behind origin/main HEAD=$HEAD (ops-only follow-up OK)"
  PASS=$((PASS + 1))
else
  red "✗ git_sha mismatch: health.git_sha=$HEALTH_SHA NOT on origin/main last 10 commits"
  FAIL=$((FAIL + 1))
fi

section "[2] 4 new IA routes active (logged-out auth gate 307 OK)"
# Spec §10 checklist #1 — 4 路由全 active. Logged-out curl returns 307→/login
# for protected routes, which means the route is registered + protected (correct
# state). 404 would mean the route file is missing.
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

section "[3] 7 legacy routes return 404 (BL-070-F004 redirect retired)"
# Spec §10 checklist #2 — 7 老路由全 404. BL-070-F004 emptied IA_REDIRECT_RULES;
# legacy paths now hit the framework 404 directly.
# /campaigns/new is handled separately (Next.js [id] catch-all returns 200 with
# not-found body; the contract is "no redirect to /brief" not strict 404).
for path in /en/dashboard /en/discovery /en/database /en/outreach /en/reports /en/weekly-report /en/knowledge-base; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$STATUS" = "404" ]; then
    green "✓ ${path} → HTTP 404"
    PASS=$((PASS + 1))
  else
    red "✗ ${path} → HTTP $STATUS (expect 404)"
    FAIL=$((FAIL + 1))
  fi
done

section "[4] 5 locale UI sanity — 4 routes routable per locale"
# Spec §10 checklist #3 — 5 locale UI 全 PASS (mount-level smoke; deep UI checks
# happen via the 4 e2e flow specs in CI).
for locale in en zh ja ko es; do
  ALL_OK=1
  for path in /brief /match /reach /insight; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/${locale}${path}")
    if [ "$STATUS" != "200" ] && [ "$STATUS" != "302" ] && [ "$STATUS" != "307" ]; then
      red "  ✗ /${locale}${path} → HTTP $STATUS"
      ALL_OK=0
    fi
  done
  if [ "$ALL_OK" -eq 1 ]; then
    green "✓ /${locale}/{brief,match,reach,insight} all routable"
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
done

section "[5] 6 BL-066 unmount components fully gone (F005 + F004 cleanup)"
# Spec §10 invariant — BL-070-F005 git rm 6 files; residual imports/files are
# regressions.
RESIDUAL_FILES=$(find src -type f \( \
  -name 'CampaignHealthCard.tsx' -o \
  -name 'ActivityTimelineCard.tsx' -o \
  -name 'EmailPerformanceChart.tsx' -o \
  -name 'EmailPerformanceChartImpl.tsx' -o \
  -name 'CampaignRevenueRecorder.tsx' -o \
  -name 'CampaignStatusController.tsx' \
\) 2>/dev/null | grep -v 'features/dashboard/' || true)
# features/dashboard/EmailPerformanceChart.tsx + Impl.tsx are intentional (BL-066
# kept the dashboard-side same-name component; F005 only deleted campaigns/[id]
# versions).
if [ -z "$RESIDUAL_FILES" ]; then
  green "✓ no BL-066 unmount component files in campaigns/[id]/"
  PASS=$((PASS + 1))
else
  red "✗ BL-066 unmount component files still in src/:"
  echo "$RESIDUAL_FILES"
  FAIL=$((FAIL + 1))
fi
# detail-insights loader (F005 deleted)
if [ ! -f src/lib/campaigns/detail-insights.ts ]; then
  green "✓ src/lib/campaigns/detail-insights.ts gone"
  PASS=$((PASS + 1))
else
  red "✗ src/lib/campaigns/detail-insights.ts still present"
  FAIL=$((FAIL + 1))
fi

section "[6] 3 legacy route directories fully gone (F004 cleanup)"
# Spec §10 invariant — BL-070-F004 git rm /dashboard + /knowledge-base + /campaigns/new
for dir in 'src/app/[locale]/(app)/dashboard' \
           'src/app/[locale]/(app)/knowledge-base' \
           'src/app/[locale]/(app)/campaigns/new' \
           'src/app/[locale]/(app)/outreach' \
           'src/app/[locale]/(app)/reports' \
           'src/app/[locale]/(app)/discovery' \
           'src/app/[locale]/(app)/database'; do
  if [ ! -d "$dir" ]; then
    green "✓ $dir gone"
    PASS=$((PASS + 1))
  else
    red "✗ $dir still present"
    FAIL=$((FAIL + 1))
  fi
done

section "[7] i18n: 0 _deprecated_by_* marker residue (F005 cleanup)"
# Spec §10 checklist #12 — i18n-locale-coverage parity 8/8 PASS depends on
# 0 marker residue.
for locale in en zh ja ko es; do
  COUNT=$(grep -c "_deprecated_by_" "messages/${locale}.json" 2>/dev/null || echo "0")
  if [ "$COUNT" = "0" ]; then
    green "✓ messages/${locale}.json: 0 _deprecated_by_* markers"
    PASS=$((PASS + 1))
  else
    red "✗ messages/${locale}.json: $COUNT _deprecated_by_* markers residue"
    FAIL=$((FAIL + 1))
  fi
done

section "[8] middleware: IA_REDIRECT_RULES empty (F004 cleanup)"
# BL-070-F004 cleared the rule list. Any non-empty array means a regression
# (re-introduced redirect) that the e2e cleanup spec would catch.
COUNT=$(grep -cE "pattern:\s*/" src/middleware-helpers.ts 2>/dev/null || echo "0")
if [ "$COUNT" = "0" ]; then
  green "✓ src/middleware-helpers.ts IA_REDIRECT_RULES has 0 rule entries"
  PASS=$((PASS + 1))
else
  red "✗ src/middleware-helpers.ts has $COUNT IaRedirectRule entries (expected 0)"
  FAIL=$((FAIL + 1))
fi

section "[9] visual baseline parity — 25 PNGs in tests/screenshots/baseline/"
# F007 final state. visual-baselines-shape.test.ts EXPECTED_BASELINES has 25
# entries (post-F007 cleanup); if the directory has more or fewer the shape
# test fails in CI.
COUNT=$(ls tests/screenshots/baseline/*.png 2>/dev/null | wc -l)
if [ "$COUNT" = "25" ]; then
  green "✓ 25 visual baseline PNGs (matches F007 final state)"
  PASS=$((PASS + 1))
else
  yellow "⚠ visual baseline count = $COUNT (expected 25 per F007 EXPECTED_BASELINES)"
  WARN=$((WARN + 1))
fi

section "[10] reach + insight i18n placeholder ns present in 5 locale"
# F007 added reach.{pageTitle,subtitle} + insight.{pageTitle,subtitle,tabs}.
for locale in en zh ja ko es; do
  REACH_OK=$(python3 -c "import json; d=json.load(open('messages/${locale}.json')); print(1 if d.get('reach',{}).get('pageTitle') and d.get('insight',{}).get('pageTitle') and d.get('insight',{}).get('tabs',{}).get('dashboard') else 0)")
  if [ "$REACH_OK" = "1" ]; then
    green "✓ messages/${locale}.json: reach + insight ns present"
    PASS=$((PASS + 1))
  else
    red "✗ messages/${locale}.json: reach or insight ns incomplete"
    FAIL=$((FAIL + 1))
  fi
done

section "[11] pm2 logs since deploy — no NEW BL-070-related errors"
# Run immediately + ~24h. Patterns: 4 IA routes runtime / missing-message
# warnings on the deleted i18n namespaces / route 5xx.
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  ERR=$(pm2 logs "$APP_NAME" --lines 500 --nostream --raw 2>&1 \
    | grep -iE "/reach|/insight|/brief|missing.*translation.*(reach|insight|brief)\.|insight.*(InsightTabs|DashboardContent)|reach.*OutreachComposer.*error|UUID_RE" \
    | grep -vE "info|debug|trace" \
    | head -20 || true)
  if [ -z "$ERR" ]; then
    green "✓ pm2 logs last 500 lines: no BL-070-related errors"
    PASS=$((PASS + 1))
  else
    yellow "⚠ pm2 logs found possibly BL-070-related lines (review manually):"
    echo "$ERR"
    WARN=$((WARN + 1))
  fi
else
  yellow "⚠ pm2 process '$APP_NAME' not found"
  WARN=$((WARN + 1))
fi

section "[12] AI cost audit — BL-070 0 incremental cost expected"
# Spec §10 — BL-070 没有引入新 AI Action; F002 仅 customize.ts + topic-cloud.ts
# 走 runAigcAction SDK (复用 BL-067 已有的 actionId)。本批次 prod 增量成本 ≈ 0.
# 验近 24h aigcgateway cost 没有异常飙升即可。
if command -v sudo > /dev/null 2>&1; then
  COST_24H=$(sudo -u postgres psql -d kolmatrix -tA -c \
    "SELECT COALESCE(SUM((payload->>'cost_usd')::numeric), 0) FROM audit_log WHERE action LIKE 'ai.%' AND created_at > NOW() - INTERVAL '24 hours';" \
    2>/dev/null || echo "?")
  if [ "$COST_24H" != "?" ]; then
    echo "AI 24h cost (sum cost_usd from ai.* audit rows): \$$COST_24H"
    # Spec §10 cost cap < \$5/day/tenant; total across all tenants typically < \$5
    if awk "BEGIN { exit !($COST_24H < 5.0) }" 2>/dev/null; then
      green "✓ 24h AI cost \$$COST_24H < \$5 (cost cap NOT breached at platform level)"
      PASS=$((PASS + 1))
    else
      yellow "⚠ 24h AI cost \$$COST_24H ≥ \$5; per-tenant cap may still be OK — inspect by tenant_id"
      WARN=$((WARN + 1))
    fi
  else
    yellow "⚠ Postgres unreachable / no sudo — skip cost audit"
    WARN=$((WARN + 1))
  fi
else
  yellow "⚠ sudo unavailable — skip Postgres cost audit"
  WARN=$((WARN + 1))
fi

section "Summary"
echo "PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo ""
echo "Manual UI spot checks (not script-automatable):"
echo "  - §10 checklist #5 4 路由 e2e suite 全 PASS → check CI run for the prod commit"
echo "  - §10 checklist #6 视觉 baseline 全 PASS → check CI E2E job"
echo "  - §10 checklist #7 a11y ≥90 → Lighthouse CI / manual audit"
echo "  - §10 checklist #8 Lighthouse perf ≥80 → Lighthouse CI / manual audit"
echo "  - §10 checklist #9 ≥5 marketer dogfood spot check → user-driven test session"
echo "  - §10 checklist #10 24h 监控数据正常 → re-run this script ~24h after deploy"
echo ""
if [ "$FAIL" -gt 0 ]; then
  red "FAIL = $FAIL — block prod sign-off"
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  yellow "WARN = $WARN — review before sign-off"
fi
green "All automated checks PASS — proceed to manual checklist items"
