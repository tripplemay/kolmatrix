# BM2 Campaign + Outreach + ROI — L2 Staging Verification (2026-04-26)

## Scope
- Environment: `https://staging.kol.guangai.ai`
- Layer: L2 (staging, authenticated end-to-end checks)
- Evaluator: `Reviewer`
- Authorization: user granted on 2026-04-26

## Preflight
- `GET /login` redirects to locale page: PASS (`307 -> /en/login`)
- `GET /api/health`: PASS
  - response: `status=healthy`
  - db check: `ok`

## Executed Commands
1. Connectivity / health
- `curl -I https://staging.kol.guangai.ai/login`
- `curl https://staging.kol.guangai.ai/api/health`

2. Staging E2E (single worker, chromium)
- `env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/bm1-flow.spec.ts tests/e2e/marketer-dashboard.spec.ts tests/e2e/journey-a.spec.ts tests/e2e/journey-b.spec.ts --project=chromium --workers=1 --timeout=180000`

3. Authenticated page probe (Playwright script)
- login with `marketer@kolmatrix.local / KOLM@2026!`
- probe `/en/outreach`, `/en/roi`, `/en/weekly-report`

## Results

### A) E2E Summary
- Total: 7
- Passed: 5
- Failed: 2

Passed:
- `bm1-flow.spec.ts` full journey PASS
- `marketer-dashboard.spec.ts` all 4 tests PASS

Failed:
1. `journey-a.spec.ts` FAIL at `/en/outreach`
- assertion: `getByTestId('outreach-page')` not found
- failure page snapshot: `This page couldn’t load` / `A server error occurred`

2. `journey-b.spec.ts` FAIL at `/en/roi`
- assertion: `getByTestId('roi-page-title')` not found
- failure page snapshot: `404 This page could not be found.`

### B) Authenticated Route Probe (post-login)
- `/en/dashboard` -> `200`
- `/en/discovery` -> `200`
- `/en/campaigns` -> `200`
- `/en/campaigns/new` -> `200`
- `/en/outreach` -> `500` (server error page)
- `/en/roi` -> `404`
- `/en/weekly-report` -> `404`

## Findings (ordered by severity)

1. **P0 — BM2 core route unavailable in staging (`/en/roi`, `/en/weekly-report` 404)**
- Impact: BM2 ROI and weekly-report features are not deploy-available on staging.
- Evidence: journey-b failure + authenticated probe status codes.

2. **P0 — BM2 outreach route runtime failure (`/en/outreach` 500)**
- Impact: outreach flow cannot be verified in L2; page crashes on staging.
- Evidence: journey-a failure + authenticated probe status `500` with server error shell.

## Verdict
- **L2 staging verification: FAIL**
- BM2 cannot be considered L2-complete on staging as of 2026-04-26.

## Suggested Next Reverify Gate
- After generator fixes/deploys staging:
  1. `/en/outreach` returns 200 and renders `data-testid="outreach-page"`
  2. `/en/roi` returns 200 and renders `data-testid="roi-page-title"`
  3. `/en/weekly-report` returns 200 and renders `data-testid="weekly-report-page-title"`
  4. Re-run the same staging suite (7 tests) with all PASS

