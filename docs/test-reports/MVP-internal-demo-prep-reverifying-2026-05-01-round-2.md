# MVP Internal Demo Prep — Prod L2 Smoke Report (Round 2)

**Sprint:** `MVP-internal-demo-prep`  
**Role:** `Reviewer / evaluator`  
**Date:** `2026-05-01`  
**Expected HEAD SHA:** `7af00b8`

## Scope

- Prod smoke for `F005`
- Source checklist: [`docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`](../test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md)
- Environment: `https://kol.guangai.ai`

## Sources Used

- [`progress.json`](/Users/yixingzhou/project/joyce/progress.json)
- [`docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`](../test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md)
- [`docs/specs/MVP-internal-demo-prep-spec.md`](../specs/MVP-internal-demo-prep-spec.md)
- Prod UI on `https://kol.guangai.ai`

## Coverage Summary

- `A` Health baseline: 5/5 PASS
- `B` Public endpoint smoke: 5/5 PASS
- `C` Authenticated feature acceptance: 12 PASS / 2 FAIL
- `D` Cross-locale verification: 4/4 PASS
- `E` Visual baseline checks: deferred
- `F` Automated suite: 3/3 PASS
- `G` Performance: 1 PASS / 3 deferred

Overall:
- PASS: 30
- FAIL: 2
- Deferred: 6

## Test Results

### A. Health Baseline

- A-01 PASS - `/api/health` returned HTTP 200
- A-02 PASS - `status = healthy`
- A-03 PASS - `git_sha = 7af00b8`
- A-04 PASS - `checks.database.status = ok`, latency under 500ms
- A-05 PASS - `checks.redis.status = not_used`

### B. Public Endpoint Smoke

- B-01 PASS - `/en/login` returned HTTP 200
- B-02 PASS - `/en/dashboard` redirected to `/en/login`
- B-03 PASS - all 8 protected routes redirected to login
- B-04 PASS - `/shared/weekly-report/invalid-token-xyz` returned HTTP 404
- B-05 PASS - `/api/health` was publicly accessible

### C. Authenticated Feature Acceptance

- C-01 PASS - Dashboard rendered 5 KPI tiles, 6 workflow steps, CPI card, ROI card, email performance, recent activity, and 5 recommended KOLs
- C-02 PASS - Discovery filter sidebar loaded; applying `region=JP` reduced results from `787 KOLs matched` to `145 KOLs matched`; Smart Match dialog opened
- C-03 PASS - Database page rendered quick stats, filters, insights panel, and 4 saved KOL rows
- C-04 PASS - KOL detail page rendered banner, recent videos, topic cloud canvas, and no `Audience` tab
- C-05 PASS - Knowledge Base rendered exactly 5 products; only `Clash Royale` still exposed `Generate AI assets`
- C-06 PASS - `Pokemon Go` already showed ready assets: `3 email templates` and `2 video scripts`
- C-07 PASS - Creating a product with blank `Target Audience` showed `Target audience is required.`
- C-08 PASS - Campaigns page rendered 4 seeded rows; status chip filter toggled; no Import button was present
- C-09 PASS - Campaign detail page rendered the AI Suggestions card and Outreach CTA
- C-10 FAIL - Outreach AI customize never produced the editable preview; after waiting up to 35s on two seeded campaigns, dialog remained on original template and surfaced `AI service could not respond. Please retry.`
- C-11 PASS - CRM rendered KPI strip and funnel
- C-12 PASS - ROI rendered KPI strip, trend chart, and insights panel
- C-13 FAIL - Weekly Report preview/share worked, but `Download PDF` did not trigger `beforeprint` in headless prod verification, so the download action was not verified
- C-14 PASS - Login page copy and layout matched the new demo polish

### D. Cross-Locale Verification

- D-01 PASS - `/zh/dashboard` rendered Chinese navigation and dashboard copy
- D-02 PASS - `/zh/login` rendered Chinese login copy
- D-03 PASS - `/ja/discovery` rendered Japanese filter labels
- D-04 PASS - `/es/outreach` rendered Spanish Outreach copy

### E. Visual Baseline Check

- E-01 DEFERRED - not re-run in this round
- E-02 DEFERRED - not re-run in this round
- E-03 DEFERRED - not re-run in this round

### F. Automated Test Suite

- F-01 PASS - `npm run test:coverage`
  - `97` test files
  - `622` tests passed
  - Coverage: statements `81.67%`, branches `73.38%`, functions `81.49%`, lines `83.21%`
- F-02 PASS - GitHub Actions `CI` on `main` was green
  - `Unit tests + coverage`: success
  - `Integration tests (Testcontainers)`: success
  - `E2E tests (Playwright)`: success
- F-03 PASS - Playwright E2E smoke against prod:
  - `tests/e2e/journey-a.spec.ts`: pass
  - `tests/e2e/journey-b.spec.ts`: pass

### G. Performance

- G-01 DEFERRED
- G-02 DEFERRED
- G-03 DEFERRED
- G-04 PASS - `/api/health` latency samples: `2803ms, 369ms, 316ms`

## Defects Found

| Priority | Page | Description | Status |
|---|---|---|---|
| High | `/en/outreach` | AI customize did not render the editable rewrite preview and eventually returned `AI service could not respond. Please retry.` on two seeded campaigns. This blocks the core outreach smoke path. | Blocking |
| Medium | `/en/weekly-report` | `Download PDF` did not trigger `beforeprint` during headless prod verification, so the download action could not be confirmed. Share/clipboard worked. | Open |

## Notes

- `Pokemon Go` already had generated assets by the time this round ran, so the original `Generate AI assets` button was no longer present. The ready-state chips were visible and valid.
- `Journey A` and `Journey B` Playwright smoke tests both passed against prod.
- The prod deployment SHA matched the reviewed commit throughout this round.

## Sign-off Summary

**Reviewer:** Codex  
**Date:** 2026-05-01  
**Prod HEAD SHA:** `7af00b8`  
**Passed:** 30  
**Deferred:** 6  
**Blockers:** 1 hard blocker, 1 open issue

> **VERDICT:** [ ] prod 可承接团队内部 demo  /  [x] blocking issue found — see `evaluator_feedback`
