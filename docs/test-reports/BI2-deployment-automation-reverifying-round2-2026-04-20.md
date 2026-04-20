# BI2 Deployment Automation — Reverifying Round 2 (2026-04-20)

## Scope
- Stage: `reverifying` (fix_rounds=2)
- Reverify targets: `F002`, `F006`, `F008`
- Environment: production VPS + public domain

## F002 — PM2 zero-downtime reload

### Evidence (current prod SHA)
- VPS SHA: `f559d532e66bd275d87c583cc1a156f1b270ecea`
- `pm2` app uses `server.js` cluster mode with 2 instances.

### Probe Results
1. Local probe (VPS `127.0.0.1:3001`) + in-window `pm2 reload --update-env`
   - `60 x 200`
   - non-200: none
2. Public probe (`https://kol.guangai.ai/api/health`) + in-window reload
   - `60 x 200`
   - non-200: none

### Verdict
- `F002`: **PASS**

## F006 — rollback.sh

### Evidence
1. Missing prev-sha branch
   - command: `PREV_SHA_FILE=/tmp/prev-sha-missing-test ./scripts/rollback.sh`
   - observed: `exit 1` with expected error message
2. Success branch
   - command: `PREV_SHA_FILE=/tmp/prev-sha-f006-pass ./scripts/rollback.sh` where file contains current SHA
   - observed: `exit 0` and service healthy afterwards

### Gap
- This round still lacks controlled proof of `healthcheck fail -> rollback exit 2` branch in production-safe conditions.

### Verdict
- `F006`: **PARTIAL**

## F008 — deployment runbook manual fallback reproducibility

### Executed manual fallback sequence on VPS
- `./scripts/backup-db.sh`
- `git fetch --all --prune && git checkout main && git pull --ff-only origin main`
- `npm ci --production=false`
- `npx prisma migrate deploy`
- `npm run build`
- `pm2 reload kolmatrix --update-env`
- `./scripts/healthcheck.sh`

### Key outputs
- New backup file: `/opt/kolmatrix-backups/db-20260420-100204.sql.gz`
- Manifest appended with latest line:
  - `20260420-100204 ba11e6bcd68cba97c2a93d6e16cf0d05a8e0d9fe db-20260420-100204.sql.gz`
- Healthcheck: `✅ Healthy on attempt 1/5`

### Verdict
- `F008`: **PASS**

## Overall Round-2 Result
- PASS: `F002`, `F008`
- PARTIAL: `F006`
- Decision: keep batch in `fixing` until `F006` closes.
