# BL-049 测试基建系统性升级 — Spec（X1 High 3 + Medium 4 合并 / 7 features）

> **状态：** Planner 起草 @ 2026-05-07 10:50（BL-021 building 期间并行）；BL-021 done 后立即切 building
> **作者：** Planner johnsong
> **触发：** 用户 5/7 10:30 请求 review 测试基建 → Planner audit 13 项发现（详见 `docs/audit-reports/test-infra-audit-2026-05-07.md`）→ 用户 5/7 10:50 决议 X1 合并方案
> **预估：** 6h Generator + 0.5h Reviewer + 0.25h Planner（v0.9.15 沉淀）
> **批次类型：** 普通批次（7 features 全 `executor:generator`）

---

## 1. 背景与目标

### 1.1 触发上下文

项目初期搭建测试基建（v0 vitest.config + tests/ 结构），经 BL-001 ~ BL-048 累积 226 测试文件 + 6 CI jobs + 19 visual baselines 后，部分配置已不匹配当前规模（如 coverage exclude 100+ 行 / integration single-worker / E2E race condition workaround）。

**完整审计：** `docs/audit-reports/test-infra-audit-2026-05-07.md`（13 项发现 + 优先级 + 推荐方案）

### 1.2 升级范围（用户 5/7 10:50 决议 X1 合并）

合并 audit 报告 High 3 + Medium 4 = **7 features**。Low 5 项保持现状（已 BL-015/018/019 跟踪 / 部分入 F006 dead code 评估）。

### 1.3 Definition of Done

- 7 features 全 PASS by Reviewer L1+L2
- vitest.config.ts coverage.exclude 拆出独立 helper file，主 config 可读性提升
- vitest.integration.config.ts fileParallelism 启用 + 4 workers 跑通（CI 时间 ~10-15min → 3-4min）
- E2E visual 独立 Playwright project + 独立 DB，去除 reseed workaround
- CI Dependabot config 启用（每周 dependency PR）
- material-symbols-coverage + e2e database-fidelity 2 pre-existing fails 修
- vitest trailing comment + tests/__example/ + helpers/_colima-detect.ts + tests/mocks/browser.ts 评估清理
- framework v0.9.15 沉淀（planner.md 铁律 1 矩阵 +1 行）+ audit 报告归档

---

## 2. 功能清单（7 features 全 generator）

### F001 · vitest.config.ts coverage.exclude 拆 helper file

**Executor:** generator
**Priority:** high
**预估工时:** 30 min

**改动：**

新建 `vitest.coverage-exclusions.ts`：
```typescript
/**
 * Coverage exclusion list — extracted from vitest.config.ts (BL-049-F001).
 * 30+ files dominated by Prisma + withTenant + googleapis calls; pure
 * surfaces have unit specs; DB-touching logic is integration-tested.
 *
 * Edit policy: each entry MUST include the rationale (which integration
 * test covers it) inline; remove entry only when integration coverage
 * is removed or the file becomes pure.
 */
export const COVERAGE_EXCLUSIONS_RUNTIME = [
  "src/**/*.d.ts",
  "src/**/__tests__/**",
  "src/**/*.stories.{ts,tsx}",
  "src/components/ui/**", // shadcn scaffolding
  // ... (30+ entries with inline rationale)
];
```

修改 `vitest.config.ts`：
```typescript
import { COVERAGE_EXCLUSIONS_RUNTIME } from "./vitest.coverage-exclusions";
// ...
coverage: {
  // ...
  exclude: COVERAGE_EXCLUSIONS_RUNTIME,
}
```

**Acceptance：**
- [ ] `vitest.coverage-exclusions.ts` 存在 + export `COVERAGE_EXCLUSIONS_RUNTIME` 数组
- [ ] `vitest.config.ts` 减 ~80 行（保留 thresholds + provider + reporter + include / reportsDirectory 不变）
- [ ] `npm run test:coverage` 输出 lcov / html 与之前等价
- [ ] coverage thresholds 仍 80%（lines/functions/statements）

---

