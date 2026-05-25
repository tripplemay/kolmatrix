# BL-070 Reverifying Report

> Date: 2026-05-25
> Batch: `BL-070-reach-insight-cleanup`
> Evaluator: `codex: Reviewer`
> Verdict: `L1 PASS, F008 pending`

## Summary

BL-070 fix-round 3 passes local reverification.

- Functional L1 reverification: PASS
- Perf addendum unit set: PASS
- Targeted E2E reverification: PASS
- Lighthouse desktop logged-in `4 routes × 3 runs`: PASS

The previous blocker is resolved:

- `/en/match` CLS no longer fails the addendum gate
- measured result across all 3 runs: `0.008`

The batch is still not `done` because `F008` remains a prod-facing checklist item set, not because of a local code blocker.

## Environment

- Synced HEAD: `fc79f43`
- Local L1 app: clean restart via `bash scripts/test/codex-setup.sh` on port `3099`

Important note:

- A `3099` listener started at `2026-05-25 14:02` was already present before this reverification.
- Because that predates the current `progress.json.last_updated = 2026-05-25T14:32+0800`, it was treated as stale and replaced with a fresh current-HEAD instance before any verdict was recorded.

## Commands Run

```bash
git pull --ff-only origin main
bash scripts/test/codex-setup.sh
bash scripts/test/codex-wait.sh
npm run typecheck
npx vitest run tests/unit/bl070-f009-lazy-boundaries.test.ts tests/unit/bl070-f010-next-image-migration.test.ts tests/unit/bl070-f011-suspense-stream.test.ts tests/unit/visual-baselines-shape.test.ts
bash scripts/test/codex-e2e.sh tests/e2e/brief-flow.spec.ts tests/e2e/match-flow.spec.ts tests/e2e/reach-flow.spec.ts tests/e2e/insight-flow.spec.ts tests/e2e/ia-refactor-cleanup-2026-05-19.spec.ts tests/e2e/locale-detection.spec.ts tests/e2e/request-access.spec.ts
```

Lighthouse desktop logged-in runs used `playwright/.auth/marketer.json` cookies against:

- `/en/brief`
- `/en/match`
- `/en/reach`
- `/en/insight`

## Results

### Static / unit

- `npm run typecheck` PASS
- Perf addendum unit set PASS: `29/29`

### Targeted E2E

On the clean current-HEAD `3099` instance:

- `133 passed`
- `43 skipped`
- `0 failed`

Relevant points:

- `tests/e2e/match-flow.spec.ts` active coverage PASS
- `tests/e2e/request-access.spec.ts` full flow PASS
- `tests/e2e/reach-flow.spec.ts` PASS
- `tests/e2e/insight-flow.spec.ts` PASS
- `tests/e2e/ia-refactor-cleanup-2026-05-19.spec.ts` PASS
- `tests/e2e/locale-detection.spec.ts` PASS

Historical skip-only cases remain explicit SKIP by design:

- AI recommendation card mutate flows
- C3 detailed-explanation/cache-miss/cap branches
- BL-068 refine branch-result flows
- brief-flow AI server-action mock branches

### Lighthouse desktop logged-in

Median-of-3 summary:

| Route | Scores | Median | FCP | LCP | TBT | CLS | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/en/brief` | `98 / 98 / 97` | `98` | `0.3s` | `1.2-1.3s` | `0ms` | `0` | PASS |
| `/en/match` | `96 / 96 / 96` | `96` | `0.3s` | `1.4-1.5s` | `0ms` | `0.008` | PASS |
| `/en/reach` | `93 / 93 / 93` | `93` | `0.3s` | `1.7s` | `0ms` | `0` | PASS |
| `/en/insight` | `94 / 95 / 95` | `95` | `0.3s` | `1.5-1.6s` | `0ms` | `0` | PASS |

Interpretation:

- The prior `/en/match` CLS blocker is resolved.
- All 4 routes satisfy the score gate `>= 80`.
- All 4 routes satisfy `TBT < 200ms`, `LCP < 2.5s`, `FCP < 1.5s`, and `CLS < 0.05`.
- `/match` is no longer marginal; it passes cleanly with a stable CLS result across all 3 runs.

## Feature Assessment

### F009

Result: `PASS`

- Bundle splitting / lazy-boundary work remains functionally stable.
- No regression surfaced in the targeted reverification set.

### F010

Result: `PASS`

- `/en/match` CLS issue reported in the previous reverification is fixed.
- The route now passes the full Lighthouse metric gate, including the previously failing CLS threshold.

### F011

Result: `PASS`

- Revised Suspense skeleton sizing does not introduce active E2E regressions.
- The intended perf outcome is visible in Lighthouse on `/match`.

### F008

Result: `PARTIAL`

Still not complete because the remaining work is outside this local L1 reverification:

- prod redeploy
- prod `/api/health` git SHA verification
- first prod audit + 24h rerun
- `>= 5` marketer dogfood
- final signoff document completion

## Conclusion

BL-070 fix-round 3 clears the local reverification gate.

Current next step:

- keep batch in `reverifying`
- treat `F009`, `F010`, `F011` as reverified PASS
- continue `F008` prod-facing checklist execution
- only move to `done` after signoff evidence is completed and `docs.signoff` is populated
