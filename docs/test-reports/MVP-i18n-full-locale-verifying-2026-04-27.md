# MVP-i18n-full-locale Verifying Report (2026-04-27)

## Scope
- Sprint: `MVP-i18n-full-locale`
- Stage: `verifying` (first-round acceptance)
- Evaluator: `Reviewer`
- Environments: L1 local + L2 staging (`https://staging.kol.guangai.ai`)

## L1 Results

| Check | Result | Evidence |
|---|---:|---|
| `npm run typecheck` | PASS | exited 0 |
| `npm run lint` | PASS | exited 0 |
| `npm run test:unit -- tests/unit/i18n-locale-coverage.test.ts tests/unit/i18n-placeholders.test.ts tests/unit/i18n-html-tags.test.ts tests/unit/i18n-translate-script.test.ts` | PASS | 4 files / 39 tests passed |
| `bash scripts/test/codex-e2e.sh tests/e2e/locale-detection.spec.ts` | PASS | 5/5 passed on standard Codex 3099 harness |

## L2 Staging Results

### Preflight
- `GET /api/health` => healthy, `git_sha=f55718d`
- `GET /login` => 307 redirect to locale login

### Staging E2E
Command:
```bash
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
  E2E_BASE_URL=https://staging.kol.guangai.ai \
  npx playwright test tests/e2e/locale-detection.spec.ts tests/e2e/marketer-dashboard.spec.ts --project=chromium --workers=1 --timeout=180000
```

Result: **8 passed, 1 failed**
- Failed case: `locale-detection.spec.ts` cookie-override test
- Root cause: test fixture hardcodes cookie `domain: "localhost"`; on staging domain (`staging.kol.guangai.ai`) this cookie is ignored.
- Product behavior check: with correct domain cookie (`staging.kol.guangai.ai`), redirect lands on `/ja/login` and `document.documentElement.lang === "ja"`.

### Batch acceptance probe (5 locales × 5 key pages)
Authenticated probe across `/dashboard`, `/discovery`, `/database`, `/campaigns`, `/weekly-report`:
- All 25 routes returned `200`
- `html lang` matched locale on every route (`en/zh/ja/ko/es`)
- No 404 shell observed

## Findings (ordered)

### F001 — FAIL: `i18n:translate:dry` script contract does not run as declared
- Acceptance requires: `npm run i18n:translate:dry` runs and prints untranslated leaves summary.
- Actual:
  - command exits non-zero with `Error: missing --target zh|ja|ko|es`
  - current script enforces explicit `--target`, so no-arg dry-run contract is broken.
- Impact: translation dry-run workflow is not usable as documented/accepted.

### Test portability gap (non-product)
- `tests/e2e/locale-detection.spec.ts` cookie override test is environment-coupled to `localhost` domain.
- On staging this creates a false fail. Product routing/cookie precedence works with staging domain cookie.

## Verdict
- Overall: **FAIL (move to fixing)**
- Recommended transition: `verifying -> fixing`

## Reverify Gate
1. Fix F001 contract: `npm run i18n:translate:dry` must succeed without mandatory `--target` and print untranslated summary.
2. (Optional but recommended) make locale-detection cookie override test domain-aware (`new URL(page.url()).hostname`) to keep staging/local behavior consistent.
3. Re-run L1 i18n suite + staging locale smoke.
