# KOL Sync Runbook

**Owner:** KOLMatrix backend / Generator agent.  
**Spec:** `docs/specs/B6-kol-daily-sync-spec.md`.  
**On-call entry point:** `/var/log/kolmatrix-kol-sync.log` on prod.

This is the day-to-day operational guide for the daily YouTube
sync cron. For architectural background see the spec; this doc is
strictly "what does each alert mean and what do I do about it".

---

## Where things live

| Path | Purpose |
|---|---|
| `/etc/cron.d/kolmatrix-kol-sync` | crontab entry — fires at 00:30 UTC = 08:30 BJ daily |
| `/etc/logrotate.d/kolmatrix-kol-sync` | 30-day daily rotation, gzip after delaycompress |
| `/var/log/kolmatrix-kol-sync.log` | structured JSON, one line per run |
| `/opt/kolmatrix/docs/test-reports/kol-sync-daily-{YYYY-MM-DD}.md` | per-run markdown summary |
| `scripts/kol-sync-daily.ts` | the binary the cron invokes |
| `src/lib/kol-sync/` | adapter dispatcher + retry + log classifier |

The structured log is the source of truth for alerting. Markdown reports
are for humans skimming; never depend on them programmatically.

---

## Reading the structured log

Each line is a single JSON object:

```json
{
  "timestamp": "2026-04-29T00:30:01.041Z",
  "endedAt":   "2026-04-29T00:30:47.892Z",
  "durationMs": 46851,
  "level": "INFO",
  "adapters": [{ "name": "youtube", "healthy": true }],
  "discoverCount": 47,
  "refreshCount": 200,
  "inserted": 35,
  "updated": 212,
  "skipped": 0,
  "dedupeSkipped": 0,
  "estimatedQuotaConsumed": 1815,
  "estimatedQuotaRemaining": 8185,
  "errors": [],
  "zeroDiscoverStreakBefore": 0,
  "alerts": []
}
```

Quick triage:

```bash
# Most recent run
tail -1 /var/log/kolmatrix-kol-sync.log | jq

# Anything not INFO in the last 7 days
tail -200 /var/log/kolmatrix-kol-sync.log | jq 'select(.level != "INFO")'

# Yesterday's discover count
tail -1 /var/log/kolmatrix-kol-sync.log | jq .discoverCount
```

---

## Alert thresholds

| Trigger | Level | What it means | First-pass action |
|---|---|---|---|
| `estimatedQuotaConsumed > 3000` | WARN | A YouTube call is retrying more than usual or matrix expanded. Daily budget is ~1,805u; >3,000u means something burned ~2x. | Check `errors[]` and adapter retry logs in stderr. If a region returns `quotaExceeded`, drop that region for a day or wait for the next quota window. |
| `discoverCount === 0` | WARN | Today's run found 0 new channels (after dedupe). Could be a quota issue, an upstream search outage, or just bad luck on the matrix. | Look at `errors`. Re-run manually with `npm run kol-sync:daily` and observe — if the same outcome, escalate. |
| `discoverCount === 0` for 3 days running | **ALERT** | Data source likely broken, or our keyword set has been deindexed. | Page on-call. Verify `npm run kol-sync:daily:dry` plan still looks right. Check `YOUTUBE_API_KEY` validity at https://console.cloud.google.com. |
| `errors.length > 0` | WARN | At least one adapter call exhausted retries. | Read each error string in `errors[]`. Most are transient — re-run manually if budget allows. |
| `durationMs > 300000` (5 min) | WARN | Run took longer than the rotation budget. Almost always a sign of network slowness on the VPS or a 429 retry-storm. | Re-run; if it persists, check `free -m` and `iostat 1` on the VPS. |

The streak counter (`zeroDiscoverStreakBefore`) is computed from the
log itself — `countTrailingZeroDiscoverStreak()` walks backwards
through the file. A malformed line resets the streak to 0, so log
corruption fails closed (we don't accidentally silence the ALERT).

---

## Manual operations

### Run on demand (live, prod-only)

Burns ~1,805u quota. Don't do this casually before quota reset.

```bash
ssh tripplezhou@<prod-host>
cd /opt/kolmatrix
npm run kol-sync:daily
tail -1 /var/log/kolmatrix-kol-sync.log | jq
```

### Dry-run to validate config

Free, no API calls.

```bash
npm run kol-sync:daily:dry
```

### Skip the refresh phase (first day after deploy)

```bash
npm run kol-sync:daily -- --no-refresh
```

### Smaller refresh batch (when refresh is suspected slow)

```bash
npm run kol-sync:daily -- --refresh-batch 50
```

### Revoke the cron temporarily

```bash
sudo mv /etc/cron.d/kolmatrix-kol-sync /etc/cron.d/kolmatrix-kol-sync.disabled
# … investigate …
sudo mv /etc/cron.d/kolmatrix-kol-sync.disabled /etc/cron.d/kolmatrix-kol-sync
```

---

## Common false alarms

- **First two days after deploy** the structured log is short, so the
  ALERT streak counter can't yet trigger. WARN-level zeroDiscover for
  a single day is not actionable.
- **YouTube quota window edges:** if cron fires before the 00:00 PT
  reset finishes propagating, the first request can get a 403. The
  retry layer's 30s/2min/5min schedule absorbs this transparently —
  it shows up as `errors[0]` even though the run succeeded later.
- **Refresh `updated` count > inserted by orders of magnitude is
  expected** — refresh re-touches the same 200 KOLs every week.

---

## When to escalate

Go straight to the user (no automated paging in B6 — Sentry/Slack is
BL-013 territory):

- `level = ALERT`
- 3+ consecutive runs with `errors.length > 0`
- `estimatedQuotaConsumed > 6,000` (60% of daily budget — a runaway)
- API key invalidation: `errors[0]` contains `forbidden` or
  `accessNotConfigured`