### F002 · vitest.integration.config.ts fileParallelism + 4 workers + 隔离 fixtures

**Executor:** generator
**Priority:** high
**预估工时:** 1-2h

**改动：**

`vitest.integration.config.ts`：
```typescript
fileParallelism: true,  // was false
poolOptions: {
  forks: {
    minForks: 1,
    maxForks: 4,  // 65 files / 4 workers = ~16 files per worker
  }
}
```

每 integration test file 启动自己的 Testcontainers postgres 实例（已有 helpers 如 `tests/helpers/db.ts` 应该 per-file 不共享）。

**风险与缓解：**
- 4 workers 并发可能撞 docker 资源限（CI runner 7GB RAM + 4 vCPU）→ maxForks 从 4 起步，监控 OOM 后调
- WSL2 fs 慢可能 testTimeout 偶发 → 维持 120s testTimeout

**Acceptance：**
- [ ] `vitest.integration.config.ts` `fileParallelism: true`
- [ ] poolOptions 配 maxForks: 4
- [ ] `npm run test:integration` 本机 + CI 跑通（无 docker port 冲突 / 无 OOM）
- [ ] CI integration job 时间从 ~10-15min 降到 < 8min（实测后写在 commit message）
- [ ] 65 files 全 PASS（与 fileParallelism: false 时同结果）

---

### F003 · E2E visual workaround — 独立 Playwright project + 独立 DB

**Executor:** generator
**Priority:** high
**预估工时:** 2-3h

**改动：**

`playwright.config.ts` 加 2 projects：
```typescript
projects: [
  {
    name: "chromium",
    testIgnore: /visual-regression\.spec\.ts$/,
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "visual",
    testMatch: /visual-regression\.spec\.ts$/,
    use: { ...devices["Desktop Chrome"] },
  },
]
```

`.github/workflows/ci.yml` e2e job 改：
- 不再 visual 先跑 + reseed + 其余两阶段
- 改为：`npx playwright test --project=visual` 在独立 DB（如 `kolmatrix_visual`）+ `npx playwright test --project=chromium` 在 main DB
- 或更简：visual 用 fresh seed snapshot 不运行 mutation；chromium 用 main DB
- 探索方向（Generator 实装时确定）：
  - **A** 2 DB（kolmatrix_visual + kolmatrix）+ 2 PM2 / 或 2 Next dev port
  - **B** 1 DB + visual 用 db transaction rollback per spec
  - **C** 1 DB + visual 在 mutation 前 dump snapshot, 后 restore

**Acceptance：**
- [ ] visual + chromium 2 projects 独立
- [ ] CI e2e job 不再有 reseed 中间步
- [ ] 19 visual baselines 全 PASS（不因其他 spec mutation 失真）
- [ ] CI e2e job 时间不超过当前（~10min）
- [ ] update-visual-baselines.yml workflow 同步适配新 project 结构

---

### F004 · CI Dependabot config

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min

**改动：**

