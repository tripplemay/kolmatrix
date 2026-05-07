# 测试基建系统性 Audit 报告 — 2026-05-07

> **类型：** Review / Health audit（非 pre-impl audit）
> **作者：** Planner johnsong
> **触发：** 用户 5/7 10:30 BL-021 building 期间请求 review 测试基建（项目初期搭建后，226 测试文件，多批次累积，需评估是否需要优化升级）
> **范围：** vitest unit + integration / playwright e2e / visual regression / CI workflows / fixtures / mocks / coverage gating
> **关联：** BL-049 测试基建系统性升级 mini-batch 起 spec 时引用本文件

---

## 1. 测试规模快照（2026-05-07）

```
单测:                 34 (tests/unit) + 108 (co-located src/**/__tests__) + 3 (scripts) = 145
集成:                 65 (tests/integration with Testcontainers postgres:16)
E2E:                  15 (tests/e2e + Playwright chromium 1440x900)
Visual baselines:     19 PNG (en-* + dashboard.png)
总测试文件:           226
CI 6 jobs:            install / lint / typecheck / validate-rollback-sql / build+migrate-smoke / unit-tests+coverage / integration-tests / e2e-tests
```

最近相关 commits（30 days）：BL-021 F001 + BL-023 F001-F008 + BL-044 F001-F004 + BL-040 F001 + BL-024 F001-F008 等批次都加了对应测试。

---

## 2. 13 项发现（按优先级）

### 🔴 High — 5/13 上线前应处理（3 项）

| # | 问题 | 影响 | 工时 |
|---|------|------|------|
| **1** | `vitest.config.ts` `coverage.exclude` **100+ 行**含 30+ 文件 + 每条 inline 注释（BM2/B5/B7a/BIx 各历史决策）— 维护负担重 + 注释易过期 | 升级 dependency 时 reviewer 难判断 exclude 是否仍合理 | 30 min（拆到 `vitest.coverage-exclusions.ts` helper file） |
| **2** | F002 反例（BL-021）：BL-047 spec premise 错误（测试已 PASS 无 bug 可修）— framework v0.9.15 沉淀候选：「Backlog spec premise 起草前必须实地跑测试验证」 | 防未来 backlog 起草误判（BL-040/044/043 verifying 报告"unrelated existing failure"措辞误导）| 15 min（沉淀 + planner.md 铁律 1 矩阵 +1 行） |
| **3** | `vitest.config.ts` 末尾 trailing comment `// re-trigger CI for F006 against baseline v2 (data-kol-platform=youtube selector)` — dead code | 代码气味；commit message 历史已记录无需 inline 注释 | 1 min |

### 🟡 Medium — 接客户前（5 项）

| # | 问题 | 影响 | 工时 |
|---|------|------|------|
| **4** | `vitest.integration.config.ts fileParallelism: false` 单 worker — 65 integration files 跑 ~10-15 min；4 workers 可能 3-4 min | CI 时间敏感；接客户后高频 deploy 痛点 | 1-2h（每文件 unique container port + cleanup 隔离） |
| **5** | E2E CI 复杂 workaround — visual 先跑 + reseed + 其余（注释明示「future cleanup: visual 独立 project + 隔离 DB」）| race condition 引入 flaky | 2-3h（独立 Playwright project + 独立 DB） |
| **6** | CI 无 dependency 安全扫描（npm audit / Snyk / Dependabot）| 上线对外前 baseline 安全要求 | 30 min（GitHub Actions Dependabot config） |
| **7** | `tests/fixtures/` 仅 4 实体（kol/campaign/tenant/user）+ 大量 inline hardcode（BL-044 加 13 fixture / BL-023 加 16 case 都 inline）— 无 factory pattern | 测试数据 pollution 风险 + 重复 | 1-2h（引入 fishery factory + migrate 高频 fixture） |
| **8** | `material-symbols-coverage.test.ts` + `e2e database-fidelity.spec.ts` pre-existing fail — verifying 报告反复"unrelated existing failure"| npm test 不全绿 | 30 min - 1h（实地查根因 + 修） |

### 🟢 Low / Post-MVP（5 项）

| # | 问题 | 状态 |
|---|------|------|
| **9** | E2E 仅 chromium / 1440x900 — Firefox / WebKit / mobile viewport 0 覆盖 | BL-015 + BL-019 已入 backlog low/deferred |
| **10** | 无 mutation testing (Stryker) / property-based testing (fast-check)；valueScore 等复杂公式仅 example test | post-MVP polish |
| **11** | Coverage thresholds 仅 lines/functions/statements 80%，**未含 branches** | 接客户后 polish |
| **12** | `tests/__example/` 历史 spec 模板？`tests/helpers/_colima-detect.ts` macOS docker 检测仅 BL-044 用过 deprecated？`tests/mocks/browser.ts` 不在 setup.ts 引用 dead code? | 清理候选 |
| **13** | E2E 15 spec 远低于 critical paths 11 路由 × 关键 flow（应 21+）；新 backlog BL-018 全量 edge states 已跟踪 | 已 backlog low |

