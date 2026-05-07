# BL-021 Suspense / loading.tsx Critical Paths — Spec（含 X1 BL-047 顺手清）

> **状态：** Planner 起草 @ 2026-05-07 09:30（BL-023 done 后立即启动）
> **作者：** Planner johnsong
> **触发：** 用户 5/6 19:50 决议 4=A：5/11 critical 5 路由（dashboard / discovery / campaigns / roi / weekly-report）；用户 5/7 09:25 决议 A 立即起（不等 5/8）+ 顺手清 BL-047
> **预估：** 2-2.5h Generator + 0.5h Reviewer
> **批次类型：** 普通批次（2 features 全 `executor:generator`）

---

## 1. 背景与目标

### 1.1 现状审计（Planner 5/7 实地 grep）

- **0 个 loading.tsx 在全应用**（`find src/app -name 'loading.tsx'` → 0 hits）
- **0 个 `<Suspense>` 用法**（`grep -rln '<Suspense' src/app` → 0 hits）
- **5 critical 路由全 page.tsx only**：dashboard / discovery / campaigns/[id] / roi / weekly-report
- **现有 inline skeleton 模式**（`animate-pulse` + `border-outline-variant bg-surface-container/30 rounded-2xl`）已有 5 处使用：assets/AssetsClient / EmailPerformanceChart / CrmPipelineBars / TopicCloudClient / DomainHealthCard
- **`src/components/ui/`** 当前组件：Button / Checkbox / Combobox / Dialog / Input / Select / Table（无 Skeleton）

### 1.2 痛点

前端审计 H-P4 报告（2026-05-01）：
> ROI / Dashboard / Campaign Detail 都"全等就绪才出现"，慢查询全局阻塞。预估收益：感知首屏 −300~800ms。

Next.js 15+ App Router 的 `loading.tsx` 自动包裹 `<Suspense>` boundary — 慢查询不再全局阻塞，骨架屏立即显示。

### 1.3 升级目标

1. 5 critical 路由各加 `loading.tsx` skeleton fallback
2. 创建通用 `src/components/ui/Skeleton.tsx` 组件（避免 5 文件各自 inline 写）— 复用现有 `animate-pulse + bg-surface-container/30` 风格
3. 顺手清 BL-047 — 修复 AiSuggestionsClient.test.tsx pre-existing localStorage stub fail（X1 合并）

### 1.4 Definition of Done

- 5 critical 路由各有 loading.tsx skeleton fallback（dashboard / discovery / campaigns/[id] / roi / weekly-report）
- 通用 Skeleton 组件 export from `src/components/ui/Skeleton.tsx`
- AiSuggestionsClient.test.tsx 全 PASS（npm test repo-wide 全绿 = 接客户前 polish 标准）
- L1：lint + tsc + npm test 全绿
- L2：staging 5 路由实测 navigate 时显示 skeleton（手工验证 1-2 路由即可）

---

## 2. 功能清单（2 features 全 generator）

### F001 · 5 critical routes loading.tsx + 通用 Skeleton 组件

**Executor:** generator
**Priority:** high
**预估工时:** 2h

**改动：**

1. **`src/components/ui/Skeleton.tsx`** 新建 — 通用 skeleton primitive：
```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl border border-outline-variant bg-surface-container/30",
        className
      )}
      {...props}
    />
  );
}
```

2. **`src/components/ui/index.ts`** 加 export

3. **5 个 `loading.tsx` 各自创建**：
   - `src/app/[locale]/(app)/dashboard/loading.tsx`
   - `src/app/[locale]/(app)/discovery/loading.tsx`
   - `src/app/[locale]/(app)/campaigns/[id]/loading.tsx`
   - `src/app/[locale]/(app)/roi/loading.tsx`
   - `src/app/[locale]/(app)/weekly-report/loading.tsx`

每个文件用 Skeleton 组件 mock page 顶部 header + main grid/list 骨架（不必精细像素对齐，但要保持页面整体高度避免 layout shift）。

