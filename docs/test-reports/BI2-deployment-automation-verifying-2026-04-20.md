# BI2 Deployment Automation — Verifying Report (2026-04-20)

## Scope
- Batch: `BI2-deployment-automation`
- Evaluator: `Reviewer`
- Stage: `verifying`
- Test layers executed: L1 local + limited L2 read-only evidence collection

## Environment & Constraints
- Local runtime bootstrapped via:
  - `bash scripts/test/codex-setup.sh`
  - `bash scripts/test/codex-wait.sh`
- Port policy: Codex local verification on `localhost:3099`
- Production write operations were not executed in this run.

## Evidence Summary
1. `npm run test:coverage` => PASS (87 passed, 0 failed)
2. `npm run test:integration` => PASS (28 passed, 0 failed)
3. `npm run test:e2e` => FAIL in this environment because Playwright hardcodes `http://localhost:3000` while Codex test port is `3099`.
4. `bash scripts/validate-rollback-sql.sh` => PASS (`4 migration(s) all include -- ROLLBACK: recipe`)
5. `scripts/healthcheck.sh`:
   - success path PASS in no-proxy env (`NO_PROXY='*'`)
   - 404 path PASS (fails with non-200/non-healthy as designed)
6. `scripts/backup-db.sh`:
   - local host lacks `pg_dump` binary
   - with temporary `pg_dump` shim (`docker compose exec -T postgres pg_dump`) backup PASS; generated `.sql.gz` and `manifest.log`
7. `scripts/rollback.sh` negative path PASS (`PREV_SHA_FILE` missing => exit 1)
8. L2 read-only checks:
   - `gh workflow list` shows `Deploy to Production` exists
   - `gh run list --workflow "Deploy to Production"` returns empty (no run evidence)
   - `gh api .../environments` confirms `production` environment exists
   - `https://kol.guangai.ai/api/health` TLS validation fails (certificate hostname mismatch)
   - `curl -k https://kol.guangai.ai/api/health` returns `404` page titled `AIGC Gateway` (not KOLMatrix health JSON)

## Feature-by-Feature Verdict
- F001 `/api/health`: PARTIAL
  - Local endpoint shape and healthy response are correct.
  - Production endpoint evidence does not match expected KOLMatrix health route (`404`/wrong site + TLS mismatch).
- F002 `PM2 ecosystem.config.js`: PARTIAL
  - Static artifact exists; L2 VPS zero-downtime reload not executed in this run.
- F003 `deploy-prod workflow + deploy-prod.sh`: FAIL
  - Workflow file exists, but no actual deployment run/deployment history evidence in GitHub.
  - BI2 DoD (GitHub UI run workflow then kol.guangai.ai serves new version within 5-10 minutes) remains unproven.
- F004 `backup-db.sh`: PARTIAL
  - Script logic validated; local simulation passes via docker-exec shim.
  - Production backup file generation on VPS not yet evidenced.
- F005 `healthcheck.sh`: PASS
  - Retry/failure/success behavior correct when excluding proxy interference.
- F006 `rollback.sh`: PARTIAL
  - Missing-prev-sha branch verified.
  - End-to-end auto-rollback after failed deploy not yet evidenced.
- F007 `validate-rollback-sql + CI`: PASS
  - Local validation script passes; workflow contains check step.
- F008 `runbook`: PARTIAL
  - Required sections exist.
  - L3 hands-on drills (manual fallback, restore drill, common-errors drills) not yet executed.

## Key Risks
1. Production domain/cert mismatch indicates traffic is not currently serving expected KOLMatrix health endpoint.
2. No real deploy run evidence means BI2 main objective is still unverified.
3. Local evaluator machine missing `shellcheck`, `actionlint`, `pg_dump`; this blocks strict reproduction of some claimed local checks without shims.

## Recommendation
- Move to `fixing` with explicit remediation tasks for Generator/Planner to provide verifiable L2 deployment evidence and resolve production endpoint/certificate/domain routing mismatch.
