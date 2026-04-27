# MVP-kol-seed-redo Verifying Report (2026-04-27)

## Scope
- Sprint: `MVP-kol-seed-redo`
- Stage: `verifying` (first-round acceptance)
- Evaluator: `Reviewer`
- Environments: L1 local + L2 staging (`https://staging.kol.guangai.ai`)

## L1 Results

| Check | Result | Evidence |
|---|---:|---|
| `npm run typecheck` | PASS | exited 0 |
| `npm run lint` | PASS | exited 0 |
| `npm run test:unit -- tests/unit/seed-kol-from-youtube.test.ts tests/unit/validate-kol-from-enriched.test.ts` | PASS | 2 files / 36 tests passed |
| `npm run test:integration -- tests/integration/import-kol-from-youtube.test.ts` | PASS | 1 file / 7 tests passed |
| `npm run seed:kol-youtube:dry` | PASS | dry-run prints matrix + quota plan |
| `env -u YOUTUBE_API_KEY npm run seed:kol-youtube -- --region US --max-results 10 --max-pages 1` | PASS | exits non-zero with clear setup guidance |
| `npm run import:kol-youtube:dry` | PASS | input 760, categories summary printed |

## L2 Staging Results

### Preflight
- `GET /api/health` => healthy, `git_sha=be764a7`

### F006 style probe (Playwright)
Manual probe on `/en/discovery`, `/en/database`, `/en/campaigns` shows `.glass-panel` elements still have computed non-none box-shadow on staging.

- `/en/discovery`: `panelShadowNonNone=22/22`
- `/en/database`: `panelShadowNonNone=6/6`
- `/en/campaigns`: `panelShadowNonNone=4/4`

This conflicts with F006 acceptance requiring no default halo on glass-panel.

## Findings (ordered)

### 1) F002 — FAIL: core quantitative targets not met
Evidence from `docs/kol-seed-youtube-2026-04-27.json`:
- total entries: `760` (< required `>=1000`)
- Chinese region by country (CN+HK+TW): `83` (< required `>=200`)
- quota consumed: `8077` (> required `<=5000`)

Other F002 indicators pass (region coverage 8/8, median followers 116K, category coverage 22), but hard thresholds above are unmet.

### 2) F003 — FAIL: dedupe key does not match acceptance
F003 acceptance requires upsert by `(tenantId, platform, externalId)`.
Current implementation uses `(tenantId, platform, handle)`:
- `tenantId_platform_handle` lookup and upsert in [scripts/import-kol-from-youtube.ts](/Users/yixingzhou/project/joyce/scripts/import-kol-from-youtube.ts:275)
- upsert key repeated in [scripts/import-kol-from-youtube.ts](/Users/yixingzhou/project/joyce/scripts/import-kol-from-youtube.ts:300)

Risk: handle is mutable; channel ID (`externalId`) is the stable identifier required by spec.

### 3) F006 — FAIL: staging behavior not aligned with acceptance
Local CSS implementation removed default glass-panel shadow, but staging runtime (`git_sha=be764a7`) still renders default halo (computed shadow non-none on sampled pages).

As written, F006 acceptance explicitly requires staging side-by-side verification of halo removal; current staging evidence does not satisfy it.

## Feature Verdicts
- F001: PASS
- F002: FAIL
- F003: FAIL
- F004: PASS
- F005: PASS
- F006: FAIL

## Overall Verdict
- Overall: **FAIL (move to fixing)**
- Recommended transition: `verifying -> fixing`

## Reverify Gate
1. F002: rerun crawl strategy to satisfy all hard thresholds simultaneously (`>=1000` total, CN+HK+TW `>=200`, quota `<=5000`) or update acceptance via user-approved spec change.
2. F003: switch dedupe/upsert key to `(tenantId, platform, externalId)` and add/adjust integration tests accordingly.
3. F006: deploy the F006 commit to staging and rerun style probe + required manual spot checks.
