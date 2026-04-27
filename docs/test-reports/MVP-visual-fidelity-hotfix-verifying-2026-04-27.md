# MVP-visual-fidelity-hotfix Verifying Report (2026-04-27)

## Scope
- Sprint: `MVP-visual-fidelity-hotfix`
- Stage: `verifying` (first-round acceptance)
- Evaluator: `Reviewer`
- Environments: L1 local + L2 staging (`https://staging.kol.guangai.ai`)

## L1 Results

| Check | Result | Evidence |
|---|---:|---|
| `npm run typecheck` | PASS | exited 0 |
| `npm run lint` | PASS | exited 0 |
| `npm run test:unit -- tests/unit/visual-baselines-shape.test.ts tests/unit/campaign-detail-rsc-boundary.test.ts` | PASS | 2 files / 4 tests passed |
| `npm run test:integration -- tests/integration/database-bulk-action.test.ts tests/integration/campaigns-list-filter-combo.test.ts` | PASS | 2 files / 11 tests passed |
| `npm run render:stitch-previews` | PASS | 18/18 pages rendered |

## L2 Staging Results

### Preflight
- `GET /login` -> `307 /en/login` (PASS)
- `GET /api/health` -> `healthy`, `git_sha=5dbcb07`, db `ok` (PASS)

### E2E Run
Command:
```bash
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
  E2E_BASE_URL=https://staging.kol.guangai.ai \
  npx playwright test \
  tests/e2e/bm1-flow.spec.ts \
  tests/e2e/journey-a.spec.ts \
  tests/e2e/journey-b.spec.ts \
  tests/e2e/marketer-dashboard.spec.ts \
  tests/e2e/visual-regression.spec.ts \
  --project=chromium --workers=1 --timeout=180000
```

Result summary:
- 7 passed
- 13 skipped (all from `visual-regression.spec.ts`, platform policy non-Linux)

## Static Acceptance Checks

- `scripts/render-stitch-previews.ts` exists (PASS)
- `src/components/ui/README.md` exists (PASS)
- `tests/screenshots/baseline/*.png` = 13 files including `en-kols-detail.png` (PASS)
- `tests/e2e/visual-regression.spec.ts` includes `kols-detail` case (PASS)
- className density checks (<20) on target pages (PASS):
  - discovery 14
  - database 18
  - campaigns 16
  - campaign detail page 13
  - kols detail 7
- `CampaignKolPanel.tsx` line count = 130 (PASS; <=250)

## Findings (ordered)

### F002 — FAIL: required fidelity E2E asset missing
- Requirement: `tests/e2e/discovery-fidelity.spec.ts` (features.json acceptance)
- Actual: file missing
- Impact: no dedicated automated proof for discovery prototype marker checks (AI CTA, platform selector, active filter clear)

### F003 — FAIL: required fidelity E2E asset missing
- Requirement: `tests/e2e/database-fidelity.spec.ts` (features.json acceptance)
- Actual: file missing
- Impact: no dedicated automated proof for database prototype marker checks (Insights panel / bulk action bar contract)

### F004 — PARTIAL: integration test file path/name does not match acceptance contract
- Requirement: `tests/integration/campaigns-list-filter.test.ts`
- Actual: `tests/integration/campaigns-list-filter-combo.test.ts` exists and passes
- Impact: functional coverage exists, but artifact does not match spec contract path/name

### F005 — PARTIAL: guardrail test exists but in different layer/path than acceptance contract
- Requirement: `tests/integration/campaign-detail-rsc-boundary.test.ts`
- Actual: `tests/unit/campaign-detail-rsc-boundary.test.ts` exists and passes
- Impact: rule is covered, but acceptance-specified integration artifact is missing

## Verdict
- Overall: **FAIL (needs fixing round)**
- Recommended status transition: `verifying -> fixing`
- Reverify gate:
  1. Add `tests/e2e/discovery-fidelity.spec.ts`
  2. Add `tests/e2e/database-fidelity.spec.ts`
  3. Align F004/F005 test artifact naming/path to acceptance (or update spec with explicit approved equivalence)
  4. Re-run L1 + staging L2 suite
