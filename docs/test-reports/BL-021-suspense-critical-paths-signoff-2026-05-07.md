# BL-021 Suspense / loading.tsx Critical Paths Signoff 2026-05-07

> 状态：**Reviewer 复验通过**
> 触发：`progress.json` 进入 `reverifying`（fix-round 1 完成，commit `9fa2a49` / state commit `62c3171`）

---

## 变更背景

BL-021 的目标是为 5 个 critical routes 增加 `loading.tsx` 骨架 fallback，并抽出通用 `Skeleton` 组件，降低慢查询下的首屏感知阻塞。首轮 verifying 唯一阻断项是 `AiSuggestionsClient.test.tsx` 在 Linux / Node forks pool 环境下的 `localStorage` 兼容性问题；fix-round 1 采用显式 `Storage` stub 后重新进入 reverifying。

---

## 变更功能清单

### F001：5 critical routes loading.tsx + 通用 Skeleton 组件

**Executor：** generator

**文件：**
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/index.ts`
- `src/app/[locale]/(app)/dashboard/loading.tsx`
- `src/app/[locale]/(app)/discovery/loading.tsx`
- `src/app/[locale]/(app)/campaigns/[id]/loading.tsx`
- `src/app/[locale]/(app)/roi/loading.tsx`
- `src/app/[locale]/(app)/weekly-report/loading.tsx`

**改动：**
- 抽出通用 `Skeleton` primitive。
- 5 个 critical route 分别添加 route-level `loading.tsx`，并按页面结构保持近似高度。

**验收标准：**
- `Skeleton` 组件存在并导出。
- 5 个 route `loading.tsx` 存在且都使用 `Skeleton`。
- staging 路由导航正常，未引入页面回归。

### F002：AiSuggestionsClient.test.tsx localStorage env-portable stub

**Executor：** generator

**文件：**
- `src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx`

**改动：**
- `beforeAll` 中用 `Object.defineProperty` 覆盖 `window.localStorage`，改为 Map-backed `Storage` stub。
- 显式实现 `length / clear / getItem / key / removeItem / setItem`，避免依赖 jsdom 默认实现差异。
- 保持测试 seed 与组件缓存读写共享同一 store。

**验收标准：**
- 单文件测试 `AiSuggestionsClient.test.tsx` 通过。
- repo-wide vitest 通过。
- Linux / Node forks pool 环境不再复现 localStorage TypeError。

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| 业务页面数据逻辑 | 不改，仅加 Suspense fallback |
| discovery / campaigns / roi / weekly-report 核心数据查询 | 不改，仅验证路由和页面可达性 |
| 其他 backlog 项 | BL-017 / BL-046 / BL-047 未在本批次内处理 |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| critical routes 首屏感知 | 慢查询时全局阻塞 | route-level loading fallback 立即可见 |
| `AiSuggestionsClient.test.tsx` 跨环境稳定性 | Linux / Node forks pool 下易失败 | 可重复通过 |

---

## 类型检查 / CI

```text
$ npm run lint
0 errors / 3 warnings

$ npx tsc --noEmit
TSC_OK

$ npx vitest run --pool=forks
Test Files  146 passed (146)
Tests       1043 passed (1043)

CI / staging:
- commit 9fa2a49 fix(BL-021): AiSuggestionsClient localStorage env-portable stub
- staging deploy run 25476852038 PASS
- generator reported health ok and git_sha=9fa2a49 for the deployed build
```

---

## L2 实测记录（v0.9.9 — BL-031 沉淀）

| 项 | 证据 |
|---|---|
| Staging deploy | `deploy-staging.yml` run `25476852038` PASS；部署头为 `9fa2a49` |
| 端到端流验证 | staging 浏览器分别导航 `/zh/dashboard`、`/zh/discovery`、`/zh/campaigns`、`/zh/roi`、`/zh/weekly-report`，页面均可正常加载 |
| 关键 invariant | `/zh/discovery` 的 Smart Match / AI search 页面可达，`/zh/campaigns`、`/zh/roi`、`/zh/weekly-report` 关键链路无阻断 |
| 浏览器手动验（UI 类）| 在 slow 3G 下完成 staging 走查，页面结构与关键交互按钮均正常渲染；未观察到功能回归 |

---

## Ops 副作用记录（v0.9.9 — BL-030/BL-031 沉淀）

本批次无数据库 ops。

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → fixing → reverifying → done）交付。
`progress.json` 已设为 `status: "done"`，`docs.signoff` 已填入本报告路径。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | `AiSuggestionsClient.test.tsx` 依赖显式 `localStorage` stub，避免再次回退到 jsdom 默认实现 | low | 保持当前 Map-backed stub，后续如新增类似测试沿用同模式 |

---

## Framework Learnings

### 新规律
- 对依赖浏览器 API 的测试，显式 stub 比依赖 jsdom 默认实现更稳定。
  - 来源：BL-021 fix-round 1
  - 建议写入：`framework/harness/evaluator.md`

### 新坑
- Linux / Node forks pool 与 WSL2 下的 jsdom 行为并不完全一致，`localStorage` 默认实现可能出现不可重写或方法缺失问题。
  - 来源：BL-021 verifying FAIL
  - 建议写入：`framework/README.md` 经验教训

### 模板修订
- 无
