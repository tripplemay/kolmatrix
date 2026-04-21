# BAux1 Auth Pages Verifying Report (2026-04-21)

## 1. Scope
- Sprint: `BAux1-auth-pages`
- Stage: `verifying`
- Evaluator: `Reviewer`
- Spec: `docs/specs/BAux1-auth-pages-spec.md`

## 2. Environment and Anti-Interference
- Pulled latest: `git pull --ff-only origin main` -> `dbdb864`
- Identity: `.agent-id` -> `codex: Reviewer`
- Local L1 env: `scripts/test/codex-setup.sh` on `localhost:3099`
- Proxy interference found and removed for validation:
  - existed: `all_proxy=socks5://127.0.0.1:7890`, `http_proxy=http://127.0.0.1:7890`, `https_proxy=http://127.0.0.1:7890`
  - all test commands rerun with proxy env unset (`env -u all_proxy -u http_proxy -u https_proxy ...`)

## 3. Smoke Evidence (L1)
- `GET /api/health` on `127.0.0.1:3099` => `200 healthy`
- `HEAD /en/login` => `200`
- `HEAD /login` => `307 Location: http://localhost:3000/en/login` (wrong host/port redirect)
- `HEAD /en/request-access` => `500 Internal Server Error`
- Next.js runtime log shows root cause:
  - `Module not found: Can't resolve 'resend'`
  - import trace: `src/lib/email/access-request.ts -> src/app/[locale]/request-access/actions.ts`

## 4. Test Execution

### 4.1 Coverage (`npm run test:coverage`)
- Result: **FAIL**
- Failing suites:
  - `src/lib/email/__tests__/access-request.test.ts`
    - `Failed to resolve import "resend"`
  - `src/components/auth/__tests__/RequestAccessForm.test.tsx`
    - Vitest mock hoist loads server action chain and throws `DATABASE_URL is not set`
- Additional error:
  - coverage remap parse error on `src/lib/email/access-request.ts` near `let cachedClient: Resend | null = null;`

### 4.2 Integration (`npm run test:integration`)
- Result: **FAIL**
- `tests/integration/access-request-flow.test.ts`
  - `Cannot find package 'resend' imported from src/lib/email/access-request.ts`
- `tests/integration/access-request.test.ts` (3 failed)
  - `TypeError: Cannot read properties of undefined (reading 'create')` at `admin.accessRequest.create(...)`
  - indicates integration helper/client path does not expose `accessRequest` model at runtime

### 4.3 E2E (`npm run test:e2e`)
- First run blocked by proxy protocol (`socks5`) before any page test.
- Rerun with proxy vars removed still **FAIL**:
  - Playwright webServer startup failed because existing dev server on `3099`
  - config mismatch observed: `playwright.config.ts` hardcodes `baseURL/url = http://localhost:3000`
  - evaluator environment policy requires `3099`, so E2E cannot run in current repo state without conflicting server strategy

## 5. Feature Verdict
- F001 `AccessRequest Prisma 模型 + migration`: **FAIL**
  - integration acceptance fails (`admin.accessRequest.create` undefined)
- F002 `登录页 UI 重写`: **FAIL**
  - route contract broken: `/login` redirects to `localhost:3000`
  - required automated validation path blocked by E2E config/environment mismatch
- F003 `请求访问页面 + Server Action + admin 邮件通知`: **FAIL**
  - `/en/request-access` returns `500` due unresolved `resend` import
- F004 `测试覆盖 + i18n + visual baseline`: **FAIL**
  - declared test suites are not green; coverage/integration/e2e all red

## 6. Conclusion
- Overall: **NOT ACCEPTED**
- Decision: move workflow to `fixing`; all 4 features revert to `pending` for Generator repair.
