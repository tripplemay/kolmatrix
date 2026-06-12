# KPI Snapshot Runbook (BL-052 F003)

**Owner:** KOLMatrix backend / Generator agent.
**Spec:** `docs/specs/BL-052-dashboard-trend-edge-polish-spec.md` §3.4.
**On-call entry point:** `/var/log/kolmatrix-kpi-snapshot.log` on prod.

The daily KPI snapshot writer captures one row per (tenant, day) into
`kpi_daily_snapshot`. The dashboard's KPI cards read trailing snapshots
to compute trend chips (7-vs-prior-7) and the 30-day sparkline. Without
this cron the cards permanently show the "—" + "data accumulating"
fallback.

---

## Where things live

| Path | Purpose |
|---|---|
| `/etc/cron.d/kolmatrix-kpi-snapshot` | single-rooted entry — chains `kol-sync:daily` then `kpi-snapshot:daily` at 00:30 UTC = 08:30 BJ daily. **On prod, written by `scripts/deploy-prod.sh` on every deploy (BL-107-F004); it supersedes the legacy `/etc/cron.d/kolmatrix-kol-sync`.** |
| `/var/log/kolmatrix-kpi-snapshot.log` | structured JSON, one line per run |
| `scripts/kpi-snapshot-daily.ts` | the binary the cron invokes |
| `src/lib/dashboard/kpi-snapshot.ts` | takeKpiSnapshot + takeAllTenantsKpiSnapshot |
| `src/lib/dashboard/kpi-trends.ts` | computeKpiTrend / computeSparkline / loadKpiTrends |

KPI snapshot **chains after** `kol-sync:daily` so the KOL counts
captured here already include any rows freshly synced this morning.
The two scripts share one cron entry to keep the schedule single-rooted.

---

## Cron line

The single line in `/etc/cron.d/kolmatrix-kpi-snapshot`. **On prod this
file is (re)written automatically by `scripts/deploy-prod.sh` on every
deploy** (BL-107-F004 — idempotent, VM-reset-resistant); you should not
hand-edit it on prod (the next deploy overwrites it).

```cron
30 0 * * * tripplezhou cd /opt/kolmatrix && npm run kol-sync:daily 2>&1 | tee -a /var/log/kolmatrix-kol-sync.log && npm run kpi-snapshot:daily 2>&1 | tee -a /var/log/kolmatrix-kpi-snapshot.log
```

Notes:

- `&&` keeps the chain short-circuit: if `kol-sync:daily` exits non-zero
  the snapshot run is skipped. The snapshot is idempotent — skipping a
  day just means the next day's run sees a 1-day gap. Recovery: re-run
  manually (see below).
- `kpi-snapshot:daily` exits 1 when at least one tenant failed (cron
  alerting can pick this up via mail / log monitor).
- Logrotate: same 30-day daily rotation as `kol-sync` if you reuse
  `/etc/logrotate.d/kolmatrix-kol-sync`; copy that file to a `kpi-snapshot`
  variant when ready.

---

## Reading the structured log

Each line is one JSON object emitted on stdout by `kpi-snapshot:daily`:

```json
{
  "ts": "2026-05-08T00:30:14.221Z",
  "totalTenants": 7,
  "succeeded": 7,
  "failedCount": 0,
  "failed": []
}
```

Triage commands:

```bash
# Most recent run
tail -1 /var/log/kolmatrix-kpi-snapshot.log | jq

# Anything with failures in the last 14 days
tail -14 /var/log/kolmatrix-kpi-snapshot.log | jq 'select(.failedCount > 0)'

# Per-tenant errors today
tail -1 /var/log/kolmatrix-kpi-snapshot.log | jq '.failed[]'
```

---

## SSH ops — install

**Prod: automatic.** `scripts/deploy-prod.sh` (step 8b, BL-107-F004)
writes `/etc/cron.d/kolmatrix-kpi-snapshot` + pre-creates the log files
on every deploy. Nothing to do by hand — just deploy. Verify with:

```bash
sudo cat /etc/cron.d/kolmatrix-kpi-snapshot
```

**Staging: manual** (there is no `deploy-staging.sh`). Install the same
cron once on staging, pointing `cd` at `/opt/kolmatrix-staging`:

```bash
ssh tripplezhou@34.180.93.185
sudo tee /etc/cron.d/kolmatrix-kpi-snapshot-staging >/dev/null <<'CRON'
# /etc/cron.d/kolmatrix-kpi-snapshot-staging
30 0 * * * tripplezhou cd /opt/kolmatrix-staging && set -a && . .env.staging && set +a && npm run kol-sync:daily 2>&1 | tee -a /var/log/kolmatrix-kol-sync-staging.log && npm run kpi-snapshot:daily 2>&1 | tee -a /var/log/kolmatrix-kpi-snapshot-staging.log
CRON
sudo chmod 0644 /etc/cron.d/kolmatrix-kpi-snapshot-staging
sudo touch /var/log/kolmatrix-kpi-snapshot.log
sudo chown tripplezhou:tripplezhou /var/log/kolmatrix-kpi-snapshot.log
```

---

## Manual run / recovery

```bash
# As tripplezhou inside /opt/kolmatrix
cd /opt/kolmatrix
set -a && source .env.production && set +a
npm run kpi-snapshot:daily | tee -a /var/log/kolmatrix-kpi-snapshot.log
```

Re-running the same calendar day is idempotent — the snapshot upserts
on `(tenant_id, snapshot_date)`.

To backfill a missed day, run the script with a `KPI_SNAPSHOT_DATE`
override (not yet wired — the script always uses today's UTC date).
For now, the cleanest recovery is to wait for the next day's run; trend
chips degrade gracefully (computeSparkline forward-fills missing days).

---

## What to do if it pages

1. Read the most recent log line — `failed[]` lists the offending
   `tenantId` + `error` string.
2. Common causes:
   - `prepared statement` errors → restart pgbouncer / check `DATABASE_URL`.
   - One tenant's data has corrupt `valueScore` (NaN) → null it via
     ALTER + retry.
3. Re-run the script manually (see above). The previous-day's row stays
   intact; today's row gets created or updated.
4. If multiple consecutive days fail, file a ticket — the trend chips
   on the dashboard may slip into the `hasEnoughData=false` fallback
   for everyone.