新建 `.github/dependabot.yml`：
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      next-ecosystem:
        patterns: ["next*", "@next/*", "react*"]
      prisma-ecosystem:
        patterns: ["prisma", "@prisma/*"]
      vitest-ecosystem:
        patterns: ["vitest*", "@vitest/*", "@testing-library/*"]
      playwright-ecosystem:
        patterns: ["@playwright/*", "playwright"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Acceptance：**
- [ ] `.github/dependabot.yml` 存在 + 含 npm + github-actions ecosystems
- [ ] groups 设置（避免 PR 爆炸：next/prisma/vitest/playwright 各 1 group）
- [ ] open-pull-requests-limit 限 5（防止 noise）
- [ ] commit 后 GitHub Actions Dependabot 实际触发（5/8 周一第一次跑；可在 commit message 注「等周一首次 run 验证」）

---

### F005 · material-symbols-coverage + e2e database-fidelity pre-existing fails 修

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min - 1h

**改动：**

实地排查 + 修：

**(a) tests/integration/material-symbols-coverage.test.ts:156** — woff2 stale（regen script 输出与 committed 字节不一致）
- 跑 `node scripts/material-symbols-codegen.ts`（或对应 regen script）
- commit 新 woff2 + 对应测试 fixture
- 或：测试 logic 改为只比较 unicode coverage（不比 bytes）

**(b) tests/e2e/database-fidelity.spec.ts:123** — `database-export` button expected disabled 但 BL-024 F004/F005 (commit 23203fe) 启用了 export 没同步更新 e2e 断言
- 把 expectation 改为 `enabled`（与 BL-024 F004/F005 实装一致）

**Acceptance：**
- [ ] material-symbols-coverage.test.ts PASS
- [ ] database-fidelity.spec.ts PASS
- [ ] `npm test` repo-wide 0 fail（除 BL-049 引入的可能新 fail）
- [ ] commit message 含 (a)(b) 各根因 + 修复方式

---

### F006 · vitest trailing comment 清 + tests/ dead code 评估

**Executor:** generator
**Priority:** low
**预估工时:** 15 min

**改动：**

1. **`vitest.config.ts` 末尾删** `// re-trigger CI for F006 against baseline v2 (data-kol-platform=youtube selector)`
2. **`tests/__example/`** — 实地评估：是否仍是历史 spec 模板？如有具体内容引用从 docs/dev/ 链入；否则删
3. **`tests/helpers/_colima-detect.ts`** — macOS docker 检测，仅 BL-044 used；如本地 dev / CI 都不依赖则删
4. **`tests/mocks/browser.ts`** — 不在 tests/setup.ts 引用 — 实地确认未被引用则删

**Acceptance：**
- [ ] vitest.config.ts trailing comment 清
- [ ] 4 个 dead code 候选实地评估，删 / 保留 / 文档化（commit message 写各项决定）
- [ ] `npm test + lint + tsc` 全绿（无 regression）

---

### F007 · framework v0.9.15 沉淀（5/7 13:06 修正 — 2 维教训）

**Executor:** generator
**Priority:** medium
**预估工时:** 20 min（Planner 同步 0.25h）

**改动：**

> **重要：** BL-047 5/7 13:06 修正后真实历史是「真 bug + 跨环境差异」**不是** spec premise 错误。沉淀 2 维（不只是 1 维"实地跑"）：(1) Backlog 测试断言必须实地跑 + 复现 reviewer 环境 (2) 测试 stub 必须 environment-agnostic。

1. **`framework/harness/planner.md`** 铁律 1 检查矩阵 +2 行：

```markdown
| 内容 | 核查动作 |
|------|---------|
| Backlog 条目涉及"测试 fail / 测试 PASS / 测试覆盖"类断言（v0.9.15 #1）| 必须实地 `npx vitest run <target>` 验证当前实情 + **复现 reviewer 实际跑测试的环境**（pool 类型 forks vs threads / vitest version / Node version）；Generator forks pool PASS ≠ Codex threads pool PASS（BL-047 反例：Generator 5/7 10:30 forks pool 1043/1043 PASS 误以为无 bug，Codex 11:51 reverifying 实际复现 localStorage TypeError） |
| 测试 stub 设计（v0.9.15 #2）— Test fixture / 全局 mock / setupFiles 内 stub | 必须 environment-agnostic（如用 Map-backed 自实装 stub），不依赖 jsdom / happy-dom / Node 默认行为；不同 vitest pool 启动顺序可能导致 jsdom 全局 init 时机不同 → 不依赖默认行为消除 race（BL-047 fix-round 1 commit 9fa2a49 范式） |
```

2. **`framework/CHANGELOG.md`** 加 v0.9.15 entry：

```markdown
## v0.9.15 — 2026-05-07

来源：BL-021 F002 撤再翻盘（5/7 10:30 撤 → 11:51 Codex reverifying FAIL → 13:00 fix-round 1 真修 @ 9fa2a49）+ BL-049 测试基建升级 audit。

新增/修订：
- `planner.md` 铁律 1 检查矩阵 +2 行（v0.9.15 #1 + #2）— 跨环境/跨 pool 复现 + 测试 stub environment-agnostic
- 沉淀来源：`docs/audit-reports/test-infra-audit-2026-05-07.md` §4 + BL-047 fix-round 1 commit 9fa2a49 (Map-backed stub 范式)
```

3. **`framework/proposed-learnings.md`** 加沉淀完成 comment：
```markdown
<!-- 2026-05-07: v0.9.15 沉淀完成（2 条 learnings 来源 BL-021 F002 撤再翻盘 + BL-049 audit），已写入 planner.md 铁律 1 矩阵 +2 行 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.15.md。 -->
```

4. **`framework/archive/proposed-learnings-archive-v0.9.15.md`** 新建归档：
- Learning #1: 跨环境复现（BL-047 反例完整时间线 5/7 10:30 撤 → 11:51 Codex 复现 → 13:00 fix-round 1）
- Learning #2: Map-backed stub 范式（commit 9fa2a49 引用）

5. **`docs/audit-reports/test-infra-audit-2026-05-07.md`** 第 5 节状态表更新（标 BL-049 done） + 第 4 节"v0.9.15 候选沉淀"已修正为 2 维（5/7 13:06 已 update）

**Acceptance：**
- [ ] `framework/harness/planner.md` 铁律 1 矩阵 +2 行（不是 1 行）
- [ ] `framework/CHANGELOG.md` v0.9.15 entry 含真实历史（撤 → 翻盘 → fix-round 1）
- [ ] `framework/proposed-learnings.md` 加沉淀完成 comment（2 条 learnings）
- [ ] `framework/archive/proposed-learnings-archive-v0.9.15.md` 新建（含 BL-047 完整反例时间线 + Map-backed stub 范式）
- [ ] `docs/audit-reports/test-infra-audit-2026-05-07.md` 状态更新

---

## 3. 变更文件清单

```
vitest.coverage-exclusions.ts                                F001 NEW (~80 行 export 数组)
vitest.config.ts                                              F001 EDIT (-~80 行 + import) + F006 EDIT (清 trailing comment)
vitest.integration.config.ts                                  F002 EDIT (fileParallelism: true + poolOptions)
playwright.config.ts                                          F003 EDIT (+visual project + chromium project 拆)
.github/workflows/ci.yml                                      F003 EDIT (e2e job 改为 2 projects 顺序跑 / 或 1 命令)
.github/dependabot.yml                                        F004 NEW (~30 行 npm + github-actions ecosystems)

tests/integration/material-symbols-coverage.test.ts           F005 EDIT (修 woff2 stale)
tests/e2e/database-fidelity.spec.ts                          F005 EDIT (改 expectation enabled)
src/app/fonts/material-symbols-outlined-*.woff2              F005 EDIT (regen if needed)

tests/__example/**                                            F006 EVAL/DEL (Generator 评估)
tests/helpers/_colima-detect.ts                              F006 EVAL/DEL
tests/mocks/browser.ts                                        F006 EVAL/DEL

framework/harness/planner.md                                  F007 EDIT (铁律 1 矩阵 +1 行)
framework/CHANGELOG.md                                        F007 EDIT (+v0.9.15 entry)
framework/proposed-learnings.md                              F007 EDIT (+沉淀 comment)
framework/archive/proposed-learnings-archive-v0.9.15.md      F007 NEW
docs/audit-reports/test-infra-audit-2026-05-07.md            F007 EDIT (状态表更新)
```

---

## 4. 关键设计决策

### D1 · F001 拆 helper file（不内联在 vitest.config.ts）
- 100+ 行 inline exclude 注释扰乱 vitest config 主结构
- 拆 helper 独立维护 + 主 config 可读性提升 + 未来 CI / Codex 评审 PR 时聚焦清晰

### D2 · F002 maxForks=4 起步
- CI runner 7GB RAM + 4 vCPU；4 workers 不过载（每 worker ~1.7GB）
- 监控 first run OOM / port 冲突 — 后续可调 maxForks

### D3 · F003 探索 3 路径（A/B/C），Generator 实装时确定
- A 2 DB 隔离最干净但 ops 开销大
- B transaction rollback 复杂（Prisma + Playwright fixture lifecycle 协调）
- C snapshot 简单但 fresh seed 已是 db:seed idempotent，可能本身就够

### D4 · F004 Dependabot groups 防 PR 爆炸
- next/prisma/vitest/playwright 各 1 group → 每周 5 PR 上限
- github-actions 单独 1 group

### D5 · F005 修复方式 (b) 改 expectation 而非 disable export
- BL-024 F004/F005 启用 export 是真实功能，不该回退
- 测试断言不同步是 BL-024 oversight 遗留 — 改 e2e 断言到 `enabled` 即可

### D6 · F006 dead code 实地评估而非默删
- `tests/__example/` 可能仍有被 spec / docs 引用 → 删前 grep
- `_colima-detect.ts` 仅 BL-044 used；如不再 used 则删
- 评估结果记录 commit message

### D7 · F007 v0.9.15 沉淀强化「实地验证」维度
- v0.9.14 §planner.md 铁律 1 sediment "audit/spec 起草前 grep 实物"
- v0.9.15 反例 BL-047 进一步强化：grep 实物 ≠ 不够，必须实地**跑测试** verify "fail/PASS" 类断言
- 这是 v0.9.14 的扩展不是替代

---

## 5. v0.9.x 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | Planner 起 spec 前已 grep 实地：vitest.config.ts (100+ 行 exclude) / tests/ 目录结构 / CI workflow / 测试文件分布 / pre-existing fails |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | 可能触发：F002 maxForks=4 启用后如撞 CI OOM，主动停 + 短格式裁决 |
| v0.9.7 §1.6 PM2 / v0.9.14 §1.7 .env reload | 不涉及 PM2 .env 改动 |
| v0.9.15 (本批次 F007 沉淀) | F007 自身落地 |

---

## 6. 实装顺序（Generator 接手参考）

```
顺序按风险递增（先做最简单 / 不破坏 CI 的）：

1. F006 vitest trailing comment 清（1 min，最简单）
2. F004 .github/dependabot.yml 新建（30 min，独立无依赖）
3. F005 (b) e2e database-fidelity.spec.ts expectation 改 enabled（5 min）
4. F005 (a) material-symbols-coverage 修（实地查 + woff2 regen if needed，~30 min）
5. F001 vitest.coverage-exclusions.ts 拆 helper（30 min，纯重构）
6. F006 tests/__example/ + helpers/_colima-detect.ts + mocks/browser.ts 评估（15 min）
7. F002 vitest.integration.config.ts fileParallelism + maxForks=4（1-2h，本机跑通后 push）
8. F003 playwright.config.ts visual project 拆 + ci.yml e2e job 改（2-3h，最复杂）
9. F007 framework v0.9.15 沉淀 + audit doc 状态更新（15 min）
10. lint + tsc + test + 全套 CI 守门
11. push commit（建议 2-3 commits 拆开 F001-F006 / F002 / F003 / F007）
```

---

## 7. Definition of Done

### 7.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | 5/8 周一首次 Dependabot run 后看 PR 列表（5 个 group），决议合并/延后 | F004 push 后 |
| 2 | （可选）5/13 上线后第一次 npm test 全绿确认（含 F005 修后） | 上线后 |

### 7.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含 F005 修后 0 unrelated fail）+ CI 全绿
- **L2 staging：** F002 integration parallelism 实测时间从 ~10-15min → ~3-4min（CI run 实测对比 commit message 写）；F003 visual + chromium 2 projects 跑通；E2E job 时间不超过当前 ~10min

### 7.3 Soft-watch（不阻塞 done）

- 5/8 周一 Dependabot 首次 run 健康
- 接客户后 npm audit 高危漏洞 0
- 5/15+ CI runner OOM 监控（如 maxForks=4 撞限可调 3）

---

> **Spec lock：** Planner johnsong @ 2026-05-07 10:50。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段良性偏差按 §11 处理。
> **关联：** `docs/audit-reports/test-infra-audit-2026-05-07.md`（13 项发现详情 + 5 节状态）。
