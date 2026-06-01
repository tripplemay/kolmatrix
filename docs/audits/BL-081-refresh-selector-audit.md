# BL-081-F004 · `refresh=0` Audit Report

> **Sprint:** BL-081-kol-country-data-fix · **Feature:** F004 (audit only — no fix implemented)
> **Author:** Generator (Kimi), 2026-06-01
> **Scope:** Diagnose why the daily KOL sync reports `refresh=0` every day (stable for ≥7 days per the BL-081 A0 audit). **Investigate, do not fix** — remediation is deferred to its own batch once the root cause is agreed.

---

## §1 现状 (Current state)

The daily sync report has shown `refreshCount: 0` consistently (BL-081 A0 audit: 7 days stable at 0; the dimension is worth confirming over 30 days — see §5 ops check O1).

**This is not a runtime failure — it is by design as of BL-059.** The daily script's own header documents the removal:

- `scripts/kol-sync-daily.ts:6-8` — *"YouTube Data API path + engagement-batch enrichment + **tiered refresh have been removed**; the daily sync now drives a single adapter (`apify-kol-service`) through healthCheck → discover → import → embed-hook."*
- `scripts/kol-sync-daily.ts:86-87` — *"BL-059: `--no-refresh` / `--refresh-batch` silently ignored — **refresh phase removed** with the YouTube path."*
- `scripts/kol-sync-daily.ts:199` — `refreshCount: 0` is **hard-coded** into the summary object. The number is a literal, not a measurement.

**`runDaily()` contains no refresh call.** Its body runs: `healthCheck → dispatcher.runDailySync (discover) → write discovered (import) → embed-hook`. A grep of the `runDaily` body for `refresh` / `runRefresh` / `fetchTieredRefreshIds` returns nothing.

## §2 根因 (Root cause)

`refresh=0` is **not** a selector bug, a cursor bug, or a fork limitation. The root cause is:

> **The refresh phase was intentionally removed in BL-059's single-source refactor and never re-wired for the apify-kol source. The tiered refresh selector remains in the tree as orphaned dead code.**

Evidence:

| # | Finding | Location |
|---|---------|----------|
| R-a | `refreshCount: 0` is a hard-coded literal in the report builder | `scripts/kol-sync-daily.ts:199` |
| R-b | `runDaily()` never invokes any refresh path | `scripts/kol-sync-daily.ts` (`runDaily` body) |
| R-c | **`fetchTieredRefreshIds` has zero production callers** (orphaned) | `src/lib/kol-sync/refresh-selector.ts` — grep of `src/` + `scripts/` finds no import outside the definition |
| R-d | `refresh-selector.ts` has **no test file** either (`*refresh*` glob empty) — fully dead | — |
| R-e | The capability still exists but is unwired: `KolSyncDispatcher.runRefresh()` (`dispatcher.ts:107`) and `ApifyKolSyncAdapter.refresh()` (`adapters/apify-kol.ts:199`, hits `GET /kol/:platform/:userId`) are both present and tested | — |

So the machinery to refresh exists end-to-end (selector → dispatcher.runRefresh → adapter.refresh → fork single-profile endpoint); only the **wiring in the daily orchestrator** is missing. The other candidate hypotheses are ruled out:

- ~~selector bug~~ — `pickTieredRefreshIds` / `fetchTieredRefreshIds` are never called, so they cannot be producing zero.
- ~~cursor / stale-pagination bug~~ — there is no refresh query running at all.
- ~~fork doesn't support refresh~~ — the adapter implements `refresh()` against `GET /kol/:platform/:userId`; whether the fork currently serves it is unconfirmed (ops check O3) but is moot while nothing calls it.

## §3 影响评估 (Impact assessment)

Because only `discover()` writes/updates rows, an existing KOL's `follower_count`, `engagement_rate`, `avg_views`, `audience_*`, etc. are refreshed **only when that KOL reappears in a discover() page**. apify-kol's `discover()` walks `GET /kol?sort=recent` (`adapters/apify-kol.ts` discover), so:

- KOLs that keep surfacing in "recent" pages get incidentally updated.
- KOLs that fall out of the recent window **go stale indefinitely** — their metrics are frozen at whatever the last discover write captured (or at seed/backfill time).

