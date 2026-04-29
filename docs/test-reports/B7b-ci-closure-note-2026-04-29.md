# B7b CI Closure Note (2026-04-29)

## Scope
- Sprint: `B7b-placeholder-and-ai-aux`
- Branch: `main`
- Goal: close repeated CI failures after F001-F004 delivery

## Failure Timeline
1. CI failed on unit assertion drift after introducing `tiers` in discovery filters.
2. CI failed on integration spec bootstrap path (`saved-search` test imported production db singleton before Testcontainers setup).
3. CI failed on E2E runtime i18n issues:
   - `discovery.header.mySearches` requires `{count}` but callsite passed no value.
   - `database.filters.tierHigh|tierMedium|tierLow|tierUnrated` keys missing.
4. CI failed on visual regression diffs (`en-discovery`, `en-database`, `en-campaign-detail`).
5. Baseline regeneration workflow initially failed because service image lacked pgvector extension.

## Root Causes
- Contract drift between new filter schema and legacy test expectations.
- Integration test referenced app singleton instead of test DB helper transaction wrapper.
- i18n message contract not fully propagated to runtime callsites and locale files.
- Visual baselines stale after UI changes.
- Workflow infra mismatch: `postgres:16-alpine` cannot apply pgvector migration.

## Fixes Applied
- Updated `src/lib/kol/__tests__/filters.test.ts` expectation to include `tiers`.
- Switched `tests/integration/saved-search.test.ts` from `withTenant` in `@/lib/db` to test helper `asTenant`.
- Fixed discovery i18n call:
  - `src/app/[locale]/(app)/discovery/page.tsx` now passes `count` to `mySearches`.
- Added tier labels to locale files:
  - `messages/en.json`
  - `messages/zh.json`
  - `messages/ja.json`
  - `messages/ko.json`
  - `messages/es.json`
- Fixed baseline workflow DB image:
  - `.github/workflows/update-visual-baselines.yml` from `postgres:16-alpine` to `pgvector/pgvector:pg16`.
- Reran `Update visual baselines` workflow successfully and pushed regenerated PNG baselines.
- Triggered fresh CI on top of updated baselines.

## Outcome
- Latest CI on `main` passed after the above fixes and baseline refresh.
- Closure state: resolved.

