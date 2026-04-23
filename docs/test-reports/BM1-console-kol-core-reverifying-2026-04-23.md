# BM1 Console + KOL Core — Reverifying Report (2026-04-23)

## Scope
- Sprint: `BM1-console-kol-core`
- Stage: `reverifying` (staging L2 focus)
- Evaluator: `Reviewer`

## Generator Fix Verification (staging)

### 1) Core flow `bm1-flow.spec.ts`
- Command:
  - `env -u http_proxy -u https_proxy -u all_proxy E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/bm1-flow.spec.ts --project=chromium --timeout=180000 --workers=1`
- Run #1: FAIL
  - Failure moved forward (previous sidebar click timeout fixed).
  - New fail point: `/database` row visibility assertion timeout at `tests/e2e/bm1-flow.spec.ts:123`.
- Run #2: PASS
  - Same command, completed successfully.

结论：本次修复已解决“卡在侧栏点击”的主阻塞点，但该用例在 staging 仍表现为非稳定通过（存在波动）。

### 2) Dashboard regression `marketer-dashboard.spec.ts`
- Command:
  - `env -u http_proxy -u https_proxy -u all_proxy E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/marketer-dashboard.spec.ts --project=chromium --timeout=120000 --workers=1`
- Result: PASS (`4/4`)

### 3) Staging smoke
- `GET /api/health`: healthy
- Locale redirect:
  - `zh-CN` -> `/zh/dashboard`
  - `en-US` -> `/en/dashboard`
  - `ja-JP` -> `/en/dashboard`

## Verdict
- 当前不建议 signoff。
- `F009` 建议继续保留 `pending`，直到 `bm1-flow` 在 staging 连续稳定通过（至少连续两次 PASS）后再进入下一次复验签收。
