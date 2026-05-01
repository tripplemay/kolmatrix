# MVP Internal Demo Prep — Prod L2 Smoke Checklist (F005)

**Sprint:** MVP-internal-demo-prep  
**Target:** https://kol.guangai.ai (production)  
**Reviewer:** Codex evaluator  
**Date:** _fill in when executed_  
**Expected HEAD SHA:** _run `git rev-parse HEAD` on main before starting_

> Mark each item `[x]` when verified, `[!]` if a defect is found, `[~]` if skipped with reason.  
> Any `[!]` P0/P1 item → set `evaluator_feedback` + `progress.json status = fixing` immediately.  
> P2/P3 items → add to backlog without blocking.

---

## A. Health Baseline (5 items)

- [ ] **A-01** `curl https://kol.guangai.ai/api/health` returns HTTP 200
- [ ] **A-02** Response body `status` = `"healthy"`
- [ ] **A-03** Response body `git_sha` matches expected HEAD SHA (F005 pre-condition)
- [ ] **A-04** Response body `checks.database.status` = `"ok"` and latency implied by uptime > 0
- [ ] **A-05** Response body `checks.redis.status` = `"not_used"` (F007 polish verified)

---

## B. Public Endpoint Smoke (5 items)

- [ ] **B-01** `GET https://kol.guangai.ai/en/login` returns HTTP 200 (unauthenticated)
- [ ] **B-02** `GET https://kol.guangai.ai/en/dashboard` → redirects to `/en/login` (unauthenticated 307)
- [ ] **B-03** All 9 protected routes redirect to login when unauthenticated:
  `/en/discovery`, `/en/database`, `/en/knowledge-base`, `/en/campaigns`,
  `/en/outreach`, `/en/crm`, `/en/roi`, `/en/weekly-report`
  _(curl each, verify 307 → login)_
- [ ] **B-04** `GET /shared/weekly-report/invalid-token-xyz` returns 404 (not 500)
- [ ] **B-05** `GET /api/health` is publicly accessible without session cookie (returns 200)

---

## C. Authenticated Feature Acceptance (14 items)

> Login as `admin@kolmatrix.local` (admin role) for C-01 to C-14.

- [ ] **C-01** `/en/dashboard`: Page loads. Verify all elements visible:
  - 5 KPI tiles (Total KOLs / Active Campaigns / Emails Sent / Products / Avg Value Score)
  - Workflow 6-step bar (steps 1–4 marked done: product/KOL/campaign/email; steps 5–6 pending)
  - CPI Benchmark card with "Sample data" badge and 8 genre bars
  - 30-day ROI trend card (empty state OR chart if campaigns have revenue)
  - Email Performance chart (14-day bars from real EmailLog data)
  - Recent Activity feed (empty state if no AuditLog entries)
  - Recommended KOLs grid (top 5 by value score)

- [ ] **C-02** `/en/discovery`: 15-filter sidebar loads. Apply `Region=Asia` filter; result count updates. Open Smart Match dialog.

- [ ] **C-03** `/en/database`: Page loads with 3 AI Intelligence cards (Market Intel / Campaign Timing / Budget Benchmark) and KOL tier filter chips.

- [ ] **C-04** `/en/kols/[id]` (click first KOL from database): Banner + follower stats load. Recent 6 videos section visible. Topic cloud renders. Confirm no "Audience" tab present.

- [ ] **C-05** `/en/knowledge-base`: Exactly 5 Products visible (Honor of Kings / Genshin Impact / PUBG Mobile / Pokemon Go / Clash Royale). 3 products show pre-generated AI assets badge. 2 show "Generate AI assets" button.

- [ ] **C-06** Click "Generate AI assets" on Pokemon Go → AIGC job triggers → within 15s assets populate (or spinner shown). Confirm no 500 error.

- [ ] **C-07** Submit empty `Target Audience` field on Product create modal → i18n error "Target audience is required." appears. Submit with value → form succeeds.