**Acceptance：**
- [ ] `src/components/ui/Skeleton.tsx` 存在 + export
- [ ] `src/components/ui/index.ts` 加 export Skeleton
- [ ] 5 个 critical 路由 loading.tsx 全部存在（find src/app -name 'loading.tsx' → 5 hits）
- [ ] 各 loading.tsx 用 Skeleton 组件（不再 inline animate-pulse 重复）
- [ ] L1：`npm run lint + tsc` 全绿
- [ ] 单元测试不需要（loading.tsx 是 server component fallback 由 Next.js 渲染）— 避免 over-engineering

---

### F002 · ~~BL-047 顺手清（X1 合并）~~ — **已撤 @ 5/7 10:35（spec premise 错误）**

> ⚠️ **本 feature 已撤** — 用户 5/7 10:35 决议 A：撤 F002 + BL-047 标 closed-not-reproducible。
>
> **撤销根因（Generator 5/7 10:30 实地证据）：**
> - `npx vitest run --pool=forks` (full repo-wide) → **146 files / 1043 tests 全 PASS** (~11min)
> - `tests/setup.ts` 无任何 localStorage stub；jsdom 默认 localStorage 工作正常
> - AiSuggestionsClient.test.tsx 实际 it() block = 2（spec 声称 4 — 计数也偏）
> - WSL2 `npx vitest run --pool=threads` 60s timeout 是 vitest pool 启动问题（worker 启动失败），≠ 测试 fail；Planner 5/7 09:30 起 spec 时可能撞到这个 pool startup 现象，误读为「测试 fail」
>
> **结论：无 bug 可修。** BL-047 标 closed-not-reproducible 入 backlog 作 audit trail。framework v0.9.15 候选沉淀「Backlog spec premise 起草前必须实地跑测试验证（不依赖 verifying 报告措辞）」。
>
> **以下原 F002 内容保留作 audit trail 不删（spec retro 范式）：**

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min

**改动：**

排查 + 修复 `src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx` 的 `window.localStorage.setItem is not a function` / `window.localStorage.clear is not a function` fail。

实地排查路径（spec 不规定 fix 方式 — Generator 自查）：
1. `vitest.config.ts environment=jsdom` ✓ — jsdom 默认应该有 localStorage
2. `tests/setup.ts` 不含 localStorage stub — MSW lifecycle only
3. `AiSuggestionsClient.test.tsx:34/52` 直接调 `window.localStorage.setItem/clear` — 应该 work in jsdom

可能原因（按概率排序）：
- (a) jsdom 版本与 Next.js 16 testing-library/jest-dom 不兼容 — 升级 / 显式 vi.stubGlobal
- (b) MSW server 拦截了 localStorage 相关 fetch（不太可能但需验）
- (c) 某 import 顺序导致 jsdom localStorage 未初始化前测试已运行
- (d) `afterEach(() => server.resetHandlers())` 与 `afterEach(() => window.localStorage.clear())` 顺序冲突

修复策略候选（Generator 选最简单）：
- **A** `tests/setup.ts` 加全局 `vi.stubGlobal('localStorage', { ...mock methods })` — 全局 stub 可能影响其它测试
- **B** `AiSuggestionsClient.test.tsx` 文件内 `beforeAll(() => { Object.defineProperty(window, 'localStorage', { value: { setItem: vi.fn(), clear: vi.fn(), ... } }) })` — 仅本文件 scope
- **C** 升级 jsdom（`npm i jsdom@latest -D`）— 风险扩散
- **D** 用 `@vitest/web-worker` 或 `happy-dom` 替换 jsdom — 太大改动

Planner 推荐 **B**（最小 scope；不影响其他测试）。

**commit-tag：** `feat(BL-021-F002): fix AiSuggestionsClient.test.tsx pre-existing localStorage stub (BL-047 X1)`

**Acceptance：**
- [ ] `npx vitest run src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx` 全 PASS（4 case 之前 fail 现 PASS）
- [ ] `npm test` repo-wide 0 fail（除 pre-existing material-symbols-coverage / e2e database-fidelity 等已知 unrelated）
- [ ] 修复方案 + 实地排查根因记录在 commit message

---

## 3. 变更文件清单

