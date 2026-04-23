# BM1 Console + KOL Core — Verifying Report (2026-04-23)

## Scope
- Sprint: `BM1-console-kol-core`
- Stage: `verifying` (L1 then L2)
- Evaluator: `Reviewer`

## L1 (localhost:3099) Result
- `api/health`: PASS (`200`, db check ok)
- `npx tsc --noEmit`: PASS
- `bash scripts/validate-rollback-sql.sh`: PASS (`8` migrations include rollback recipe)
- `npm run test:coverage`: PASS (`38 files`, `169 tests`, `Lines 92.26%`)
- `npm run test:integration`: PASS (`18 files`, `123 tests`)
- `bash scripts/test/codex-e2e.sh`: FAIL (1 case)
  - Failed: `tests/e2e/bm1-flow.spec.ts` on default timeout 30s
  - Re-run with `--timeout=120000 --workers=1`: PASS
  - Conclusion: local exists timeout flake risk, but flow can complete locally

## L2 (staging.kol.guangai.ai) Result
- Pre-checks PASS:
  - `/api/health` healthy (db latency ok)
  - unauth access to `/en/knowledge-base` redirects to `/en/login`
  - locale detection redirect:
    - `zh-CN` -> `/zh/dashboard`
    - `en-US` -> `/en/dashboard`
    - `ja-JP` -> `/en/dashboard`
- Core flow FAIL (stable repro):
  - Command (proxy removed):  
    `env -u http_proxy -u https_proxy -u all_proxy E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/bm1-flow.spec.ts --project=chromium --timeout=120000 --workers=1`
  - Result: timeout at sidebar click (`tests/e2e/bm1-flow.spec.ts:58`)
  - Re-run with `--timeout=300000`: same failure
  - Error: `locator.click: Target page, context or browser has been closed`
  - Evidence: `test-results/bm1-flow-BM1-—-full-market-9a794-abase-→-profile-→-dashboard-chromium/`

## Verdict
- BM1 cannot sign off in this round.
- Blocking issue mapped to `F009` (L2 E2E stability on staging).
- Next owner action: Generator fixes staging bm1-flow timeout/closure issue and re-submit for `reverifying`.
