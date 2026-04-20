# BI2 Deployment Automation — Reverifying Report (Production) (2026-04-20)

## Scope
- Sprint: `BI2-deployment-automation`
- Stage: `reverifying` (fix round 1)
- Targeted items from previous FAIL/PARTIAL: `F001/F002/F003/F004/F006/F008`
- Environment: production (`kol.guangai.ai` + VPS `34.180.93.185` + GitHub Actions)

## Production Evidence Collected

### 1) Live health endpoint (`F001`)
- `curl https://kol.guangai.ai/api/health` => `HTTP/2 200`
- Response body includes expected fields:
  - `status: healthy`
  - `version: 0.1.0`
  - `git_sha: abd585d4a506a4932c6e12a5528bb1a9293d6415`
  - `checks.database.status: ok` (latency observed 20ms)
  - `checks.redis.status: stub`

### 2) Real deployment chain (`F003`)
- `gh run list --workflow "Deploy to Production"` now shows completed runs:
  - success run `24648761472` (`headSha=abd585d...`, 2026-04-20 04:40Z)
  - success run `24645830952` (`headSha=a6b1fd0...`)
  - earlier failed run `24645393185`
- `gh api deployments?environment=production` now returns deployment records (not empty), latest deployment `id=4420698907`, `sha=abd585d...`.
- Latest success run log contains full 8-step deploy flow and `✅ Deploy successful: abd585d...`.

### 3) Backup artifacts on VPS (`F004`)
- On VPS: `/opt/kolmatrix-backups/` contains fresh backups.
- Latest file observed: `db-20260420-044050.sql.gz`.
- `manifest.log` tail contains timestamp + sha + filename entries.
- `gzip -dc latest | head` shows valid PostgreSQL dump header.

### 4) PM2 runtime / zero-downtime observation (`F002`)
- VPS `pm2 describe kolmatrix` shows process online, cluster mode, healthy metrics.
- Around manual `pm2 reload kolmatrix --update-env`, continuous probes observed transient failures:
  - Public probe (`https://kol.guangai.ai/api/health`): 38x `200`, 2x `502`
  - Local probe (`http://127.0.0.1:3001/api/health`): 46x `200`, 4x connection failure (`000000`)
- This does **not** satisfy strict “no dropped request” acceptance.

### 5) Rollback evidence (`F006`)
- Failed deploy run `24645393185` failed at pre-deploy backup auth step (before reload/healthcheck), so rollback path was not triggered.
- `/tmp/prev-sha` exists on VPS, but no end-to-end proof of “healthcheck fail -> auto rollback -> recover” in this cycle.

### 6) Runbook execution depth (`F008`)
- SSH emergency path verified in practice (VPS login + `/opt/kolmatrix` ops performed).
- But full L3 manual drills required by previous feedback (manual fallback full sequence, restore drill, >=3 common error drills) were not fully executed in this cycle.

## Verdict by Feature
- `F001`: PASS
- `F002`: FAIL
- `F003`: PASS
- `F004`: PASS
- `F006`: PARTIAL
- `F008`: PARTIAL

(Existing PASS maintained)
- `F005`: PASS
- `F007`: PASS

## Overall Result
- PASS: 5
- PARTIAL: 2
- FAIL: 1
- Decision: `reverifying` not passed; return to `fixing`.

## Blocking Items for Next Round
1. `F002` zero-downtime must reach no observable non-200 during reload test window (or acceptance criteria adjusted by planner/user with explicit rationale).
2. `F006` requires one controlled end-to-end auto-rollback drill with recovery evidence.
3. `F008` requires completing required L3 runbook drills and recording outputs.
