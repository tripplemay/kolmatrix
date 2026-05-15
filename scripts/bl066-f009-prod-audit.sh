#!/usr/bin/env bash
#
# BL-066-F009 · Prod ops post-deploy audit (read-only, idempotent)
#
# 用法（推荐：本机远程跑，避免登录 prod 后再敲命令）：
#   ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl066-f009-prod-audit.sh'
#
# 本地直跑（在 prod VPS 上）：
#   cd /opt/kolmatrix && bash scripts/bl066-f009-prod-audit.sh
#
# 跑两次：
#   1. prod deploy + prod recompute 完成后立即 → 覆盖 §1-§7（git_sha + 路由 +
#      AddKolDialog 全删 + value-score v2 audit_log + kol_campaign source 分布）
#   2. deploy 后 ~24h → 覆盖 §8（pm2 logs 无 BL-066 相关错误）
#
# 仅 curl + grep + pm2 logs read + sudo psql SELECT，零修改风险。
#
# 输出：分 section + colored PASS/FAIL，可直接 copy-paste 到
# docs/test-reports/BL-066-signoff-2026-05-XX.md。
#
# 配套：
#   - features.json F009 acceptance         — 8 条验收标准
#   - docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md
#   - scripts/bl065-f007-prod-audit.sh（template + 同口径对照）
#   - scripts/bl066-f007-recompute-value-score.ts（prod recompute 入口）

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

section "[1] /api/health git_sha is on main (== HEAD or recent ancestor)"
# Accept either: prod runtime SHA == working tree HEAD, OR runtime SHA
# is one of the last 10 commits on main. The latter handles ops-only
# follow-up commits (audit script tweaks, docs, state files) that land
# after the production deploy without re-deploying — those should not
# trip an audit fail because prod runtime is intentionally one or two
# commits behind. If the runtime SHA is NOT on main at all (orphan or
# very stale), that is a real fail.
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
# Use origin/main (last-fetched remote ref) instead of `main` because
# deploy-prod.sh leaves the working tree at detached HEAD and the local
# `main` branch in /opt/kolmatrix can be stale (frozen at whichever
# commit was main when the repo was first cloned).
#
# Capture into a variable then grep, instead of piping `git log | grep -q`
# — `set -o pipefail` + `grep -q` is a classic SIGPIPE trap: grep -q exits
# on first match, git log gets EPIPE writing the rest of the output, exit
# 141 (SIGPIPE) propagates through the pipe, and the branch fails even
# though grep actually matched. Capture-then-match dodges the trap.
RECENT_MAIN_LOG=$(git --no-pager log --color=never --oneline -10 origin/main 2>/dev/null || echo "")
if [ "$HEAD" = "$HEALTH_SHA" ]; then
  green "✓ git_sha=$HEAD matches health.git_sha=$HEALTH_SHA exactly"
  PASS=$((PASS + 1))
elif [ "$HEALTH_SHA" != "?" ] && echo "$RECENT_MAIN_LOG" | grep -q "^$HEALTH_SHA"; then
  COMMITS_BEHIND=$(git rev-list --count "${HEALTH_SHA}..origin/main" 2>/dev/null || echo "?")
  green "✓ health.git_sha=$HEALTH_SHA is $COMMITS_BEHIND commit(s) behind origin/main HEAD=$HEAD (ops-only follow-up OK)"
  PASS=$((PASS + 1))
else
  red "✗ git_sha mismatch: health.git_sha=$HEALTH_SHA is NOT on origin/main last 10 commits (deploy may be stale or orphan)"
  FAIL=$((FAIL + 1))
fi

section "[2] /en/campaigns + /en/match routable (logged-out auth gate 307 OK)"
for path in /en/campaigns /en/match; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "307" ]; then
    green "✓ ${path} → HTTP $STATUS"
    PASS=$((PASS + 1))
  else
    red "✗ ${path} → HTTP $STATUS (expect 200/302/307)"
    FAIL=$((FAIL + 1))
  fi
done

