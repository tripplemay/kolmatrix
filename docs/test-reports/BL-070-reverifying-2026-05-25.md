# BL-070 Reverifying Report

> Date: 2026-05-25
> Batch: `BL-070-reach-insight-cleanup`
> Evaluator: `codex: Reviewer`
> Verdict: `FAIL`

## Summary

BL-070 fix-round 2 clears the functional reverification set on a clean local L1 instance and restores the Lighthouse performance score gate, but it still does not satisfy the full perf addendum acceptance.

- Functional L1 reverification: PASS
- Lighthouse desktop logged-in median scores: PASS
- Full Lighthouse metric gate: FAIL

Blocking finding:

- `/en/match` still violates the addendum CLS threshold. Across 3 Lighthouse desktop logged-in runs, CLS remained `0.348`, above the required `< 0.05`.

Because `F010` acceptance explicitly requires `CLS < 0.05 each`, this fix-round is not signoff-ready and should return to `fixing`.

## Environment

- Synced HEAD: `e66ec35`
- Staging spot check: `bf15b62` + `/api/health` healthy
- Local L1 app: restarted clean via `bash scripts/test/codex-setup.sh` on port `3099`

Important note:

- An old local `next dev` listener from `2026-05-19 17:21` was initially occupying `3099`.
- That stale process produced a false `request-access` failure.
- After killing it and restarting a clean current-HEAD L1 instance, `request-access` passed and the targeted E2E suite went green.

## Commands Run

```bash
git pull --ff-only origin main
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && git rev-parse --short HEAD && curl -fsSL http://localhost:3002/api/health'
bash scripts/test/codex-setup.sh
bash scripts/test/codex-wait.sh
npm run typecheck
npx vitest run tests/unit/i18n-locale-coverage.test.ts tests/unit/request-access-wants-demo.test.ts src/__tests__/middleware-helpers.test.ts
npx vitest run tests/unit/bl070-f009-lazy-boundaries.test.ts tests/unit/bl070-f010-next-image-migration.test.ts tests/unit/bl070-f011-suspense-stream.test.ts tests/unit/visual-baselines-shape.test.ts
bash scripts/test/codex-e2e.sh tests/e2e/brief-flow.spec.ts tests/e2e/match-flow.spec.ts tests/e2e/reach-flow.spec.ts tests/e2e/insight-flow.spec.ts tests/e2e/ia-refactor-cleanup-2026-05-19.spec.ts tests/e2e/locale-detection.spec.ts tests/e2e/request-access.spec.ts
bash scripts/test/codex-e2e.sh tests/e2e/visual-regression.spec.ts
```

Lighthouse desktop logged-in runs used `playwright/.auth/marketer.json` cookies against:

- `/en/brief`
- `/en/match`
- `/en/reach`
- `/en/insight`

## Results

### Static / unit

- `npm run typecheck` PASS
- Core reverification unit set PASS: `20/20`
- Perf addendum unit set PASS: `29/29`

### Targeted E2E

On the clean current-HEAD `3099` instance:

- `133 passed`
- `43 skipped`
- `0 failed`

Relevant points:

- `tests/e2e/request-access.spec.ts` full flow PASS after clean restart
- `tests/e2e/match-flow.spec.ts` remaining active coverage PASS
- historical skip-only cases remain explicit SKIP by design:
  - AI recommendation card mutate flows
  - C3 detailed-explanation/cache-miss/cap branches
  - BL-068 refine branch-result flows

### Visual baseline verification

- `tests/unit/visual-baselines-shape.test.ts` PASS
- `tests/e2e/visual-regression.spec.ts` local result: `29 skipped`

Assessment:

- This is expected on non-Linux local runs because the visual spec is Linux-canonical.
- Local reverification can only prove the baseline contract test, not pixel-diff parity.

### Lighthouse desktop logged-in

Median-of-3 summary:

| Route | Scores | Median | FCP | LCP | TBT | CLS | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/en/brief` | `95 / 97 / 97` | `97` | `0.3s` | `1.2-1.5s` | `0ms` | `0` | PASS |
| `/en/match` | `81 / 80 / 80` | `80` | `0.3s` | `1.2-1.3s` | `0ms` | `0.348` | FAIL |
| `/en/reach` | `95 / 92 / 92` | `92` | `0.3s` | `1.6-1.8s` | `0ms` | `0` | PASS |
| `/en/insight` | `96 / 95 / 95` | `95` | `0.3s` | `1.5s` | `0ms` | `0` | PASS |

Interpretation:

- The previous `performance >= 80` blocker is resolved.
- `/match` still fails the stricter metric gate because CLS is consistently high.
- The repeated `0.348` value across all 3 runs suggests a stable layout-shift issue, not one-off noise.

## Feature Assessment

### F009

Result: `PASS`

- Bundle splitting and lazy boundaries did not regress the functional suite.
- Lighthouse score / TBT / LCP outcomes are now comfortably inside threshold on `/brief`, `/reach`, `/insight`, and enough to lift `/match` to score `80`.

### F010

Result: `FAIL`

- Acceptance requires `CLS < 0.05 each`.
- `/en/match` median and per-run CLS remain `0.348`.
- Therefore the image/perf round cannot be accepted as complete.

### F011

Result: `PASS`

- Suspense/deferred loading changes did not introduce active E2E regressions.
- FCP/LCP/TBT stayed within the addendum thresholds in this reverification set.

### F008

Result: `PENDING / BLOCKED`

Still not signoff-ready because:

- `F010` acceptance is not met
- visual pixel-diff parity was not locally executable on macOS
- prod redeploy / 24h audit / dogfood / final signoff remain downstream work

## Conclusion

BL-070 fix-round 2 improves the batch materially and clears the earlier performance-score blocker, but it does not complete the perf addendum.

Required next step:

- return batch status to `fixing`
- treat `F010` as the active blocker
- investigate and eliminate stable CLS on `/en/match`
- rerun Lighthouse desktop logged-in 3x on all 4 IA routes after the fix
