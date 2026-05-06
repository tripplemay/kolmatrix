# BL-044 /discovery AI Semantic Search Signoff 2026-05-06

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：`/zh/discovery` AI chip / 自由文本 semantic search 恢复；验证语义搜索、UI 禁用态、参数互斥与回退分支
> Reviewer：Codex L1 + staging 浏览器走查完成，staging `git_sha=eeeff4a` 且 health 200/ok

## Summary

- Scope: `BL-044` 4 个 generator features，验证 discovery AI semantic search 从 chip / `?ai=` 到 cosine 排序、sidebar soft override、sort inert、互斥参数与 fallback 兜底。
- Documents: [`docs/specs/BL-044-discovery-ai-semantic-search-spec.md`](/Users/yixingzhou/project/joyce/docs/specs/BL-044-discovery-ai-semantic-search-spec.md), [`docs/specs/BL-044-pre-impl-audit.md`](/Users/yixingzhou/project/joyce/docs/specs/BL-044-pre-impl-audit.md), [`progress.json`](/Users/yixingzhou/project/joyce/progress.json)
- Environment: 本地 L1 `npm run test:integration` / `vitest` / `lint` / `typecheck` + staging `https://staging.kol.guangai.ai`
- Result totals: PASS 4, FAIL 0, BLOCKED 0, NOT RUN 0

## Test Cases

- BL-044-TC-01 L1 semantic-search unit / integration / lint / typecheck - PASS
- BL-044-TC-02 Staging discovery base shell + AI chips render - PASS
- BL-044-TC-03 Staging AI chip search returns cosine-ordered 50 KOLs and disables sidebar/sort chrome - PASS
- BL-044-TC-04 Staging free-text `?ai=` query returns 50 KOLs and mutual exclusion drops `search` - PASS

## Execution Results

### BL-044-TC-01 L1 semantic-search regression

Result: PASS
Evidence:
- `npx vitest run tests/unit/semantic-search.test.ts` -> `1/1` file, `10/10` tests PASS
- `npm run test:integration -- tests/integration/discovery-ai-search.test.ts` -> `1/1` file, `4/4` tests PASS
- `npm run lint` -> `0 errors / 3 warnings`
- `npm run typecheck` -> PASS
Observed Behavior:
- Validation, rate-limit fail-fast, chip cache, embed failure fallback, DB failure wrapping and cosine hydration all stayed green.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-044-TC-02 Staging discovery shell

Result: PASS
Evidence:
- Login via `/en/login` with `marketer@kolmatrix.local / KOLMatrix@2026!` reached `/en/dashboard`
- `/zh/discovery` rendered `discovery-grid` with `cardCount=20`
- `discovery-search-bar` rendered and `ai-chip-1/2/3` were visible
- Summary text: `匹配到 1,195 位 KOL`
Observed Behavior:
- The baseline discovery page is live and interactive on staging.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-044-TC-03 AI chip semantic search

Result: PASS
Evidence:
- Clicking `ai-chip-1` navigated to `?ai=🎮 王者荣耀上线适配的 FPS 创作者`
- `active-filter-chip-aiQuery` visible
- `discovery-filters-disabled-banner` visible
- `sort-value` had `aria-disabled="true"`
- `kol-card` count = `50`
- `discovery-ai-fallback-banner` not visible
Observed Behavior:
- Chip search uses semantic results, not the old ILIKE substring path.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-044-TC-04 Free-text `?ai=` and mutual exclusion

Result: PASS
Evidence:
- Direct navigation to `/zh/discovery?ai=会带货且评测客观的男主播` returned `kol-card` count = `50`
- Summary text: `匹配到 50 位 KOL`
- `discovery-ai-fallback-banner` not visible
- Direct navigation to `/zh/discovery?ai=FPS creators&search=should-drop` showed `active-filter-chip-aiQuery` and `active-filter-chip-search` count = `0`
- `discovery-filters-disabled-banner` remained visible on AI-active state
Observed Behavior:
- Free-text AI query resolves through the semantic path; `search` is dropped when `ai` is present.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

## Defects

- None.

## Coverage Gaps

- Live `ENABLE_AI_SEARCH=false` staging toggle was not exercised in this run; the short-circuit / fallback branch is covered by the L1 unit and integration suites.

## Open Questions

- None.

## Final Decision

- Ready: Yes
- Readiness: Ready
- Final: `PASS`
