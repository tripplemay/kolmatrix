# BI1 Test Infrastructure 验收报告（Verifying Round 1）

- Sprint: `BI1-test-infrastructure`
- Date: `2026-04-19`
- Evaluator: `Reviewer (Codex)`
- Verdict: `PARTIAL / FAIL`（需回 `fixing`）

## 执行概览

1. 环境启动（按 AGENTS 规范）  
- `bash scripts/test/codex-setup.sh` 成功（docker compose / migrate / seed / dev:3099）
- `bash scripts/test/codex-wait.sh` 成功

2. 核心命令执行结果  
- `npm run test:coverage`：PASS（83 tests, coverage lines 96.36%）  
- `npm run test:integration`：FAIL（默认环境）  
- `DOCKER_HOST=unix:///Users/yixingzhou/.colima/default/docker.sock TESTCONTAINERS_RYUK_DISABLED=true npm run test:integration`：PASS（28/28）  
- `npm run test:e2e`：FAIL（默认代理环境）  
- `env -u http_proxy ... NO_PROXY=localhost,127.0.0.1 npm run test:e2e`：仍 FAIL（visual / login 稳定性问题）

3. CI 配置核查  
- `.github/workflows/ci.yml` 存在 `unit-tests / integration-tests / e2e-tests` 3 个新增 jobs  
- `paths-ignore`、`codecov`、`playwright-report artifact` 配置存在  
- 但 `integration-tests` job 未按 feature acceptance 使用 PG+Redis service containers（注释声明“依赖 Testcontainers 自启”）

## 主要问题（按严重度）

### P0-1: E2E 在默认环境不可执行（F003/F008/F009）
- 现象：`npm run test:e2e` 直接全红，浏览器侧 `ERR_CONNECTION_REFUSED http://localhost:3000/*`
- 根因证据：`DEBUG=pw:webserver` 显示 webServer availability check 命中代理返回 `HTTP 400`，误判“WebServer is already available”，导致没有启动 Next dev server。
- 影响：F003 要求的“npm run test:e2e 全绿”不满足；F008/F009 无法在默认环境稳定跑通。

### P0-2: Marketer E2E 登录链路不稳定（F008）
- 现象：`tests/e2e/marketer-dashboard.spec.ts` 重跑会随机出现 30s timeout，卡在 `waitForURL(/\/dashboard/)`。
- 关键日志：Auth 回调出现 `CallbackRouteError`，底层 Prisma 报错 `invalid input syntax for type uuid: ""`（出现在 `withPlatformAdmin` 调用链）。
- 影响：F008 的 4 条关键业务用例存在 flaky，不能判“全绿稳定通过”。

### P1-1: Visual regression 超阈值（F009）
- 现象：`tests/e2e/visual-regression.spec.ts` 失败，`40564 pixels` 差异，比例 `0.03`。
- 验收阈值：`threshold: 0.02`, `maxDiffPixels: 1000`。
- 结论：不满足 F009“diff < 2%”标准。

### P1-2: Integration 在 Colima 默认环境不可直接运行（F002/F007）
- 现象：`npm run test:integration` 默认失败：  
  - 首次：`Could not find a working container runtime strategy`  
  - 设置 `DOCKER_HOST` 后：`Log stream ended and message "/.*Started.*/" was not received`  
- 仅在附加 `TESTCONTAINERS_RYUK_DISABLED=true` 后通过。
- 影响：F002 “npm run test:integration 跑通”在本地标准环境不成立；F007 依赖该链路，存在环境耦合问题。

### P2-1: F010 与 acceptance 文案存在偏差
- `features.json` F010 明确写了 integration job 需“PG + Redis service container”。
- 实际 `ci.yml` 中 integration job 没有 service containers（注释声明这是有意偏离）。
- 结论：若按严格字面验收，F010 为 PARTIAL（需要 Planner 明确接受该偏离或修订 acceptance）。

## 通过项

- F001/F006：unit + coverage 能力成立，覆盖率显著超过 80% 门槛。
- F004：MSW 基础能力和示例测试存在并可跑通（包含在 coverage 流程中）。
- F005：fixtures 文件存在且在 integration 通过场景下可正常 round-trip（有 28/28 integration pass 证据）。

## 建议修复方向（给 Generator）

1. 修复 Playwright 在代理环境下的 webServer 误判  
- 在 e2e 脚本中显式隔离代理环境，或在 config 中为 localhost 健康检查提供稳定 bypass。

2. 修复登录链路的 UUID 空串问题（flaky 根因）  
- 排查 `withPlatformAdmin` / auth authorize 链路中 `app.tenant_id` 注入或复位逻辑，避免传入空串 UUID。

3. 收敛 visual 回归波动  
- 校准 mask/threshold/maxDiffPixels 或稳定动态区域，保证重复运行可通过。

4. 收敛 Testcontainers 在 Colima 的默认可用性  
- 在测试脚本或文档中显式处理 `DOCKER_HOST` / Ryuk 策略，避免“默认命令不可用”。

5. 对 F010 acceptance 偏离做规范化  
- 二选一：要么补 integration job 的 service containers；要么由 Planner 修订 acceptance 文案并注明理由。

