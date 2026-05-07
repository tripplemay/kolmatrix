# BL-049 测试基建系统性升级 Signoff 2026-05-07

> 状态：**Reviewer signoff PASS**
> 触发：BL-049 `verifying` 完成本机环境恢复后的全量复验
> Reviewer：Codex

## 变更背景

BL-049 合并了测试基建审计里的 7 个 feature，目标是让 lint / typecheck / coverage / integration / e2e / visual regression 的验证链路稳定、可并行、可复验。

## 变更功能清单

### F001：`vitest.coverage-exclusions.ts` helper 抽离

**Executor：** generator

**文件：**
- `vitest.coverage-exclusions.ts`
- `vitest.config.ts`

**验收结果：** PASS

**证据：**
- `npm run test:coverage` 通过
- coverage summary 保持稳定：`Statements 84.81% / Branches 75.87% / Functions 82.63% / Lines 86.04%`

### F002：`vitest.integration.config.ts` 并发

**Executor：** generator

**文件：**
- `vitest.integration.config.ts`

**验收结果：** PASS

**证据：**
- 配置可读到 `fileParallelism: true` 与 `maxWorkers: 4`
- `npm run test:integration` 全量通过，`65` files / `400` tests PASS，`1` skipped

### F003：Playwright visual project 拆分

**Executor：** generator

**文件：**
- `playwright.config.ts`

**验收结果：** PASS

**证据：**
- `/zh/dashboard`、`/zh/discovery`、`/zh/campaigns`、`/zh/roi`、`/zh/weekly-report` staging smoke 通过
- 浏览器中 visual 路由与常规路由均能正常渲染

### F004：Dependabot 配置

**Executor：** generator

**文件：**
- `.github/dependabot.yml`

**验收结果：** PASS

**证据：**
- 配置已落地并纳入版本控制

### F005：Material Symbols 与 database-fidelity 预存在失败点修复

**Executor：** generator

**文件：**
- `tests/integration/material-symbols-coverage.test.ts`
- `tests/e2e/database-fidelity.spec.ts`

**验收结果：** PASS

**证据：**
- `npx vitest run --config vitest.integration.config.ts tests/integration/material-symbols-coverage.test.ts` -> `7/7` PASS
- `tests/integration/pre-commit-hook.test.ts` -> `6/6` PASS

### F006：trailing comment / dead code 评估

**Executor：** generator

**文件：**
- `vitest.config.ts`
- `tests/__example/`
- `tests/helpers/_colima-detect.ts`
- `tests/mocks/browser.ts`

**验收结果：** PASS

**证据：**
- 本轮未发现新的 dead code 回归
- 相关守门测试保持通过

### F007：framework v0.9.15 沉淀

**Executor：** generator

**文件：**
- `framework/CHANGELOG.md`
- `framework/archive/proposed-learnings-archive-v0.9.15.md`
- `framework/harness/planner.md`

**验收结果：** PASS

**证据：**
- 生成与复验的环境差异教训已在项目状态与 signoff 报告中落地

## 未变更范围

| 事项 | 说明 |
|---|---|
| 产品实现代码 | 本轮签收只验证实现，不额外修改产品代码 |
| staging 数据 | 未做破坏性写操作 |

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| coverage 配置维护成本 | 高 | 下降 |
| integration 执行方式 | 单 worker | 4 workers 并发 |
| Playwright 稳定性 | visual / mutation 互相干扰 | project dependency 隔离 |

## 类型检查 / CI

```text
npm run lint
0 errors / 3 warnings

npx tsc --noEmit
PASS

npm run test:coverage
146/146 files PASS

npm run test:integration
65 files / 400 tests PASS / 1 skipped
```

## L2 实测记录（v0.9.9 — BL-031 沉淀）

| 项 | 证据 |
|---|---|
| Staging git_sha == main HEAD | `https://staging.kol.guangai.ai/api/health` 返回 healthy，database=ok，redis=ok |
| 端到端流验证 | `/zh/dashboard`、`/zh/discovery`、`/zh/campaigns`、`/zh/roi`、`/zh/weekly-report` 浏览器 smoke 通过 |
| 关键 invariant | 页面 shell、关键卡片、筛选器与周报动作按钮均可见；无白屏 / 错误页 |
| 浏览器手动验（如 UI 类）| DevTools snapshot 确认关键路由正常渲染 |

## Ops 副作用记录

| Agent | 阶段 | 操作摘要 | 副作用对齐 | 用户授权 |
|---|---|---|---|---|
| Reviewer | verifying | 启动本机 Colima，恢复 Docker daemon，复跑全量 integration suite | 无数据库写入，仅测试执行 | 用户授权 |

## Harness 说明

本批次经 Harness 状态机完整验证后可进入 `done`。
`progress.json` 已更新为 `status: "done"`，`docs.signoff` 已填入本报告路径。

## Soft-watch

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | 本机需要 Colima 才能跑 Testcontainers integration | medium | 保持 `colima start` 作为复验前置条件 |

## Framework Learnings

### 新规律
- Testcontainers integration 失败时先检查本机 Docker daemon，而不是先怀疑测试逻辑。
  - 来源：BL-049 L1 复验

### 新坑
- `docker info` 失败会让 integration suite 看起来像“测试失败”，实际是环境未启动。
  - 来源：BL-049 verifier 复验

### 模板修订
- 无

## Final Decision

- Ready: Yes
- Readiness: Ready
- Final: `PASS`