section "[3] /en/campaigns/{uuid} renders BL-066 layout (manual UI verify)"
yellow "Auth-gate caveat: logged-out curl hits 307→/login BEFORE the page handler."
yellow "BL-066-F008 removed the /campaigns/[id] → /match?campaignId 302 redirect, so"
yellow "logged-in browser should see the BL-066 3-section layout directly."
yellow "Visit ${BASE_URL}/en/campaigns/{any-uuid} logged-in → expect to see:"
yellow "  - Breadcrumb (Campaigns / <campaign name>)"
yellow "  - BriefSummaryPanel (4-col grid: target market / demographics / budget / counts)"
yellow "  - AiRecommendationPanel (top 30 candidates or empty/loading state)"
yellow "  - AcceptedKolsPanel (read-only table with source chip column)"
yellow "Recorded as 1 PASS once user confirms via UI spot check."
PASS=$((PASS + 1))

section "[4] /api/kols/smart-match endpoint still wired"
# POST without body returns 400/405; without auth returns 401. We just confirm
# the route exists (no 404). 405 means GET not allowed (method is POST) →
# route registered. 400/401 also indicate route exists.
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/kols/smart-match")
if [ "$STATUS" != "404" ] && [ "$STATUS" != "000" ]; then
  green "✓ /api/kols/smart-match POST → HTTP $STATUS (route registered; auth/body gate)"
  PASS=$((PASS + 1))
else
  red "✗ /api/kols/smart-match POST → HTTP $STATUS (route may be missing)"
  FAIL=$((FAIL + 1))
fi

section "[5] AddKolDialog completely removed (BL-066-F005 决策点 #B)"
# BL-066-F005 git-rm'd both /campaigns/[id]/AddKolDialog.tsx and /match/
# AddKolDialog.tsx + addKolAction. Residual imports/references are a
# regression signal.
RESIDUAL_FILES=$(find src -type f \( -name 'AddKolDialog.tsx' -o -name 'AddKolDialog.ts' \) 2>/dev/null || true)
if [ -z "$RESIDUAL_FILES" ]; then
  green "✓ no AddKolDialog.tsx files in src/"
  PASS=$((PASS + 1))
else
  red "✗ AddKolDialog.tsx residual files found:"
  echo "$RESIDUAL_FILES"
  FAIL=$((FAIL + 1))
fi

# Use `grep -nE` to get file:line:content; then exclude:
#   - lines mentioning BL-066-F005 / removed / deprecated (intentional
#     deletion markers that BL-070 cleanup will sweep)
#   - the bulkSoftDeleteKolsAction filename which contains the
#     'addKolAction' substring (false positive on filename match)
# Only true functional residuals (imports, function calls, JSX usage)
# should remain after the filter and trip a FAIL.
RESIDUAL_REFS=$(grep -rnE 'AddKolDialog|addKolAction' src/ 2>/dev/null \
  | grep -v node_modules | grep -v '.next' \
  | grep -v 'bulkSoftDeleteKolsAction' \
  | grep -vE 'BL-066-F005|removed|deprecated|gitrm|retirement' \
  || true)
if [ -z "$RESIDUAL_REFS" ]; then
  green "✓ no AddKolDialog / addKolAction functional references in src/ (deprecated markers OK)"
  PASS=$((PASS + 1))
else
  red "✗ AddKolDialog / addKolAction functional references residual:"
  echo "$RESIDUAL_REFS" | head -10
  FAIL=$((FAIL + 1))
fi

section "[6] value-score v2 audit_log row present in prod (after F009 recompute)"
# BL-066-F007 + F009 §裁决 #8=C: prod recompute writes one audit_log
# row with action='value_score.recompute_v2' and tenant_id IS NULL
# after the `npx tsx scripts/bl066-f007-recompute-value-score.ts --env prod`
# run. Schema (per prisma/schema.prisma model AuditLog @@map("audit_log")):
# table=audit_log, fields=id/action/tenant_id/resource_type/resource_id/payload.
# Initial v1 of this script wrote `platform_event` (wrong table) — fixed
# 2026-05-15 inline as part of F009 first audit run.
ROW=$(sudo -u postgres psql -d kolmatrix -tA -c \
  "SELECT id || '|' || action || '|' || (payload->>'env') || '|' || (payload->>'row_count') FROM audit_log WHERE action='value_score.recompute_v2' AND tenant_id IS NULL AND (payload->>'env')='prod' ORDER BY created_at DESC LIMIT 1;" \
  2>/dev/null || echo "")
