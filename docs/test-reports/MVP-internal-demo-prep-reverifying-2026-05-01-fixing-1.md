# MVP Internal Demo Prep - Prod L2 Reverify Report

## Summary
- Scope: `MVP-internal-demo-prep` prod L2 reverify after generator fix-round 1
- Documents:
  - `docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`
  - `docs/specs/MVP-internal-demo-prep-spec.md`
  - `docs/specs/B5-kol-data-enrichment-spec.md`
- Environment: `https://kol.guangai.ai`
- Auth: `admin@kolmatrix.local`
- Expected main HEAD for this run: `e388082`
- Observed prod `git_sha`: `4a3249b`
- Result totals: `26 PASS / 1 FAIL / 1 BLOCKED / 10 NOT RUN`
- Verdict: `blocking issue found`

## Execution Notes
- Local L1 gate passed before prod smoke:
  - `npm run test:unit -- src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts src/app/[locale]/(app)/outreach/__tests__/customize-action.test.ts src/lib/dashboard/__tests__/email-performance.test.ts src/lib/dashboard/__tests__/recent-activity.test.ts`
  - `npm run test:integration -- tests/integration/seed-demo-products.test.ts tests/integration/outreach-customize-errors.test.ts`
- Prod health baseline:
  - `GET /api/health` = 200, `status=healthy`, `checks.database.status=ok`, `checks.redis.status=not_used`
  - `git_sha` mismatch: `4a3249b` vs expected `e388082`

## Test Cases

### A. Health Baseline
- A-01 PASS - `/api/health` returns 200
- A-02 PASS - `status = healthy`
- A-03 FAIL - `git_sha` does not match expected HEAD (`4a3249b` vs `e388082`)
- A-04 PASS - database check healthy with low latency
- A-05 PASS - redis reported as `not_used`

### B. Public Endpoint Smoke
- B-01 PASS - `/en/login` returns 200 unauthenticated
- B-02 PASS - `/en/dashboard` redirects to `/en/login` unauthenticated
- B-03 PASS - all protected routes redirect to login unauthenticated
- B-04 PASS - invalid shared weekly report token returns 404
- B-05 PASS - `/api/health` is publicly accessible

### C. Authenticated Feature Acceptance
- C-01 PASS - Dashboard renders KPI row, workflow, CPI card, ROI trend, email chart, recent activity, and top KOLs
- C-02 PASS - Discovery filter sidebar works; `Region=Asia` changes count from `787` to `409`; Smart Match dialog opens
- C-03 PASS - Database renders the current AI intelligence stack; checklist text is stale (`AI Intelligence / Coverage Gap / Engagement` is the real UI)
- C-04 PASS - KOL detail page renders banner, recent videos, topic cloud canvas, and no Audience tab
- C-05 PASS - Knowledge Base shows 5 products; 2 cards expose `Generate AI assets`
- C-06 PASS - `Pokemon Go` generate action transitions from `No assets yet` to `Generating assets…` and then to ready assets
- C-07 PASS - empty `Target Audience` in product modal shows `Target audience is required.`
- C-08 PASS - Campaigns list has 4 seeded campaigns; `Active` filter reduces rows from 4 to 3; no Import button present
- C-09 PASS - Campaign detail renders KOL panel and AI Suggestions card
- C-10 BLOCKED - Outreach AI customize cannot be completed end-to-end with current prod seed: default campaign has KOL emails but no product; product-linked campaigns have no KOL emails on file
- C-11 PASS - CRM page renders KPI strip, funnel, and recent changes
- C-12 PASS - ROI page renders KPI strip, trend chart, and AI Insights panel
- C-13 PASS - Weekly report generates preview and exposes download/share/regenerate actions
- C-14 PASS - `/zh/login` renders localized Chinese hero copy and request-access CTA

### D. Cross-Locale Verification
- D-01 PASS - `/zh/dashboard` renders Chinese labels and workflow copy
- D-02 PASS - `/zh/login` renders Chinese hero text
- D-03 PASS - `/ja/discovery` shows Japanese translation
- D-04 PASS - `/es/outreach` shows Spanish translation

### E. Visual Baseline Check
- E-01 NOT RUN
- E-02 NOT RUN
- E-03 NOT RUN

### F. Automated Test Suite
- F-01 NOT RUN
- F-02 NOT RUN
- F-03 NOT RUN

### G. Performance
- G-01 NOT RUN
- G-02 NOT RUN
- G-03 NOT RUN
- G-04 NOT RUN

## Defects
- [High] Prod deployment SHA mismatch: `/api/health` reports `4a3249b`, but the current branch `HEAD` is `e388082`. This blocks signoff because the deployed build is not aligned to the reviewed commit.
- [High] Outreach end-to-end send flow is not satisfiable from the current prod seed without data mutation. The only campaign with KOL emails lacks a linked product; the product-linked campaigns have no KOLs with email on file. `customizeAction` therefore cannot be validated end-to-end on the current prod dataset.

## Coverage Gaps
- The optional visual and performance sections were not exercised.
- The checklist item naming for Database is stale relative to the current UI; I treated the live UI as the source of truth.

## Open Questions
- Should prod be redeployed to `e388082` before the next reverify, or is `4a3249b` the intended deployment tip for this batch?
- Should the prod seed be adjusted so one product-linked campaign also has KOLs with email on file, enabling the required Outreach AI customize/send smoke?

