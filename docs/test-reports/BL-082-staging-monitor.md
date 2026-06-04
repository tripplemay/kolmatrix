# BL-082-F006 · Staging deploy + refresh phase verification

> **Sprint:** BL-082-refresh-selector-rewire · **Feature:** F006
> **Run by:** Generator (Kimi), 2026-06-04 · **Staging:** `staging.kol.guangai.ai`

## Deploy

- `deploy-staging.yml` (ref=main) → staging HEAD **`9ffee8d`** (all BL-082 F001–F005 code), `prisma migrate deploy` applied the `platform_user_id` column. Deploy run succeeded, `/api/health` healthy.

## platformUserId backfill (F002 script on staging)

`npx tsx scripts/kol-platform-user-id-backfill.ts`:

| platform | discovered (with platformUserId) | stamped |
|---|---|---|
| youtube | 809 | 516 |
| tiktok | 1897 | 1165 |
| instagram | 469 | 178 |
| **total** | **3175** | **1859** |

Idempotent re-run stamped 0. (discovered > stamped because some fork rows don't match an existing staging KOL `external_id`, or were already stamped.) Post-backfill: **2371** live KOLs carry `platform_user_id`.

## Refresh phase (daily-sync, the BL-082 core)

`npx tsx scripts/kol-sync-daily.ts` refresh-phase log:

```
refresh phase start 2026-06-04T10:29:09Z
refresh youtube:   requested=91  refreshed=91  failedAdapters=0
refresh tiktok:    requested=127 refreshed=127 failedAdapters=0
refresh instagram: requested=35  refreshed=35  failedAdapters=0
refresh phase end   2026-06-04T10:29:12Z totalRefreshed=253
```

| Acceptance | Result |
|---|---|
| refreshCount > 0 (all platforms) | ✅ **253** (YT 91 / TT 127 / IG 35) — was hardcoded 0 since BL-059 |
| 404 rate ≤ 5% | ✅ **0%** (refreshed == requested on every platform; `kol.refresh_404_skip` audit = 0) |
| 0 daily-sync errors from the refresh phase | ✅ failedAdapters=0, no refresh errors |
| KOL.lastSyncedAt updated by refresh→import | ✅ refreshed rows re-imported (lastSyncedAt bumped) |

The tiered selector returns today's bucket per platform (not all 2371), so 253/day is the expected daily slice; a full rotation completes in ~5 days at `MAX_TOTAL_REFRESH=500`.

## Observations (not BL-082 regressions)

- The **full** daily-sync run was slow because the **enrichment stage (BL-075)** hit aigcgateway 429s (30 RPM cap) re-enriching country-null KOLs — pre-existing rate-gated behavior, retried, unrelated to the refresh phase (which runs *before* enrichment and completed cleanly in ~3s). The clean refresh measurement above was taken with `--enrichment-limit=1`.

## DoD status

F006 immediate verification PASS (deploy + backfill + refreshCount>0 all-platform + 0% 404). The "24h cron observation" is left to the scheduled daily cron / F007 Codex L2 + prod monitor. Prod deploy + backfill is a separate user-triggered step (per `部署由用户手动触发`).