- [ ] **C-08** `/en/campaigns`: At least 3 seeded campaigns listed. Status chip filter works (click "Active" → filters). Confirm no "Import" button present (F007 removal).

- [ ] **C-09** Click a campaign to open `/en/campaigns/:id`: KOL panel lists associated KOLs. AI Suggestions card visible with CTA link (links to `/campaigns/{id}` or `/discovery`).

- [ ] **C-10** `/en/outreach`: Template dropdown shows system + user templates. Select a template, click "AI Customize" → customized preview renders. Send 1 test email → success toast.

- [ ] **C-11** `/en/crm`: 6 relationship-status cards (Prospect / Contacted / Interested / Contracted / Active / Closed) visible. KOL funnel chart renders.

- [ ] **C-12** `/en/roi`: 4 KPI tiles (Total Spend / Total Revenue / ROI % / Net Profit). AI Insights panel visible. 30-day trend chart renders.

- [ ] **C-13** `/en/weekly-report`: Click "Generate Report" (or use cached). Report preview renders. "Download PDF" button works. Share link copies to clipboard.

- [ ] **C-14** Login page (`/en/login`): Hero text shows "The KOL command center / for global game studios." 3 chips visible (creators / AI match / locales). No studio names or trust footer present (F007 removal).

---

## D. Cross-Locale Verification (4 items)

- [ ] **D-01** `/zh/dashboard`: Page loads in Chinese. KPI tile labels in 中文. Workflow step labels in 中文.
- [ ] **D-02** `/zh/login`: Hero text displays Chinese copy. zh-login visual baseline previously regenerated.
- [ ] **D-03** `/ja/discovery`: Filter labels show Japanese translation (not English fallback).
- [ ] **D-04** `/es/outreach`: Template dropdown and button labels in Spanish.

---

## E. Visual Baseline Check (3 items)

- [ ] **E-01** Trigger "Update visual baselines" GitHub workflow on main (to regenerate `dashboard.png` after F001 layout changes). Verify workflow completes green and pushes updated `dashboard.png`.
- [ ] **E-02** Run visual regression E2E locally on staging or CI: `npx playwright test tests/e2e/visual-regression.spec.ts` — all 14 baseline comparisons pass (dashboard skips gracefully if baseline absent pending E-01).
- [ ] **E-03** Load `/en/dashboard` on 375px mobile viewport — WorkflowSteps scrolls horizontally, CPI card + ROI card stack vertically, no overflow.

---

## F. Automated Test Suite (3 items)

- [ ] **F-01** `npm run test:coverage` (unit + integration) passes locally on this branch — 0 failing tests.
- [ ] **F-02** CI (GitHub Actions) main HEAD: `unit-tests` + `integration-tests` jobs green.
- [ ] **F-03** Playwright E2E smoke (`bm1-flow` spec) passes against staging URL if available.

---

## G. Performance (4 items — optional, P3)

- [ ] **G-01** Lighthouse performance score ≥ 70 on `/en/dashboard` (run: `npx lighthouse https://kol.guangai.ai/en/dashboard --output=json`)
- [ ] **G-02** LCP (Largest Contentful Paint) < 2.5 seconds on `/en/dashboard`
- [ ] **G-03** CLS (Cumulative Layout Shift) < 0.1 on dashboard (no recharts resize jump)
- [ ] **G-04** `/api/health` response time < 500 ms (repeated 3× to confirm stability)

---

## Defects Found

_Fill in during execution. Format: `[P0/P1/P2/P3] <page> — <description>`_

| Priority | Page | Description | Status |
|----------|------|-------------|--------|
| | | | |

---

## Sign-off Summary

**Reviewer:**  
**Date:**  
**Prod HEAD SHA:**  
**Total items:** 34  
**Passed:** _  
**Deferred (P2/P3):** _  
**Blockers (P0/P1):** _  

> **VERDICT:** [ ] prod 可承接团队内部 demo  /  [ ] blocking issue found — see `evaluator_feedback`
