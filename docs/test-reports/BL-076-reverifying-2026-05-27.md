# BL-076 reverifying report — FAIL

> Sprint: `BL-076-apify-numeric-overflow`
> Phase: `reverifying`
> Reviewer: `codex: Reviewer`
> Date: `2026-05-27`
> HEAD: `f03cda0`

## Summary

BL-076 still cannot be signed off. The fix-round 1 clarification is valid: numeric overflow is no longer reproducing, and the staging run should be evaluated with `--enrichment-limit=10`. But the actual staging run still does not satisfy the locked F005 acceptance because `inserted=0`.

## Findings

### High — staging run is healthy but still misses the locked `inserted > 0` acceptance

I reran the exact fix-round 1 staging command:

```bash
ssh tripplezhou@34.180.93.185 \
  'cd /opt/kolmatrix-staging && set -a && source .env.staging >/dev/null 2>&1 && set +a && AI_DAILY_COST_USD_PER_TENANT_MAX=500 npx tsx scripts/kol-sync-daily.ts --enrichment-limit=10'
```

Live terminal summary:

```text
[enrichment-stage] tenant=753ee82c-0a5b-4795-859a-b56d97be56e5 DONE scanned=10 lang+=2 country+=0 llm_calls=0 cost_est=$0.0000 failed=0
[kol-sync-daily] DONE — report: /opt/kolmatrix-staging/docs/test-reports/kol-sync-daily-2026-05-27.md
[kol-sync-daily] level=INFO summary: discover=2567 inserted=0 updated=1859 failed=0 errors=0 quota_est=1
```

Staging report confirms the same result:

```text
Imported: inserted=0 updated=1859 skipped=708 failed=0
Embedding hook: Embedded=0 Failed=0
Enrichment stage: Scanned=10 language+=2 country+=0 failed=0
```

So fix-round 1 did close the original blocker:

- no `numeric field overflow`
- no import failures
- no error entries

But the current acceptance text still explicitly requires:

- `stats.inserted > 0`
- `stats.failed = 0`

Only the second half is satisfied. Under the current locked spec, this remains a fail.

## Passing evidence

### Prod final evidence

Prod superuser SQL still validates the hotfix:

```text
engagement_rate > 999.99 = 15
engagement_outlier = 157
audit_log kol.import_failed = 0
created_at > 2026-05-26T16:37:00Z = 474
max(engagement_rate) = 9137.06
```

Sample persisted rows above the old Decimal(5,2) ceiling:

```text
tiktok  beyond2known  9137.06  true
tiktok  zyph209       8730.80  true
tiktok  allengngy     5870.02  true
```

### Staging health

`/api/health` remains healthy and now reports:

- `total_active_kols=1871`
- `country_fill_rate=0.032068412613575625`
- `language_fill_rate=0.05130946018172101`

## Conclusion

Result: `FAIL`

Reason:

- the BL-076 hotfix itself is functioning
- staging no longer reproduces overflow
- but the locked F005 acceptance still requires `inserted > 0`, and the real run produced `inserted=0`

## Next step

Generator needs to resolve the acceptance mismatch explicitly:

- either provide a staging setup where a real `inserted > 0` run is reproducible
- or amend the locked acceptance so that a healthy `inserted=0 updated>0 failed=0 errors=0` run is sufficient for reviewer signoff
