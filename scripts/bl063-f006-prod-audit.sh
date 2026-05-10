#!/usr/bin/env bash
#
# BL-063-F006 · Prod ops post-deploy audit (read-only, idempotent)
#
# 用法（推荐：本机远程跑，避免登录 prod 后再敲命令）：
#   ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl063-f006-prod-audit.sh'
#
# 本地直跑（在 prod VPS 上）：
#   cd /opt/kolmatrix && bash scripts/bl063-f006-prod-audit.sh
#
# 跑两次：
#   1. deploy 完成后立即 → 覆盖 acceptance §3-§5（migration / column / index / row count / health git_sha）
#   2. deploy 后 ~24h → 覆盖 acceptance §7（pm2 logs 24h 无 isSaved 错误）
#
# 仅 SELECT + curl + grep + ls，零修改风险。
#
# 输出：分 section + colored PASS/FAIL，可直接 copy-paste 到
# docs/test-reports/BL-063-signoff-2026-05-XX.md。
#
# 配套：
#   - scripts/sql/BL-063-F006-prod-audit.sql   — SQL 部分（可单独跑）
#   - features.json F006 acceptance            — 7 条验收标准
#   - docs/specs/BL-063-isSaved-decommission-spec.md
#   - docs/test-reports/BL-063-F005-staging-dryrun-2026-05-11.md（staging 同口径对照）

set -uo pipefail   # NOT -e — 单项 audit fail 不中断后续，最后统一汇总

REPO_DIR="${REPO_DIR:-/opt/kolmatrix}"
DB_NAME="${DB_NAME:-kolmatrix}"
HEALTH_URL="${HEALTH_URL:-https://kol.guangai.ai/api/health}"
APP_NAME="${APP_NAME:-kolmatrix}"

cd "$REPO_DIR"

# 加载 .env.production 取 HEALTH_DETAIL_TOKEN（curl /api/health 拿 git_sha 需要）
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

section "[0] Deploy SHA & /api/health git_sha 一致性"
HEAD=$(git rev-parse --short HEAD)
echo "git rev-parse --short HEAD = $HEAD"
TOKEN="${HEALTH_DETAIL_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  yellow "⚠ HEALTH_DETAIL_TOKEN unset — git_sha will be hidden from /api/health response"
  WARN=$((WARN + 1))
fi
HEALTH=$(curl -s "${HEALTH_URL}?token=${TOKEN}")
echo "$HEALTH" | python3 -m json.tool || echo "$HEALTH"
HEALTH_SHA=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('git_sha','?'))" 2>/dev/null || echo "?")
if [ "$HEAD" = "$HEALTH_SHA" ]; then
  green "✓ git_sha=$HEAD matches health.git_sha=$HEALTH_SHA"
  PASS=$((PASS + 1))
else
  red "✗ git_sha mismatch: deploy HEAD=$HEAD vs health.git_sha=$HEALTH_SHA"
  FAIL=$((FAIL + 1))
fi

section "[1] _prisma_migrations: BL-063 migration applied"
sudo -u postgres psql -d "$DB_NAME" -c "SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at FROM _prisma_migrations WHERE migration_name LIKE '%bl063%' OR migration_name LIKE '%is_saved%' ORDER BY started_at DESC LIMIT 3;"
MIGRATED=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '20260511000000_bl063_remove_is_saved' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;")
if [ "$MIGRATED" = "1" ]; then
  green "✓ migration finished + not rolled back"
  PASS=$((PASS + 1))
else
  red "✗ migration not in expected state (rows matching: $MIGRATED, expect 1)"
  FAIL=$((FAIL + 1))
fi

section "[2] is_saved column should NOT exist"
COL_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='kol' AND column_name='is_saved';")
echo "is_saved column count: $COL_COUNT (expect 0)"
if [ "$COL_COUNT" = "0" ]; then
  green "✓ is_saved column dropped"
  PASS=$((PASS + 1))
else
  red "✗ is_saved column still present"
  FAIL=$((FAIL + 1))
fi

section "[3] kol_tenant_saved_idx should NOT exist"
IDX_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE tablename='kol' AND indexname='kol_tenant_saved_idx';")
echo "kol_tenant_saved_idx count: $IDX_COUNT (expect 0)"
if [ "$IDX_COUNT" = "0" ]; then
  green "✓ index dropped"
  PASS=$((PASS + 1))
else
  red "✗ index still present"
  FAIL=$((FAIL + 1))
fi

section "[4] engagement_rate non-null rows (acceptance §3: ≥ 95)"
sudo -u postgres psql -d "$DB_NAME" -c "SELECT COUNT(*) AS total_kol, COUNT(engagement_rate) AS non_null, ROUND(COUNT(engagement_rate)::numeric * 100 / NULLIF(COUNT(*), 0), 2) AS non_null_pct FROM kol WHERE deleted_at IS NULL;"
NON_NULL=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT COUNT(engagement_rate) FROM kol WHERE deleted_at IS NULL;")
if [ "$NON_NULL" -ge 95 ]; then
  green "✓ engagement_rate non-null rows = $NON_NULL (≥ 95 baseline, no BL-063 stats regression)"
  PASS=$((PASS + 1))
