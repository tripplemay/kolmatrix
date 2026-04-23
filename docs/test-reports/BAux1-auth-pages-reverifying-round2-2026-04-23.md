# BAux1 Auth Pages Reverifying Report — Round 2 (2026-04-23)

## Scope
- Sprint: `BAux1-auth-pages`
- Stage: `reverifying` (`fix_rounds=2`)
- Evaluator: `Reviewer`
- Spec: `docs/specs/BAux1-auth-pages-spec.md`

## Environment
- Git HEAD: `4e15495`
- L1 stack: `bash scripts/test/codex-setup.sh` on `localhost:3099`
- Proxy isolation: all test commands run with proxy vars unset

## Smoke
- `GET /api/health` -> `200`
- `HEAD /login` -> `307 location: /en/login` (same-origin, fixed)
- `HEAD /en/request-access` -> `200`

## Automated Verification

### Coverage
- Command: `npm run test:coverage`
- Result: **PASS**
- Summary: 31 files passed, 101 tests passed, lines coverage 94.17%

### Integration
- Command: `npm run test:integration`
- Result: **PASS**
- Summary: 8 files passed, 49 tests passed

### E2E
- Command: `bash scripts/test/codex-e2e.sh`
- Result: **PASS (15 passed, 1 skipped)**
- Notes:
  - `tests/e2e/login-cinematic.spec.ts` all relevant BAux1 login checks passed
  - `tests/e2e/request-access.spec.ts` all relevant BAux1 access-request checks passed

## Acceptance Gap Check
- F004 acceptance requires visual baselines for `/en/login` and `/en/request-access`.
- Current baseline files under `tests/screenshots/baseline/`:
  - `dashboard.png` only
- No committed login/request-access visual baseline files found.

## Feature Verdict
- F001 AccessRequest Prisma model + migration: **PASS**
- F002 Login page UI rewrite: **PASS**
- F003 Request-access page + action + email notify: **PASS**
- F004 Test coverage + i18n + visual baseline: **FAIL**
  - reason: required login/request-access visual baselines not present in repo

## Conclusion
- Overall: **NOT ACCEPTED (round 2)**
- Workflow returns to `fixing`
- Remaining action scope: F004 visual baseline delivery for `/en/login` + `/en/request-access` (and corresponding visual assertion wiring if required by team convention)