```
src/components/ui/Skeleton.tsx                                F001 NEW (~15 行)
src/components/ui/index.ts                                    F001 EDIT (+export)
src/app/[locale]/(app)/dashboard/loading.tsx                  F001 NEW (~30 行)
src/app/[locale]/(app)/discovery/loading.tsx                  F001 NEW (~30 行)
src/app/[locale]/(app)/campaigns/[id]/loading.tsx             F001 NEW (~30 行)
src/app/[locale]/(app)/roi/loading.tsx                        F001 NEW (~30 行)
src/app/[locale]/(app)/weekly-report/loading.tsx              F001 NEW (~30 行)

src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx  F002 EDIT (localStorage stub fix)
（可能 tests/setup.ts EDIT — Generator 决定 scope）
```

---

## 4. 关键设计决策

### D1 · 创建 src/components/ui/Skeleton.tsx 通用组件
- 现有 5 处 inline `animate-pulse + bg-surface-container/30 rounded-2xl` 模式重复
- 提取通用组件后未来 BL-018（11 页全量 edge states spot check）扩 loading.tsx 时 0 重复
- 改动局限 src/components/ui/（与 BL-021 主题"基础设施加 loading state"一致）

### D2 · loading.tsx 不写单测
- loading.tsx 是 Next.js server component fallback，由 framework 渲染机制保证
- 实际 Suspense 流程靠 E2E 验证（用户走查 staging 5 路由 navigate 时观察 skeleton 闪烁）
- 单测要 mock Suspense + RSC payload — overengineering

### D3 · 仅 5 critical paths（不全 11 路由）
- 用户决议 4=A 已 lock：dashboard / discovery / campaigns/[id] / roi / weekly-report
- 其余路由（如 /database / /knowledge-base / /assets / /outreach 等）查询轻 + 已有 inline skeleton (assets) — 收益低
- 全 11 路由扩在 BL-018 post-MVP edge states 批次

### D4 · BL-047 X1 顺手清模式（同 BL-023 F007 风格）
- BL-047 与 BL-021 主题"loading state polish"虽不严格同根，但同属"上线前 npm test 全绿 polish"
- 同 commit-tag `feat(BL-021-F002): ... (BL-047 X1)` 满足铁律 #10

---

## 5. v0.9.x 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | Planner 起 spec 前已 grep find loading.tsx + Suspense + Skeleton component → 实物核对 5 路由全无 loading.tsx + 0 Suspense + 无 Skeleton 组件，spec 范围与代码现状一致 |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | 可能触发：如 Generator 排查 BL-047 时发现根因比预期复杂（如需升级 jsdom），主动停 + 短格式裁决 |

---

## 6. 实装顺序（Generator 接手参考）

```
1. F001 src/components/ui/Skeleton.tsx + index.ts export
2. F001 5 个 loading.tsx 创建（参考各 page.tsx layout 结构 mock skeleton）
3. F002 排查 AiSuggestionsClient.test.tsx localStorage stub 根因 → 修复（推荐方案 B 文件内 stub）
4. lint + tsc + test 守门
5. push commit（建议 2 commits：F001 单 commit + F002 单 commit；或单 commit 双 feat 标签）
```

---

## 7. Definition of Done

### 7.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | staging 浏览器走查 5 路由 navigate 时观察 skeleton 闪烁（dashboard → 任意 / discovery → AI search / campaigns/[id] / roi / weekly-report）| BL-021 done 后 |

### 7.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含 AiSuggestionsClient.test.tsx 4 case）+ CI 全绿
- **L2：** staging git_sha 对齐 + 手工 navigate 5 路由其中 1-2 个观察 skeleton 渲染（不必每个都验，1-2 个足够 sanity check）

### 7.3 Soft-watch（不阻塞 done）

- 全 11 路由扩 loading.tsx → BL-018 post-MVP
- 慢查询性能优化（如 ROI N+1 / Dashboard 5+ queries）→ 性能审计批次 post-MVP

---

> **Spec lock：** Planner johnsong @ 2026-05-07 09:30。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段良性偏差按 §11 处理。
