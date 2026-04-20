# BI2 F006 Exit-2 Drill Report (2026-04-20)

## Scope
- Target feature: `F006` rollback script
- Goal: verify `rollback.sh` exit `2` branch under controlled, production-safe drill
- Spec followed: `docs/specs/BI2-f006-exit2-drill.md`

## Execution Summary
- Drill started on VPS at `2026-04-20T10:20:26Z`
- Temporary stub replaced `/opt/kolmatrix/scripts/healthcheck.sh` to always exit 1
- `rollback.sh` executed with overridden `PREV_SHA_FILE=/tmp/prev-sha-f006-drill`
- Drill completed at `2026-04-20T10:22:29Z`
- Trap restored real healthcheck script and removed temp files

## Key Evidence
From `/tmp/f006-exit2-drill.log`:
- `[f006-drill-stub] simulated healthcheck failure`
- `❌ Rollback ALSO failed healthcheck — MANUAL INTERVENTION REQUIRED`
- `[drill] rollback.sh returned exit code: 2`
- `[drill] ✅ exit code 2 confirmed`
- `[drill] ✅ public /api/health still 200 (service unaffected by drill)`
- `[drill] ✅ healthcheck.sh restored from backup`
- `[drill] ✅ git diff clean — scripts/healthcheck.sh matches HEAD`

## Cleanup / Safety Checks
- `ls /opt/kolmatrix/scripts/healthcheck.sh.f006-drill.bak` => no such file
- `ls /tmp/prev-sha-f006-drill` => no such file
- `git diff --stat scripts/healthcheck.sh` => empty
- real healthcheck re-run => `✅ Healthy on attempt 1/5`

## Verdict
- `F006`: **PASS**
- Batch unresolved issue (`F006 PARTIAL`) is now closed.
