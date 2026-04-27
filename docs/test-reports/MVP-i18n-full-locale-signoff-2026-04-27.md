# MVP-i18n-full-locale Signoff 2026-04-27

> 状态：Evaluator 复验通过（reverifying）
> 触发：fix-round 1 已修复上一轮唯一阻断项 F001（dry-run 无参契约）

---

## 复验范围

- 批次：`MVP-i18n-full-locale`
- 重点：F001 阻断闭环 + 全量 i18n 行为回归
- 环境：L1 本地（Codex 3099 harness）+ L2 staging（`https://staging.kol.guangai.ai`）

---

## 上轮阻断闭环

1. F001（`i18n:translate:dry` 无参失败）
- 结果：PASS
- 复验证据：
  - `npm run i18n:translate:dry`：无 `--target` 成功执行，输出 4 语言未翻译统计与 summary
  - `npm run i18n:translate:dry -- --target ja`：单语言 dry-run 兼容通过
  - `npm run i18n:translate`（无 `--target`）：按预期报错（live 模式仍要求 target）

---

## 自动化结果

### L1
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test:unit -- tests/unit/i18n-locale-coverage.test.ts tests/unit/i18n-placeholders.test.ts tests/unit/i18n-html-tags.test.ts tests/unit/i18n-translate-script.test.ts`：PASS（4 files / 42 tests）
- `bash scripts/test/codex-e2e.sh tests/e2e/locale-detection.spec.ts`：PASS（5/5）

### L2 Staging
Preflight:
- `GET /api/health`：healthy，`git_sha=611cb87`

E2E:
- `E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/marketer-dashboard.spec.ts --project=chromium --workers=1 --timeout=180000`
- 结果：4/4 passed

i18n 行为探针（staging）:
- `/en|zh|ja|ko|es/login`：HTTP 200，`<html lang>` 与 locale 一致
- cookie 覆盖：在 staging 域写 `NEXT_LOCALE=ja` 后，请求 `/login` 跳转到 `/ja/login`，lang=ja
- 5 locale × 5 key pages（`dashboard/discovery/database/campaigns/weekly-report`）= 25 路由全部 200，且 `html lang` 全匹配，无 404 shell

---

## 残余风险

- `tests/e2e/locale-detection.spec.ts` 仍存在环境可移植性风险：cookie override 用例若将 cookie domain 固定为 `localhost`，在 staging 会出现假失败。该项属于测试代码健壮性问题，不构成当前产品回归阻断。

---

## 结论

- 本批次复验通过，可从 `reverifying` 进入 `done`。
- signoff 路径：`docs/test-reports/MVP-i18n-full-locale-signoff-2026-04-27.md`
