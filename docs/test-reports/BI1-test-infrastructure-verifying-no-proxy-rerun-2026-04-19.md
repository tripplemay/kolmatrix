# BI1 验收重判报告（排除代理干扰）

- Date: 2026-04-19
- Evaluator: Reviewer (Codex)
- Scope: 仅针对“代理干扰”因素做复核，重判 F003/F008/F009 相关结论

## 复核方式

- 统一在无代理环境执行：
  - `env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY=localhost,127.0.0.1 <command>`

## 复核结果

### 1) F003（Playwright 基础能力）结论更新：PASS
- 证据：
  - `npm run test:e2e` 在无代理环境可正常启动 Playwright webServer（不再出现“HTTP 400 被误判可用”）。
  - `landing.spec.ts` 在无代理环境稳定通过。
- 结论：此前 F003 的核心阻断由代理干扰触发，不应再按产品缺陷计入。

### 2) F008（Marketer E2E）结论保持：FAIL（flaky）
- 证据：
  - 在无代理环境下，`tests/e2e/marketer-dashboard.spec.ts` 多次复跑出现不稳定：有时 4/4 通过，有时 2/4 超时失败。
  - 失败时卡在 `waitForURL(/\\/dashboard(\\/|$)/)`，并伴随服务端日志 `CallbackRouteError` + `invalid input syntax for type uuid: ""`。
- 结论：问题与代理无关，属于真实稳定性缺陷。

### 3) F009（视觉回归）结论保持：FAIL
- 证据：
  - 无代理单跑 `tests/e2e/visual-regression.spec.ts`，`toHaveScreenshot("dashboard.png")` diff 比例约 `0.03`，高于阈值 `0.02`。
- 结论：问题与代理无关，属于真实验收不通过。

## 重判总结

- 从上一版报告中剔除“F003 失败由代理导致”的阻断结论。
- 当前仍需回 `fixing`，原因是：
  - F008 登录流 flaky
  - F009 视觉回归超阈值
  - 以及此前已识别的 F002/F007/F010 口径或环境一致性问题（不属于代理干扰范畴）。

