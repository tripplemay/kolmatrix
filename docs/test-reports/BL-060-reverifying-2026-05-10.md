# BL-060 soft-delete-ui-filter-hotfix Reverifying 2026-05-10

> 状态：**Reviewer reverification PASS**
> 触发：BL-060 fix-round 2 后的复验
> Reviewer：Codex

## 总体结论

- BL-060 的 fix-round 2 复验通过，`database-fidelity.spec.ts` 7/7 稳定 PASS。
- 这次复验确认了 staging 登录抖动已经被共享 `storageState` 收敛掉。
- 本轮结论为 `PASS`，可签收。

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 2 warnings
  - `npx tsc --noEmit` 通过
  - `npm run test` 156 files / 1101 tests PASS
- staging 通过：
  - `tests/e2e/marketer.setup.ts` -> PASS
  - `tests/e2e/database-fidelity.spec.ts` -> 7/7 PASS
  - `tests/e2e/login-cinematic.spec.ts` -> PASS
  - `tests/e2e/marketer-dashboard.spec.ts` -> PASS
- health 通过：
  - `https://staging.kol.guangai.ai/api/health` -> healthy

## 关键证据

### 1. shared session 方案生效

- setup project 先登录一次，写入 `playwright/.auth/marketer.json`。
- `database-fidelity.spec.ts` 复用该 session，不再在每个 case 前重复登录。
- 原先在 `beforeEach` 中出现的 `waitForURL(/dashboard/)` 超时不再出现。

### 2. 现有 soft-delete 修复仍有效

- `deletedAt: null` 过滤仍保持在 dashboard / database / kpi snapshot / campaigns / crm 的相关 query 中。
- `BL-060-F003` 与 `BL-060-F005` SQL ops 文件继续存在。

## 最终结论

- Final grade: `A-`
- Readiness: `Ready`
- `progress.json.docs.signoff` 已写入本报告路径。
