# BAux1 Auth Pages Reverifying Report (2026-04-23)

## Scope
- Sprint: `BAux1-auth-pages`
- Stage: `reverifying` (fix_rounds=1)
- Evaluator: `Reviewer`
- Spec: `docs/specs/BAux1-auth-pages-spec.md`

## Environment
- Git HEAD: `4b1ab77`
- Identity: `.agent-id` -> `codex: Reviewer`
- L1 env: `bash scripts/test/codex-setup.sh` (Next.js on `localhost:3099`)
- Proxy isolation: all test commands executed with proxy env removed (`-u all_proxy/http_proxy/https_proxy`)

## Smoke
- `GET http://127.0.0.1:3099/api/health` -> `200`
- `HEAD http://127.0.0.1:3099/en/request-access` -> `200` (previous 500 fixed)
- `HEAD http://127.0.0.1:3099/login` -> `307 Location: http://localhost:3000/en/login` (still wrong for 3099 L1 flow)

## Test Execution

### 1) Coverage
- Command: `npm run test:coverage`
- Result: **PASS**
- Summary: 31 files passed, 101 tests passed, lines coverage 94.17%

### 2) Integration
- Command: `npm run test:integration`
- Result: **PASS**
- Summary: 7 files passed, 38 tests passed
- Note: previous failures in `access-request` integration are fixed

### 3) E2E
- Command: `npm run test:e2e` -> FAIL (webServer conflict/start failure)
- Command: `E2E_PORT=3099 npm run test:e2e` -> FAIL (`Timed out waiting 180000ms from config.webServer`)
- Conclusion: E2E still cannot complete in Codex L1 workflow, so BAux1 cannot sign off yet

## Feature Verdict
- F001 AccessRequest Prisma 模型 + migration: **PASS**
- F002 登录页 UI 重写: **FAIL**
  - `/login` remains hard-redirected to `localhost:3000`, violating L1 host/port consistency in evaluator environment
- F003 请求访问页面 + Server Action + admin 邮件通知: **PASS**
- F004 测试覆盖 + i18n + visual baseline: **PARTIAL**
  - unit/integration/coverage passed
  - e2e remains non-executable due webServer readiness/start strategy mismatch in 3099 flow

## Conclusion
- Overall: **NOT ACCEPTED (reverifying round 1)**
- Status should return to `fixing`
- Pending fixes focus:
  1. `/login` route/redirect host-port correctness under Codex 3099
  2. Playwright E2E webServer readiness/startup strategy so `npm run test:e2e` can run green in L1