---

## 3. 推荐处理（用户 5/7 10:35 决议同意 X1 合并）

### BL-049 测试基建系统性升级 mini-batch — High 3 + Medium 4 = **7 features**

```
F001 vitest.config.ts coverage.exclude 拆 helper file (30 min)
F002 vitest.integration.config.ts fileParallelism + 4 workers + 隔离 fixtures (1-2h)
F003 E2E visual workaround 独立 Playwright project + 隔离 DB (2-3h)
F004 CI Dependabot config (30 min)
F005 material-symbols-coverage + e2e database-fidelity pre-existing fails 修 (30 min - 1h)
F006 vitest trailing comment 清 + tests/__example/ + helpers/_colima-detect.ts dead code 评估 (15 min)
F007 framework v0.9.15 沉淀 (BL-047 反例 + planner.md 铁律 1 矩阵 +1 行 + 本 audit 文档归档) (15 min)
```

**总：** ~6h Generator + 0.5h Reviewer + 0.25h Planner

**启动时机：** BL-021 done 后立即切 building（5/7 中午前；4-day buffer 充足）

### Low / Post-MVP（5 项）保持现状
- BL-015 / BL-018 / BL-019 已 backlog 跟踪
- #10 mutation/property testing 待评估 ADR-XXX
- #11 branch coverage 接客户后 polish
- #12 dead code 评估并入 BL-049 F006

---

## 4. 框架 dogfood（v0.9.15 候选沉淀 — 5/7 13:06 修正 2 维）

**初版判断（5/7 10:30）：** F002 反例 — Planner 起 BL-047 spec 时未实地跑测试，仅依赖 Codex verifying 报告"unrelated existing failure"措辞，导致 spec premise 错误。Generator 实地 forks pool 跑 1043/1043 PASS，撤 F002。

**真实根因（5/7 11:51-13:06 修正）：** **BL-047 是真 bug**，不是 spec premise 错误。Codex 在 reverifying 时**实际复现 localStorage TypeError**（不同 pool/env 配置）。Generator forks pool 全 PASS ≠ 没 bug — 是不同环境跑 jsdom 行为差异。fix-round 1 @ commit `9fa2a49` 用 **Map-backed env-portable stub** 修了真 bug（不依赖 jsdom 默认 localStorage）。

教训含 **2 维**（不只是 1 维"实地跑"）：

**framework v0.9.15 候选沉淀（BL-049 F007 实装 2 行）：**

planner.md 铁律 1 检查矩阵 +2 行：

| 内容 | 核查动作 |
|------|---------|
| Backlog 条目涉及"测试 fail / 测试 PASS / 测试覆盖"类断言（v0.9.15 #1）| **必须实地 `npx vitest run <target>` 验证当前实情** + **必须复现 reviewer 实际跑测试的环境**（pool 类型 forks vs threads / vitest version / Node version）；Generator forks pool PASS ≠ Codex threads pool PASS（BL-047 反例：Generator 5/7 10:30 forks pool 1043/1043 PASS 误以为无 bug，Codex 11:51 reverifying 实际复现 localStorage TypeError） |
| 测试 stub 设计（v0.9.15 #2）— Test fixture / 全局 mock / setupFiles 内 stub | **必须 environment-agnostic**（如用 Map-backed 自实装 stub），**不依赖 jsdom / happy-dom / Node 默认行为**；不同 vitest pool 启动顺序可能导致 jsdom 全局 init 时机不同 → 不依赖默认行为消除 race（BL-047 fix-round 1 commit 9fa2a49 范式） |

---

## 5. 状态

| 状态 | 时间 | 谁 |
|------|------|-----|
| Audit 起草 | 5/7 10:30 | Planner johnsong |
| 用户决议 X1 合并 | 5/7 10:50 | 用户 |
| BL-049 spec lock | 5/7 ~11:00 | Planner（BL-021 done 后）|
| BL-049 building 启动 | 5/7 ~11:00 | Generator Kimi |
| BL-049 done 预估 | 5/7 ~17:00（按 4-6x 加速可能 ~13:00）| - |

---

> **本文件作 BL-049 reference doc**；BL-049 F007 沉淀完成后归档到 `framework/archive/proposed-learnings-archive-v0.9.15.md`。
