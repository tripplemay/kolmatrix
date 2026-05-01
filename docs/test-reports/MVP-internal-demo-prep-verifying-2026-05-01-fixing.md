# MVP Internal Demo Prep - Prod L2 Smoke Report

## Summary
- Scope: `MVP-internal-demo-prep` prod L2 smoke for `F005`
- Documents:
  - `docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`
  - `docs/specs/MVP-internal-demo-prep-spec.md`
  - `docs/specs/B5-kol-data-enrichment-spec.md`
- Environment: `https://kol.guangai.ai`
- Auth: `admin@kolmatrix.local`
- Expected prod HEAD: `057eeec` (`origin/main`)
- Deployed prod health SHA observed: `d906060`
- Result totals: `23 PASS / 4 FAIL / 2 BLOCKED / 5 NOT RUN`
- Verdict: `blocking issue found`

## Test Cases
- A-01 PASS - `/api/health` returns HTTP 200
- A-02 PASS - `status = healthy`
- A-03 FAIL - `git_sha` does not match expected HEAD (`d906060` vs `057eeec`)
- A-04 PASS - `checks.database.status = ok`, `latency_ms = 4`
- A-05 PASS - `checks.redis.status = not_used`

- B-01 PASS - `/en/login` returns 200 unauthenticated
- B-02 PASS - `/en/dashboard` redirects to `/en/login` unauthenticated
- B-03 PASS - All 8 protected routes redirect to login unauthenticated
- B-04 PASS - `/shared/weekly-report/invalid-token-xyz` returns 404
- B-05 PASS - `/api/health` is publicly accessible

- C-01 PASS - Dashboard renders KPI row, workflow, CPI card, ROI card, email chart, recent activity, top KOLs
- C-02 PASS - Discovery sidebar loads; `Region=Asia` filter changes result count from `787` to `409`; Smart Match dialog opens
- C-03 FAIL - Database page does not match required AI intelligence cards; current UI shows `Import CSV` and lacks `Market Intel` / `Campaign Timing` / `Budget Benchmark`
- C-04 PASS - KOL detail page shows banner, recent videos, topic cloud canvas, and no Audience tab
- C-05 FAIL - Knowledge Base shows 6 products and no `Generate AI assets` buttons; checklist expects 5 products with 3 pre-generated and 2 generate actions
- C-06 BLOCKED - Could not validate `Generate AI assets` flow because the expected button is absent in the current UI
- C-07 PASS - Product create modal validates empty `Target Audience` with `Target audience is required.`
- C-08 PASS - Campaigns page shows 4 seeded campaigns; `Active` filter reduces rows from 4 to 3; no Import button is present
- C-09 PASS - Campaign detail shows KOL panel and AI Suggestions card
- C-10 FAIL - Outreach AI customize dialog opens, but AI rewrite returns `Campaign or template not found.`; send-batch path still works after adding a self email
- C-11 PASS - CRM page shows KPI strip, pipeline bars, funnel, and recent changes
- C-12 PASS - ROI page shows KPI strip, trend chart, and AI Insights panel
- C-13 BLOCKED - Weekly report remained in `Calling the AI engine…` during the verification window; preview/export actions did not materialize
- C-14 PASS - `/zh/login` displays Chinese hero copy and chip row; login page text matches the localized experience

- D-01 PASS - `/zh/dashboard` renders Chinese labels and workflow copy
- D-02 PASS - `/zh/login` localized hero text renders in Chinese
- D-03 PASS - `/ja/discovery` shows Japanese translation instead of English fallback
- D-04 PASS - `/es/outreach` shows Spanish translation for the composer shell

- E-01 NOT RUN - GitHub visual baseline workflow was not exercised in this prod smoke
- E-02 NOT RUN - Playwright visual regression suite was not run in this smoke pass
- E-03 NOT RUN - Mobile viewport dashboard check was not run

- F-01 NOT RUN - `npm run test:coverage` not run in this prod smoke
- F-02 NOT RUN - CI jobs not checked in this prod smoke
- F-03 NOT RUN - Playwright E2E smoke not run against staging URL in this prod smoke

- G-01 NOT RUN - Lighthouse audit not run
- G-02 NOT RUN - LCP not measured
- G-03 NOT RUN - CLS not measured
- G-04 NOT RUN - repeated `/api/health` timing not measured

## Defects
- [High] Prod deployment SHA mismatch: `/api/health` reports `git_sha=d906060`, but the repo tip expected for this smoke is `057eeec`. This blocks signoff because the deployed build cannot be traced to the current approved head.
- [High] Database page is out of alignment with the smoke checklist. The current UI shows `Import CSV` and a different AI intelligence panel, while the checklist requires three specific cards: `Market Intel`, `Campaign Timing`, and `Budget Benchmark`.
- [High] Knowledge Base is out of alignment with the smoke checklist. The page currently shows 6 products, not 5, and the expected `Generate AI assets` actions are absent.
- [High] Outreach AI customize flow fails. Opening the dialog on the selected campaign/template shows `Campaign or template not found.` instead of a rewritten preview.
- [Medium] Weekly report generation did not complete within the verification window. The page stayed on `Calling the AI engine…`, so preview/export/share could not be validated.

## Coverage Gaps
- The optional visual regression and performance sections were not exercised in this prod smoke.
- I did not run the full automated suites (`test:coverage`, CI, Playwright smoke) as part of this manual prod pass.
- `C-06` could not be independently executed because the expected `Generate AI assets` button is missing from the current Knowledge Base UI.

## Open Questions
- Is the current production UI intentionally diverged from the `MVP-internal-demo-prep` checklist, or is the checklist stale?
- Should the prod smoke accept the current Database / Knowledge Base / Outreach implementations as the intended demo state, or are those pages still expected to match the checklist text exactly?

## Evidence Notes
- Dashboard, Discovery, KOL detail, CRM, ROI, and locale checks passed in browser.
- Discovery filter `Region=Asia` changed the matched count from `787` to `409`.
- Outreach send-batch smoke succeeded after adding `admin@kolmatrix.local` to a KOL row; the recent sent table showed a new `SENT` row.
