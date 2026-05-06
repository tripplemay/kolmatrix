# Prod Browser Walk Report — 2026-05-06

## Summary
- Scope: prod browser walk for the 12-item checklist covering BL-040, BL-044, and BL-024 UX/data paths; cleanup of the two temporary prod KOL rows created during verification.
- Documents: `.auto-memory/environment.md`, `docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`, `src/app/[locale]/(app)/knowledge-base/ProductModal.tsx`, `src/app/[locale]/(app)/database/AddKolDialog.tsx`, `src/app/[locale]/(app)/database/ImportCsvDialog.tsx`, `src/app/[locale]/(app)/weekly-report/WeeklyReportHeader.tsx`, `src/app/[locale]/(app)/outreach/tracking/page.tsx`, `src/app/[locale]/(app)/outreach/suppression/page.tsx`, `src/app/[locale]/(app)/roi/RoiHeader.tsx`.
- Environment: prod `https://kol.guangai.ai` (entered via `https://www.kolquest.com/en/dashboard` redirect), authenticated as `marketer@kolmatrix.local` and `admin@kolmatrix.local` with the rotated `Kolmatrix@2026` password after user authorization.
- Result totals: 9 PASS, 0 FAIL, 3 coverage gaps / data-limited observations.

## Test Cases
- BL-040 /zh/knowledge-base create Product without targetAudience - PASS
- BL-044 /zh/discovery AI chip click returns >=10 KOL - PASS
- BL-044 /zh/discovery free-text semantic search via ?ai=... - PASS
- BL-044 /zh/discovery sidebar soft override - PASS
- BL-044 /zh/discovery sort inert under AI search - PASS
- BL-044 ?ai/?search mutual exclusion - PASS
- BL-024 /zh/database Add KOL form - PASS
- BL-024 /zh/database Import CSV - PASS
- BL-024 /zh/database Export CSV formula-injection safe - PASS
- BL-024 /zh/weekly-report Last Week / Last Month toggle - PASS with data gap
- BL-024 /zh/outreach Tracking + Suppression list - PASS with suppression-data gap
- BL-024 /zh/roi 7D/30D/90D/All-time toggle - PASS with data gap

## Executed Evidence

### BL-040
- Opened `/zh/knowledge-base`, clicked `录入新产品`.
- Filled `name`, `category`, and `uniqueSellingPoints`, intentionally left `targetAudience` blank.
- Submit surfaced the required-field error `请填写目标受众`.
- Product count stayed at `5` while the modal remained open, confirming the form did not create a new row.

### BL-044
- `/zh/discovery` AI chip click navigated to `?ai=🎮 王者荣耀上线适配的 FPS 创作者`.
- Result count was `22` KOLs.
- Active AI filter chip rendered, sidebar showed the AI-disabled banner, and sort controls rendered as inert `span` with `aria-disabled="true"`.
- Free-text semantic search `?ai=会带货且评测客观的男主播` returned `14` KOLs.
- `?ai=foo&search=bar` normalized to AI-only behavior and cleared the `search` chip.

### BL-024
- `/zh/database` Add KOL dialog opened after DOM click and successfully created one KOL row.
- `/zh/database` Import CSV accepted a minimal valid file and imported one KOL row.
- `/api/database/export-csv` escaped a formula-like display name; exported CSV contained `'=CSVTEST`, confirming formula-injection protection.
- `/zh/weekly-report` rendered the PDF action and URL toggle between `?range=lastWeek` and `?range=lastMonth`.
- `/zh/outreach/tracking` showed 50 tracking rows and the expected sent/opened/replied/bounced status chips.
- `/zh/outreach/suppression` rendered an empty suppression table in the current prod dataset.
- `/zh/roi` URL toggles worked for `7d`, `30d`, `90d`, and `allTime`.

## Cleanup
- Deleted the two temporary prod KOL rows created during verification:
  - `handle = prodwalkcsvtest`, `display_name = =CSVTEST`
  - `handle = prodwalkimport`, `display_name = Imported Walker`
- Verified cleanup in the database:
  - `DELETE 2`
  - follow-up query returned `0 rows`
- Verified in the UI:
  - `/zh/database` returned to `4` KOL rows after cleanup.

## Defects
- None confirmed.

## Coverage Gaps
- `/zh/weekly-report` range toggle changed the URL, but the visible content did not change between `lastWeek` and `lastMonth` in the current prod dataset.
- `/zh/outreach/suppression` is empty in prod, so the `unsubscribed` / `bounced` list contents could not be exercised.
- `/zh/roi` range toggles changed the URL, but all KPI values remained `$0` / `—` because the current prod dataset has no revenue-bearing completed campaigns.

## Open Questions
- Are the identical weekly-report views across `lastWeek` and `lastMonth` expected for the current prod dataset, or should the report body differ once historical rows exist?
- Should the suppression list and ROI pages get dedicated seeded prod fixtures for future walk coverage, or is the current empty-state / zero-state behavior sufficient for acceptance?
