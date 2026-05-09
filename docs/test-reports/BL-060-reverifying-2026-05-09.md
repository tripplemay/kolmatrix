# BL-060 soft-delete-ui-filter-hotfix Reverifying 2026-05-09

> 状态：**Reviewer reverification PARTIAL**
> 触发：BL-060 fix-round 1 后的复验
> Reviewer：Codex

## 总体结论

- BL-060 的 L1 仍然全绿，`database-fidelity.spec.ts` 的前 3 个 staging 用例也已稳定通过。
- 但 `Bulk Action Bar mounts after a row checkbox toggles` 和 `header CTAs ...` 两条仍在 `beforeEach` 的 `login()` 内 `page.waitForURL(/\/dashboard(\/|$)/)` 超时。
- 这说明 fix-round 1 缓解了部分问题，但没有把整组 `database-fidelity` 复验完全收口。
- 结论仍是 `PARTIAL`，不签收。

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 2 warnings
  - `npx tsc --noEmit` 通过
  - `npm run test` 156 files / 1101 tests PASS
- staging 通过：
  - `https://staging.kol.guangai.ai/api/health` -> healthy
  - `tests/e2e/login-cinematic.spec.ts` -> PASS
  - `tests/e2e/marketer-dashboard.spec.ts` -> PASS
- `tests/e2e/database-fidelity.spec.ts` 部分通过：
  - `Quick Stats KPI strip renders all four cards` -> PASS
  - `filter bar surfaces 7 dimensions ...` -> PASS
  - `Tier and Game filters are live enabled controls` -> PASS
  - `Insights Panel renders all three cards ...` -> PASS
  - `Bulk Action Bar is absent on a fresh load ...` -> PASS

## 关键阻断

- 剩余 2 条用例仍失败：
  - `Bulk Action Bar mounts after a row checkbox toggles (state contract)`
  - `header CTAs (Export / Import / Add KOL) are wired and enabled (BL-024 F001-1/2/3)`
- 失败栈一致指向 `login()` 里的 `page.waitForURL(/\/dashboard(\/|$)/)` 超时。
- 单例测试能过，说明页面本体并未整体挂死；但整组跑时仍有不可接受的稳定性问题。

## 说明

- 本轮没有做数据库 ops。
- 当前仍维持 `reverifying`，等这 2 条用例稳定后再尝试签收。

## 最终结论

- Final grade: `B`
- Readiness: `Not ready`
- `progress.json.docs.signoff` 仍为空。