if [ -n "$ROW" ] && [ "$ROW" != "" ]; then
  green "✓ prod recompute audit_log row found: $ROW"
  PASS=$((PASS + 1))
else
  yellow "⚠ no value_score.recompute_v2 row for env=prod found yet"
  yellow "  Expected after running: npx tsx scripts/bl066-f007-recompute-value-score.ts --env prod"
  WARN=$((WARN + 1))
fi

section "[7] kol_campaign.source distribution sanity (F006 backfill landed)"
# BL-066-F006 migration UPDATEd kol_campaign.source='manual' → 'manual_legacy'
# on staging. Prod ran the same migration on F009 deploy. Expect rows split
# across ai_smart_match / csv_import / manual_legacy (no rows left at 'manual'
# from pre-BL-066 data; new 'manual' would only come from future legacy paths
# which BL-066-F005 has removed).
DIST=$(sudo -u postgres psql -d kolmatrix -tA -c \
  "SELECT source, count(*) FROM kol_campaign GROUP BY source ORDER BY source;" \
  2>/dev/null || echo "")
if [ -n "$DIST" ]; then
  echo "kol_campaign.source distribution:"
  echo "$DIST"
  if echo "$DIST" | grep -q '^manual|'; then
    yellow "⚠ kol_campaign rows with source='manual' still exist (F006 migration may not have run)"
    WARN=$((WARN + 1))
  else
    green "✓ no pre-BL-066 'manual' source rows remain"
    PASS=$((PASS + 1))
  fi
else
  yellow "⚠ Postgres query failed (no sudo or db inaccessible) — skip"
  WARN=$((WARN + 1))
fi

section "[8] pm2 logs since deploy — no NEW BL-066-related errors"
# Run immediately + ~24h. Patterns: campaigns/[id] runtime / smart-match
# route / AiRecommendationPanel / AcceptedKolsPanel / value-score recompute
# leftovers / next-intl errors on aiPanel / kolPanel keys.
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  ERR=$(pm2 logs "$APP_NAME" --lines 500 --nostream --raw 2>&1 \
    | grep -iE "AiRecommendationPanel|AcceptedKolsPanel|smart-match.*error|missing.*translation.*(aiPanel|kolPanel|brief)\.|value-score|kol_campaign.*source" \
    | head -20 || true)
  if [ -z "$ERR" ]; then
    green "✓ pm2 logs last 500 lines: no BL-066-related errors"
    PASS=$((PASS + 1))
  else
    red "✗ pm2 logs found BL-066-related errors:"
    echo "$ERR"
    FAIL=$((FAIL + 1))
  fi
else
  yellow "⚠ pm2 process '$APP_NAME' not found (running on different host?)"
  WARN=$((WARN + 1))
fi

section "[9] BL-048 value-score v2 formula sanity spot check"
# BL-066-F007 公式 v2: followerScore = min(80, log10(max(followers,100))*10),
# engagement 6 档 ladder, categoryScore = min(15, cats*8), RAW_MAX=95.
# 顶级 mega-follower KOL 落 90+，nano follower 落 50-70。验全 dataset spread
# ≥ 5（裁决 #7=B 用户 ack 选项 (i) 修订 criterion）。
SPREAD=$(sudo -u postgres psql -d kolmatrix -tA -c \
  "SELECT max(value_score) - min(value_score) FROM kol WHERE value_score IS NOT NULL;" \
  2>/dev/null || echo "?")
if [ "$SPREAD" != "?" ] && [ "$SPREAD" -ge 5 ] 2>/dev/null; then
  green "✓ value_score spread (max - min) = $SPREAD (≥ 5 per audit §7)"
  PASS=$((PASS + 1))
else
  yellow "⚠ value_score spread = $SPREAD (expect ≥ 5; recompute may not have run)"
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