else
  red "✗ engagement_rate non-null rows = $NON_NULL (< 95 baseline — possible BL-063 stats regression!)"
  FAIL=$((FAIL + 1))
fi

section "[5] kol row count sanity (migration must not lose rows)"
sudo -u postgres psql -d "$DB_NAME" -c "SELECT COUNT(*) AS total_kol_all, COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_kol FROM kol;"

section "[6] src/ residual isSaved/is_saved (only comments expected)"
RESIDUAL=$(grep -rn 'isSaved\|is_saved' src/ --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v node_modules | grep -v '__tests__' | grep -v '.next' || true)
if [ -z "$RESIDUAL" ]; then
  green "✓ src/ entirely clean of isSaved references"
  PASS=$((PASS + 1))
else
  echo "$RESIDUAL"
  FUNCTIONAL=$(echo "$RESIDUAL" | grep -v ' \* ' | grep -v ' // ' || true)
  if [ -z "$FUNCTIONAL" ]; then
    green "✓ src/ — all matches are explanatory comments (no functional code)"
    PASS=$((PASS + 1))
  else
    red "✗ src/ — functional residual found:"
    echo "$FUNCTIONAL"
    FAIL=$((FAIL + 1))
  fi
fi

section "[7] _bl063_is_saved_backup TEMP (expected: not_found post-deploy)"
sudo -u postgres psql -d "$DB_NAME" -c "SELECT to_regclass('public._bl063_is_saved_backup') AS backup_table;"
yellow "ℹ TEMP table session-scoped per F002 design — durable backup is /opt/kolmatrix-backups/ pre-deploy pg_dump (deploy-prod.sh step 2/8 → backup-db.sh)"

section "[8] Pre-deploy pg_dump backup (deploy-prod.sh step 2 evidence)"
ls -lh /opt/kolmatrix-backups/ 2>/dev/null | tail -10
LATEST_BACKUP=$(ls -t /opt/kolmatrix-backups/*.sql.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  AGE_MIN=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 60 ))
  SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
  echo ""
  echo "Latest backup: $LATEST_BACKUP"
  echo "  size: $SIZE / age: ${AGE_MIN} min"
  if [ "$AGE_MIN" -lt 60 ]; then
    green "✓ Pre-deploy backup is fresh (<1h, deploy just ran)"
    PASS=$((PASS + 1))
  elif [ "$AGE_MIN" -lt 1500 ]; then
    yellow "⚠ Latest backup is ${AGE_MIN} min old — verify covers this deploy"
    WARN=$((WARN + 1))
  else
    red "✗ Latest backup ${AGE_MIN} min old — likely missing for this deploy"
    FAIL=$((FAIL + 1))
  fi
else
  red "✗ No backup found in /opt/kolmatrix-backups/ — deploy ran with SKIP_BACKUP=true?"
  FAIL=$((FAIL + 1))
fi

section "[9] pm2 logs — recent isSaved/is_saved errors (acceptance §7 24h hook)"
PM2_OUT=$(pm2 logs "$APP_NAME" --lines 1000 --nostream --raw 2>/dev/null \
  | grep -iE 'issaved|is_saved' || true)
if [ -z "$PM2_OUT" ]; then
  green "✓ no isSaved-related entries in last 1000 pm2 log lines"
  PASS=$((PASS + 1))
else
  red "✗ Found isSaved-related entries in pm2 logs (likely runtime error from missed reference):"
  echo "$PM2_OUT" | head -20
  FAIL=$((FAIL + 1))
fi
yellow "ℹ Run this script again ~24h after deploy for full §7 acceptance evidence (24h coverage window)"

section "Summary"
echo "PASS: $PASS / FAIL: $FAIL / WARN: $WARN"
echo ""
yellow "Remaining manual UI check (acceptance §6 — not scriptable):"
echo "  - Open https://kol.guangai.ai/[locale]/(app)/campaigns/[id] for an active campaign"
echo "  - Verify: '添加 KOL' button enabled (not disabled by isSaved=false guard)"
echo "  - Click button → dialog opens with full tenant KOL pool (>0 candidates)"
echo "  - /discovery: KOL cards have NO Save button"
echo "  - /kols/[id]: actions card has NO SavedToggleButton"
echo "  - /database: shows full tenant pool, QuickStats with realistic numbers"
echo ""
if [ "$FAIL" -eq 0 ]; then
  green "✓ All scripted checks passed — proceed to UI walkthrough then signoff report."
  exit 0
else
  red "✗ $FAIL scripted check(s) failed — review above before signoff. Do NOT mark F006 done until resolved (or escalate as new partial-pending audit)."
  exit 1
fi
