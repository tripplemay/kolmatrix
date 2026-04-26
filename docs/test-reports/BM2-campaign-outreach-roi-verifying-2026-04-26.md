# BM2 Campaign + Outreach + CRM + ROI — Verifying Report (2026-04-26)

## Scope
- Sprint: `BM2-campaign-outreach-roi`
- Stage: `verifying` (L1 local first)
- Evaluator: `Reviewer`
- Source docs:
  - `docs/specs/BM2-campaign-outreach-roi-spec.md`
  - `features.json`
  - `.auto-memory/role-context/evaluator.md`
  - `harness-rules.md`

## L1 Local Environment
- Setup command: `bash scripts/test/codex-setup.sh`
- Result: Next.js dev server started on `http://localhost:3099`
- Seed evidence: setup output reported `templates: 0`
- Smoke caveat: `bash scripts/test/codex-wait.sh` failed because `/login` returns `307` to `/en/login`; direct `curl http://localhost:3099/en/login` and browser login both succeeded.

## Automated Test Results
| Check | Result | Evidence |
|---|---:|---|
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0 |
| `npm run lint` | PASS | `eslint` exited 0 |
| `npm run test:unit` | PASS | 61 files / 340 tests passed |
| `npm run test:integration` | PASS | 27 files / 214 tests passed |
| `bash scripts/test/codex-e2e.sh tests/e2e/journey-a.spec.ts tests/e2e/journey-b.spec.ts tests/e2e/visual-regression.spec.ts` | PARTIAL | Journey A and B passed; 12 visual tests skipped |

## Manual / Browser Smoke
| Route | Result | Evidence |
|---|---:|---|
| `/en/login` | PASS | Login as `marketer@kolmatrix.local` reached `/en/dashboard` |
| `/en/campaigns` | PASS | Campaign list rendered 3 campaigns and New Campaign link |
| `/en/outreach` | PARTIAL | Page rendered, but system templates were absent after official setup |
| `/en/emails` via App Shell Email Center link | FAIL | 404 page |
| `/en/analytics` via App Shell Analytics link | FAIL | 404 page |

## Blocking Findings

### BM2-F011-001 — Visual baseline PNGs are missing from git
- Severity: P0 / signoff blocker
- Requirement:
  - BM2 spec §2.5 and §F011: visual baseline PNG in git is a hard gate.
  - Evaluator role rule: scaffolded `.spec.ts` without PNG baseline is PARTIAL, not PASS.
- Evidence:
  - `find tests/screenshots/baseline -maxdepth 1 -type f -name '*.png' -print` returned no files.
  - Visual E2E result: 12 skipped, 0 visual comparisons executed.
- Impact: BM2 cannot be signed off; `docs.signoff` must remain null.
- Expected fix: generate and commit at least:
  - `tests/screenshots/baseline/en-campaigns.png`
  - `tests/screenshots/baseline/en-campaign-detail.png`
  - `tests/screenshots/baseline/en-outreach.png`
  - `tests/screenshots/baseline/en-crm.png`
  - `tests/screenshots/baseline/en-roi.png`
  - `tests/screenshots/baseline/en-weekly-report.png`

### BM2-F006-002 — Official Codex setup leaves EmailTemplate empty
- Severity: P1
- Requirement: F002 seeds 5 system templates × en/zh, and F006 requires an EmailTemplate selector for outreach.
- Evidence:
  - `bash scripts/test/codex-setup.sh` seed output: `templates: 0`
  - `/en/outreach` rendered the composer, but the template selector had no usable template options after the official setup path.
- Impact: local L1 setup cannot exercise the full outreach flow "choose template → AI customize → send" without an extra unlisted seed step.
- Expected fix: include BM2 system templates in the official local/staging setup path, or update the harness setup script to run `npm run seed:email-templates` after `npm run db:seed`.

### BM2-NAV-003 — App Shell links point to routes that 404
- Severity: P1
- Evidence:
  - Sidebar `Email Center` link points to `/en/emails`; route returns 404.
  - Sidebar `Analytics` link points to `/en/analytics`; route returns 404.
  - Implemented BM2 routes are `/en/outreach` and `/en/roi`.
- Impact: users can reach BM2 pages by direct URL/E2E, but primary navigation exposes broken links and hides implemented BM2 surfaces.
- Expected fix: update App Shell navigation to route to implemented BM2 pages, or add route aliases/redirects.

### BM2-HARNESS-004 — `codex-wait.sh` smoke check no longer matches locale redirect behavior
- Severity: P2 / test harness
- Evidence:
  - `bash scripts/test/codex-wait.sh` timed out waiting for `/login` HTTP 200.
  - `curl -i http://localhost:3099/login` returned `307 Location: /en/login`.
  - `/en/login` is healthy and browser login succeeds.
- Impact: the documented two-step local startup flow reports false failure even when Next.js is ready.
- Expected fix: make `codex-wait.sh` accept the locale redirect or poll `/en/login`.

## Coverage Notes
- L1 schema/API/unit coverage is strong: typecheck, lint, unit, integration all passed.
- Journey A and Journey B E2E smoke passed locally.
- Visual fidelity was not actually validated because baselines are absent.
- L2 staging was not executed in this round because L1 has signoff blockers; running L2 would not change the current non-PASS verdict.

## Verdict
- BM2 cannot sign off in this round.
- Recommended state transition: `verifying` → `fixing`.
- Reverification focus:
  1. Confirm baseline PNGs are committed and visual tests no longer skip.
  2. Confirm official setup seeds 10 system templates or otherwise documents/runs the required seed.
  3. Confirm App Shell primary navigation does not expose `/en/emails` or `/en/analytics` 404s.
  4. Re-run L1 automated suite and BM2 E2E; then proceed to required staging L2.
