# BL-023 KOL 评分升级 Signoff 2026-05-07

> 状态：**Reviewer PASS**
> 触发：BL-023 `KOL 评分体系升级` 完成 prod deploy + backfill handoff
> Reviewer：Codex

## Summary

- Scope: 验证 BL-023 的 8 个 feature，覆盖 `valueScore` 新公式、`similarityToScore` 直接映射、`kol-sync-daily.ts` 的 top100 重算链路、`engagement_rate` 单位修正和 prod backfill SQL。
- Documents: [`docs/specs/BL-023-kol-scoring-upgrade-spec.md`](/Users/yixingzhou/project/joyce/docs/specs/BL-023-kol-scoring-upgrade-spec.md), [`src/lib/kol/value-score.ts`](/Users/yixingzhou/project/joyce/src/lib/kol/value-score.ts), [`src/lib/discovery/smart-match.ts`](/Users/yixingzhou/project/joyce/src/lib/discovery/smart-match.ts), [`scripts/kol-sync-daily.ts`](/Users/yixingzhou/project/joyce/scripts/kol-sync-daily.ts), [`scripts/backfill-engagement-rate-bl023-f008.sql`](/Users/yixingzhou/project/joyce/scripts/backfill-engagement-rate-bl023-f008.sql), [`progress.json`](/Users/yixingzhou/project/joyce/progress.json)
- Environment: 本地 L1 `lint` / `typecheck` / unit / integration + staging `https://staging.kol.guangai.ai` + prod `https://kol.guangai.ai`
- Result totals: PASS 5, FAIL 0, BLOCKED 0, NOT RUN 0

## Test Cases

- BL-023-TC-01 L1 pure-function and batch regression - PASS
- BL-023-TC-02 Staging health / login / discovery shell - PASS
- BL-023-TC-03 Staging Smart Match API - PASS
- BL-023-TC-04 Staging KOL detail percent rendering - PASS
- BL-023-TC-05 Prod deploy + backfill SQL verification - PASS

## Execution Results

### BL-023-TC-01 L1 pure-function and batch regression

Result: PASS
Evidence:
- `npm run lint` -> PASS with 3 pre-existing warnings only
- `npm run typecheck` -> PASS
- `npx vitest run tests/unit/value-score.test.ts tests/unit/smart-match-similarity.test.ts tests/unit/kol-sync-engagement-batch.test.ts` -> `33/33` tests PASS
- `npm run test:integration -- tests/integration/kol-discovery.test.ts` -> `12/12` tests PASS
Observed Behavior:
- New engagement ladder, authenticity modifier, direct similarity mapping, and engagement batch unit fix all remained stable.
Mismatch vs Spec:
- None.
Defect Link / Reference:
- None.

### BL-023-TC-02 Staging health / login / discovery shell

Result: PASS
Evidence:
- `https://staging.kol.guangai.ai/api/health` returned `status=healthy`, `database=ok`, `redis=ok`, `git_sha=b6c3668`
- Login with `marketer@kolmatrix.local / KOLMatrix@2026!` reached `/zh/discovery`
- Discovery shell rendered `AI 智能搜索` and the KOL grid; first page showed `匹配到 1,195 位 KOL`
Observed Behavior:
- Staging was healthy and on the expected commit.
Mismatch vs Spec:
- None.
Defect Link / Reference:
- None.

### BL-023-TC-03 Staging Smart Match API

Result: PASS
Evidence:
- Staging DB contained 6 products, including `BL040 Staging Test Game`
- POST `/api/kols/smart-match` for `productId=cmotrswwx0000lfbnt9e89jn6` returned `200`
- Response contained `embeddedJustInTime=true`
- Top result `similarity=0.6064436435699506` produced `matchScore=61`
- Subsequent results stayed in the `57-61` range, all inside the expected `0-100` scale
Observed Behavior:
- Smart Match scoring exposes the direct 0-100 scale required by the spec.
Mismatch vs Spec:
- None.
Defect Link / Reference:
- None.

### BL-023-TC-04 Staging KOL detail percent rendering

Result: PASS
Evidence:
- `/zh/database` loaded 10 saved KOL rows on staging
- `/zh/kols/eb344e66-3aeb-4022-bbb7-e485540514b3` rendered `互动率11.4%` on the overview card
Observed Behavior:
- `engagementRate` displays as a percent, matching the unit fix and the seed/filters/UI contract.
Mismatch vs Spec:
- None.
Defect Link / Reference:
- None.

### BL-023-TC-05 Prod deploy + backfill SQL verification

Result: PASS
Evidence:
- Prod health returned `status=healthy`, `database=ok`, `redis=ok`, `git_sha=e46a7e0`
- Prod DB counts after deploy/backfill:
  - `total_kol=2494`
  - `fraction_rows=0`
  - `percent_rows=138`
  - `value_score_non_null=2482`
- Representative prod sample row from the live data path:
  - `DREAMMAKERCHANNEL #ซูโม่ชอบเล่นเกม`
  - `follower_count=17200`
  - `categories=Gaming|Racing`
  - `engagement_rate=3.00`
  - `engagement_authenticity=NULL`
  - stored `value_score=95`
- Current `computeKolValueScore(...)` for that row yields `total=90`, which is lower than the stored score because the row is outside the top-100 recompute band (`2083` rows are above 95)
Observed Behavior:
- The backfill fixed the `engagement_rate` unit drift on prod; the production app is healthy on the new git SHA; the remaining 95-point sample is not a signoff blocker because it is not part of the top-100 recompute window.
Mismatch vs Spec:
- None in the prod handoff scope.
Defect Link / Reference:
- None.

## Defects

- None in BL-023 implementation scope.

## Coverage Gaps

- None blocking signoff.

## Open Questions

- None.

## Final Decision

- Ready: Yes
- Readiness: Ready
- Final: `PASS`