**Business impact:** value scoring, discovery ranking, and analytics drift as the long-tail's follower/engagement figures age. Severity scales with how much of the pool is outside discover coverage — **quantification requires a prod DB query** (ops check O2). Until then the impact is "unbounded staleness on the discover-cold long tail," qualitatively significant for a data-quality product but not a correctness/outage issue.

> Note: this is **orthogonal to the BL-081 country/retry-storm fix** (F001–F003, F005). Those address LLM enrichment cost; this addresses metric freshness. They share no code path.

## §4 修复建议 (Remediation — 3 candidate directions)

Deferred to a dedicated batch. Three options, lowest-effort first:

| Dir | Approach | Pros / Cons |
|-----|----------|-------------|
| **A — Re-wire the existing selector (recommended)** | In `runDaily()`, after discover→import, loop the apify-kol platforms and call `fetchTieredRefreshIds(prisma, {tenantId, platform})` → `dispatcher.runRefresh(ids)` → import the refreshed rows. Replace the hard-coded `refreshCount: 0` with the real count. | The infra (selector + dispatcher.runRefresh + adapter.refresh) already exists and is tested — wiring is ~30-50 LOC + tests. Must first confirm fork serves `GET /kol/:platform/:userId` (O3). Tiered cadence already cost-bounded (`MAX_TOTAL_REFRESH=200` ⇒ ⌈200/50⌉ quota units/day). |
| **B — Lightweight lastSyncedAt-asc refresh** | Skip the tiered selector; each day refresh the N oldest `lastSyncedAt` rows per platform via `adapter.refresh()`. | Simpler than A, but loses the value-aware cadence BIx-F004-P3 designed; would make refresh-selector.ts permanently dead → delete it. |
| **C — Discover-coverage widening only** | Leave refresh removed; instead broaden discover (more pages / different `sort`) so more existing rows get incidentally re-written. | No new refresh path, but discover isn't a targeted freshness tool — long-tail still starves. Weakest. |

If Dir A or B is chosen, also **decide the fate of `refresh-selector.ts`**: A revives it; B/C should delete it (and any orphaned types) to remove dead code.

## §5 待 ops 验证 (Ops checks — require SSH, not run here)

F004 is code-side audit only; these confirm/quantify §1 and §3 on the live system. Commands for the user/ops:

- **O1 — confirm `refresh=0` history (30d):**
  ```bash
  ssh tripplezhou@34.180.93.185 "grep -hoE '\"refreshCount\":[0-9]+' /var/log/pm2/kolmatrix-out.log* | sort | uniq -c"
  ```
  Expected: only `refreshCount:0` (because §2 R-a hard-codes it). Any non-zero would contradict this audit and must be investigated.

- **O2 — quantify staleness (prod DB):**
  ```sql
  -- lastSyncedAt age distribution for active KOLs
  SELECT width_bucket(EXTRACT(DAY FROM now() - last_synced_at), 0, 90, 9) AS age_bucket,
         count(*) FROM kol WHERE deleted_at IS NULL AND status='active'
  GROUP BY 1 ORDER BY 1;
  ```
  Reveals how much of the pool is going stale (the §3 long-tail).

- **O3 — confirm fork serves the refresh endpoint (needed for Dir A/B):**
  ```bash
  ssh tripplezhou@34.180.93.185 "curl -s -o /dev/null -w '%{http_code}\n' -H 'x-api-key: <BUSINESS_API_KEY>' 'http://localhost:3004/kol/youtube/<knownUserId>'"
  ```
  200 ⇒ refresh wiring viable; 404/501 ⇒ coordinate with the crawler team first.

---

## §6 结论 (Conclusion)

`refresh=0` is **expected behaviour** introduced by BL-059's single-source refactor — the refresh phase was removed and `refreshCount` hard-coded to 0, leaving the tiered refresh selector as orphaned dead code. It is **not** a bug in the selector and is **independent of the BL-081 country/retry-storm fix**. The remediation (re-wiring refresh, recommended Dir A) is real work with cost/coverage trade-offs and should be scheduled as its own batch after the ops checks (O1–O3) confirm the staleness impact and the fork endpoint. **No fix is implemented in BL-081 (F004 is audit-only).**
