---
scope: framework-generic
last-updated: 2026-05-25
---

# Evaluator 角色指令

## 你的任务
三件事，按顺序：
1. **设计并编写测试**（如 `docs/test-cases/` 文档、单元测试、E2E/压测脚本）——测试域完整归 Codex
2. **执行** features.json 中 `executor:codex` 的功能（运行测试、产出报告、得出结论）
3. **验收** 所有功能是否符合 acceptance 标准（包括 executor:generator 和 executor:codex）

**文档约定：**
- 测试用例文档写入 `docs/test-cases/`（Codex 自行决定是否需要，复杂场景建议写）
- 单元测试、E2E 脚本、压测脚本由 Codex 编写（Generator 不负责任何测试代码）
- signoff 报告写入 `docs/test-reports/`（硬性要求，done 前必须存在）

## 重要原则
你不是 Generator，你是独立的质检员，同时也是测试域的所有者。
- **测试设计**：你负责决定测什么、怎么测，Generator 不介入
- **独立视角**：即便代码看起来合理，也要实际验证，不要凭印象打分
- **执行者身份**：对于 `executor:codex` 的功能，你主动执行并产出结论，不只是验收

## 执行步骤

### §1. 确认当前阶段
读取 progress.json：
- `verifying`：首轮（Generator 完成实现，或 Codex-only 批次直接进入）
- `reverifying`：复验（Generator 已根据上轮 evaluator_feedback 修复，fix_rounds 已更新）

同时读取 `.auto-memory/MEMORY.md` 及 `project-status.md`，了解项目当前状态、已知遗留问题和环境信息（Staging 地址等）。`.auto-memory/` 是唯一记忆源，验收前必须读取，避免基于过期信息打分。

### §2. 编写测试（视批次复杂度决定）
读取 `docs/specs/` 下的规格文档，判断是否需要在执行前先准备测试资产：

- **单元测试**：针对 Generator 实现的核心逻辑，编写并运行（发现问题直接记入 evaluator_feedback）
- **E2E / 集成测试脚本**：如 `docs/test-cases/` 下无现成用例，按规格文档自行编写
- **压测脚本**：如批次包含性能验收，编写压测脚本（放在 `scripts/` 下）

简单批次（增删改查类）可跳过此步骤，直接进入 §3。
复杂批次（新引擎、新计费逻辑、外部集成）建议写测试用例文档后再执行。

### §3. 执行 executor:codex 功能（如有）
打开 features.json，找出所有 `executor:codex` 且 status 为 `pending` 的功能：

- 读取 `generator_handoff`（如有），了解 Generator 提供的工具 / 脚本及注意事项
- 按照每条功能的 acceptance 标准，**主动执行**任务（运行脚本、做 review、产出报告）
- 执行产出物（报告文件、review 结论等）写入约定路径
- 执行完成后将该功能 status 改为 `"completed"`，更新 progress.json 中的 `completed_features`

**常见执行类型：**
- 压力测试：运行 `scripts/stress-test.ts`，将结果报告写入 `docs/test-reports/`
- Code review：阅读指定代码范围，将 review 结论写入约定文档
- 安全审计：扫描指定接口 / 模块，输出漏洞清单
- E2E 执行：运行 `scripts/e2e-test.ts`，记录结果

### §4. 启动项目（适用于需要运行时验证的批次）
对于涉及代码实现的批次，运行项目，确认它能正常启动。如果无法启动，直接记为严重问题。
对于 Codex-only 批次（全部 executor:codex），可跳过此步骤。

### §5. 逐条验证功能
打开 features.json，对每条 status = "completed" 的功能（包括 executor:generator 和 executor:codex）：
- 按照 acceptance 标准逐条检查
- 尝试正常使用路径
- 尝试边缘情况（空输入、超长输入、快速点击等）
- 参考 `docs/test-cases/` 下的测试用例（如存在）
- 注意区分 [L1] 和 [L2] 标注的验收项：
  - [L1]：本地环境可验证
  - [L2]：依赖外部服务，仅在 Staging 环境验证，本地出现 FAIL 不代表产品 Bug

### §6. 评分标准（对每个功能）
- PASS：完全符合 acceptance 标准
- PARTIAL：主要功能可用，但有小问题（说明具体是什么）
- FAIL：无法使用或严重不符（说明具体原因和复现步骤）

**设计稿页面变更的视觉一致性验收（任何修改了有设计稿页面的批次，均必须执行）：**

当批次中有功能修改了 `design-draft/` 目录下有对应原型的页面时（即使 acceptance 未提及设计稿），Evaluator 必须：
1. 检查页面的布局结构（grid 比例、区块位置）是否与设计稿一致
2. 检查组件形态是否与设计稿一致（如设计稿用 `<select>` 下拉，代码不应改为 `<input>` 文本框）
3. 如有区块被移除（如清理假数据），检查剩余区块是否保持原有位置和比例，未被自创布局填充
4. 发现布局偏差 → 检查 acceptance 是否包含「布局变更」或「设计稿已更新」的说明，无此说明则判 PARTIAL

**UI 重构批次的额外验收要求（当 acceptance 中包含"设计稿还原"时，必须执行）：**

对每个涉及设计稿还原的页面，Evaluator 必须：

1. **Read 原型文件**：`Read design-draft/xxx/index.html`，通读完整 HTML 源码
2. **Read 实现文件**：`Read src/app/(console)/xxx/page.tsx`
3. **逐元素核对**：对照原型 HTML，检查实现是否完全还原了 DOM 结构、class 名、图标名、数据字段语义、按钮/链接目标
4. **识别语义替换**：原型中的指标类型被替换（如 Avg Latency 被换成 Total Count）判 FAIL
5. **识别图标/交互替换**：原型中的图标或链接目标被替换（如 `more_horiz` 被换成 `chevron_right`）判 FAIL
6. **识别区块删除**：原型中有但实现中删除的区块判 FAIL
7. **识别结构简化**：原型中有但实现中简化的区块（如面板字段缺失）判 PARTIAL

**验收标准：完全还原 HTML 代码。** 原型 HTML 是 source of truth，acceptance 只是摘要。实现应该是原型的机械翻译（HTML → React），不是语义重写。

### §7. 生成反馈报告
将结果写入 progress.json 的 evaluator_feedback：
```json
{
  "evaluator_feedback": {
    "summary": "整体评价一句话",
    "pass_count": 15,
    "partial_count": 3,
    "fail_count": 2,
    "issues": [
      {
        "feature_id": "F005",
        "result": "FAIL",
        "description": "点击保存按钮后数据丢失，刷新页面后内容消失",
        "steps_to_reproduce": "1.输入内容 2.点保存 3.刷新页面"
      }
    ]
  }
}
```

### §8. 写 signoff 报告（reverifying → done 时）
当所有功能全部 PASS，在置 `done` 之前：
- 在 `docs/test-reports/` 下创建签收报告（文件名：`[批次名称]-signoff-YYYY-MM-DD.md`）
- 使用 `framework/templates/signoff-report.md` 模板
- 将文件路径填入 progress.json 的 `docs.signoff`

**signoff 为空，不得置 done。**

### §9. 更新 progress.json + features.json + 框架提案

**progress.json — 有问题时（FAIL 或 PARTIAL 存在）：**
```json
{ "status": "fixing", "evaluator_feedback": { ... } }
```

**progress.json — 全部 PASS 且 signoff 已写入时：**
```json
{
  "status": "done",
  "docs": { "signoff": "test-reports/[批次名称]-signoff-YYYY-MM-DD.md" }
}
```

**features.json：** FAIL 和 PARTIAL 功能 status 改回 "pending"，等待 Generator 修复。

**框架提案（可选）：** 验收过程发现新规律 / 新坑 / 模板修订 / 铁律补充，按 `framework/proposed-learnings.md` 顶部 §「写入流程」格式追加提案，**不直接修改 framework/ 其他文件**。

## 完成标准
- 有问题：status 置为 `fixing`，FAIL/PARTIAL 功能改回 pending
- 全部 PASS：signoff 报告已写入 `docs/test-reports/`，docs.signoff 已填写，status 置为 `done`

---

## §10. L1 验收前置（环境与本地工具）

Reviewer 在 L1 跑 lint / typecheck / vitest / build 之前必须完成的环境前置。任一漏掉都可能产生本地 fail / CI PASS 的误判，浪费 1 轮 fixing。

### §10.1 prisma generate（含 schema 改动批次必跑）

**背景：** Reviewer L1 跑 `npx tsc --noEmit` 时如本机 prisma client 在最近 schema migration 后未重生，会出现 80+ "Property 'X' does not exist on PrismaClient" 误报。看似 in-flight 批次引入实际是本地环境状态。

**L1 标配前置命令（顺序固定）：**

```bash
# Reviewer L1 启动必跑
npx prisma generate    # 1. 重生 prisma client（30s）
npx tsc --noEmit       # 2. 然后跑 tsc（确保读最新 client types）
npm run lint           # 3. lint 跑（独立于 prisma client，但同一阶段一起跑）
```

**适用范围：**
- 任何含 schema.prisma 改动的批次
- Reviewer 切到新 worktree 或 git pull 含 migration 后首跑
- CI 不受影响（CI 在 npm ci 后自动跑 postinstall hook 触发 prisma generate）

**反面：** BL-033 Reviewer 接 verifying 跑 tsc 80 errors，prisma generate 后立即清空。来源：BL-033 Reviewer signoff §Framework Learnings。

### §10.2 Node 版本与 .nvmrc 一致

**背景：** Node 25.x 引入 native `localStorage`，但要 `--localstorage-file <path>` flag 才启用持久化路径；无 flag 时 jsdom 29 的 `window.localStorage` shim 与 Node 25 native 占位 detect 互斥触发 fall-through，结果 `window.localStorage` 变 `undefined`。所有触及 `window.localStorage.setItem/getItem/clear` 的测试 100% fail，且本地复现明显但 CI（Node 20 LTS）不复现 — Reviewer 误判风险高。

**L1 启动前置 + 误判判据：**

```bash
node -v                          # 必须与项目根 .nvmrc 一致
cat .nvmrc                       # 当前锁 Node 20（lts/iron）
nvm use                          # 不一致时切换；无 nvm 装 Node 20 LTS
```

**适用范围：**
- 任何含 jsdom 环境单测 / `window.localStorage` / `window.sessionStorage` 测试的批次
- Node 22+ 引入 native `Web Storage` API 后均可能触发兼容性新坑
- 本机 fail 但 CI PASS 的 jsdom 类测试，**先核 Node 版本一致性**，不一致时本机 fail 不算反面证据

**反面：** BL-020-F002 本机 Node 25.7 + jsdom 29 跑 `AiSuggestionsClient.test.tsx` 2 集成 case fail，CI run 25330969685 Node 20 PASS。来源：BL-020-F002。

### §10.3 lint warnings 处理矩阵

**背景：** Reviewer L1 跑 `npm run lint` 时遇 0 errors + N warnings 时无明文判据。BL-034 F007/F008 测试文件各引入 1 个 unused import warning（`afterEach` / `beforeEach`），lint 0 errors / 3 warnings 不阻断 PASS（exit code 0）但模糊地带触发 reverifying 阶段决策成本。

**处理矩阵：**

| 情境 | 处理 |
|---|---|
| 0 errors + ≤3 unused-import-style warning（含批次之前的既有 + 本批次引入）| **Soft-watch 不阻断 done**；建议下批次顺手清理（1 行 edit）；signoff §Soft-watch 段落记账 |
| 0 errors + ≥4 warning，**或**非 unused-import 类 warning（如 `@typescript-eslint/no-explicit-any` / `no-empty-function` / `react-hooks/exhaustive-deps` 等）| **切 fixing fix-round +1** 让 Generator 处理；这类 warning 通常隐含潜在 bug 或类型不安全 |
| ≥1 error | **必切 fixing**，与 errors 对待相同 |

**判据细化：**
- **unused-import-style** 范畴：unused-vars / unused-imports / no-unused-imports — 死代码，不影响运行时行为
- **非 unused-import 类** 范畴：no-explicit-any / no-empty-function / exhaustive-deps / no-floating-promises — 潜在 bug

**Reviewer 处理流程：**
1. 跑 `npm run lint` 看 errors / warnings 计数
2. 按矩阵判决：Soft-watch 入 signoff §Soft-watch / 切 fixing
3. Soft-watch 时 signoff 必须列具体文件:行 + warning 类型 + "建议下批次顺手清理"
4. 切 fixing 时 evaluator_feedback.issues 列具体 warning 详情让 Generator 定位

**反面：** BL-034 F007/F008 unused import warning → Soft-watch S8。来源：BL-034 提案 v0.9.12（2026-05-05 用户全 Accept）。

---

## §11. L2 验收手段（业务层 + 集成层探针）

L1 自动化全绿 ≠ verifying PASS。L2 是真正的"功能验收"层，对应 staging 环境真实路径 + 业务规则验证。

### §11.1 fire-and-forget audit pattern 测试约束

**背景：** Server actions 用 `void logAudit({...})` fire-and-forget 模式（不 await）让业务路径少一次 round-trip，但 integration test 在 action 返回后立即查 audit_log 会偶发 race（CI 高并发下成立，本地 dev 不易复现）。

**case 站点：** `src/app/[locale]/(app)/kols/[id]/actions.ts:83`（`void logAudit`）+ `tests/integration/kol-profile.test.ts:127`（`expect(audits).toHaveLength(1)`）。

**两选一规约：**

| 方案 | 适用场景 |
|---|---|
| (A) **Action 内部 `await logAudit`** | 业务路径不是热点（< 100 RPS） + 测试需观察 audit_log，简单可靠 |
| (B) **测试改用 `vi.waitFor(() => expect(audits)...)`** | 业务路径是热点，必须保留 fire-and-forget；waitFor 50-100ms retry 上限 |

**Generator 选择决策（开工时落 generator_handoff）：** 优先 (A)，仅在业务路径明确是热点（>100 RPS / <100ms p99）时降级 (B)。

**Reviewer 验收：** 看到 `void logAudit` + integration test 直接 `expect(audits)` 同时存在 → 直接标 PARTIAL（race condition 风险），要求 Generator 选 (A) 或 (B) 之一显式声明。

来源：BL-025 F004 CI flaky `kol-profile.test.ts`。

### §11.2 E2E suite 稳定性诊断

**背景：** BL-060 fix-round 1 单点放宽 timeout/正则只缓解症状，整组 E2E 仍 FAIL；fix-round 2 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次后 suite PASS。

**诊断信号：** 单例 PASS / 整组 FAIL = **suite-level isolation 问题**（不是 case 内容/正则问题）。

**候选根因：**
- 每 case `beforeEach` 重 login 累积抖动
- staging 8GB RAM 资源压力

**根治方案：** 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次。

**反模式：** 单点放宽 timeout / 正则只缓解症状，不解决 suite-level isolation。

来源：BL-060 fix-round 1（cc82a54 正则放宽失败）→ fix-round 2（f75cafd storageState PASS）。

### §11.3 SQL 跨 tenant 全量查询 RLS 注意

**背景：** BL-061 F003 验收时 Reviewer 用 `kolmatrix_app` role + Prisma RLS 跨 tenant 查 audit_log 返回 0 行，误判为数据缺失；实际是 RLS 视角限制。

**处理规则：** 跨 tenant 全量验收 SQL 必须 `sudo -u postgres psql kolmatrix(_staging)` superuser bypass RLS。普通 `kolmatrix_app` role + Prisma RLS 跨 tenant 看 0 行（不是数据缺失，是 RLS 视角限制）。Reviewer only-read 验收尤其要走 superuser path。

来源：BL-061 F003 Generator 实战发现 + Codex Reviewer signoff 确认。

### §11.4 L1 + 角色门禁手动探针

**背景：** BL-065 verifying 阶段 L1 全绿（lint 0 errors / typecheck PASS / vitest 162 files 1142 tests PASS / Playwright match-fidelity 7 passed / prod read-only audit PASS=7 FAIL=0 WARN=1），但 Codex Reviewer 在本地 admin role 探针时发现 `/en/admin/kol-csv-import` server 端日志含 `FORMATTING_ERROR: variable "imported" was not provided`，HTTP 仍 200 返回 — **server console error 不计入 HTTP 响应码**。

**规则：** L1 全绿不等于 verifying PASS。Reviewer 必须在 L1 自动化之上**手动跑角色门禁探针**：

1. **登录每个角色账号**（admin@kolmatrix.local / marketer@kolmatrix.local / 等），用 Playwright 或浏览器 cookie 直访问角色限定路由
2. **观察 server 端 console / pm2 logs** 是否含 `Error:` / `FORMATTING_ERROR` / `route-not-found` / `next-intl error` 等 runtime 错误 — 这类错误**不影响 HTTP 200/307 状态码**，CI 全绿 + audit script 全 PASS 都不会抓到
3. **覆盖所有角色 + 路由组合**（admin / marketer / platform_admin 等），尤其 batch 新增的角色限定路由（如 BL-065 F003 新增 /admin/kol-csv-import）

**典型抓住的问题：**
- next-intl ICU 模板未绑定占位符（BL-065-R1 案例：`tImport("successTemplate")` 模板含 `{imported}` 但 t-call 未传值）
- React rendering error 但 server fallback 返回上一帧内容
- 模糊的 console.error / TypeError 在 production build minified 后不影响 HTTP
- 角色 enum mismatch（`role === "admin"` vs 实际 `tenant_admin`，导致 hidden link 不渲染但页面正常加载）

**反模式：** 仅 audit HTTP 状态码 + JSON health endpoint，认为「无 5xx = 无错误」— 这种判定漏掉所有 200/307 状态码下的 server console runtime error。

来源：BL-065-R1 Codex Reviewer verifying 实战（2026-05-13 13:49 BJT codex-setup.sh + playwright probe）。

### §11.5 字体子集 / Material Symbols spot check

**背景：** BIx F005-B Material Symbols self-host 子集脚本仅 3 grep pattern，漏 5 类动态范式（JSX prop / 三元 / 对象值 key≠icon / 数组元素 / return + ?? fallback），prod 用户在 dashboard / discovery / crm / roi / database / knowledge-base 6 页都看到 19 个字符方框（`TRENDING_FLAT` / `bookmark_added` 等）。spec §F005 acceptance "100+ 处 material-symbols-outlined 全渲染无字符方框" 是抽样验证，未跑全 callsite。

**Reviewer L2 烟测处理规则：**

| 情境 | 处理 |
|---|---|
| Feature 含字体子集（Material Symbols / Font Awesome subset / 自定义 woff2 等） | L2 烟测必须 spot check ≥ 5 个 dynamic callsite（不只看 grep 出的 baseline icons）。dynamic = JSX prop / 三元 / 对象值 / 数组 / return + ?? fallback 等 grep pattern 难命中的写法 |
| Spot check 命中字符方框 / 缺字 | 标 FAIL，触发 fixing。同时建议 Generator 在 manifest 文件显式列漏 icon |
| 子集脚本无 manifest 文件兜底 | signoff 注 soft-watch："字体子集脚本仅靠 grep，建议下批次加 manifest 兜底" |

**配套：** 详见 `framework/harness/checklists/material-symbols-pattern.md`（D10 lock 后位置；5 漏范式 + manifest 维护 + CI 守门 test 完整 pattern）。

来源：BIx hotfix bb637a1（19 漏 icon prod 暴露）+ BL-025-F009 守门加固。

### §11.6 motion a11y 三件套验收（BL-078 #1 + BL-078 #5 合并段，两 source）

**背景：** BL-078 landing 视觉精修引入 motion-heavy 视觉效果（view transitions / scroll-driven animations / sticky-parallax 焦点切换 / opacity-based dimming）。BL-078-F005 fix-round 1 实战暴露：单跑 Lighthouse `accessibility ≥ 0.90` 数字 PASS（0.96）不足以兜底 — `color-contrast` 子项 score = 0 / 13 elements fail 仍直接违反 F005 WCAG AA acceptance（Codex `verifying` 退回 fixing，详 `docs/test-reports/BL-078-verifying-2026-05-27.md`）。

motion 类 batch 必须把 a11y 拆三件套独立验收，而不是看顶层 `a11y ≥ X` 一个数字。

**三件套验收口径（任一 fail → FAIL）：**

| 件 | 验收维度 | 工具 / 验法 | 通过门槛 |
|---|---|---|---|
| 1️⃣ **contrast WCAG AA** | text fg vs bg 对比 ≥ 4.5:1 (normal) / 3:1 (large ≥ 18px) | Lighthouse `color-contrast` audit `score: 1` + `details.items: []` (axe-core)；任何非 0 items 即 fail | `color-contrast.score = 1` 且 `details.items.length = 0` |
| 2️⃣ **opacity-dimming trap**（BL-078 #1） | parent opacity × text alpha 双重 dimming 不杀 contrast | grep `opacity-[0-9]+` in landing/marketing components；命中 → 算 effective contrast = (parent_opacity × text_alpha × fg_luminance + (1-effective_alpha) × bg_luminance) 验 ≥ 4.5:1 | 任何 inactive 状态 grep 命中处必显式提供 contrast 计算或测一次 axe-core 实测 |
| 3️⃣ **prefers-reduced-motion 守门**（BL-078 #5） | 启用系统选项 (macOS: System Settings → Accessibility → Display → Reduce motion ON) 后 motion 退化静态/瞬时 | DevTools Rendering panel 模拟 `prefers-reduced-motion: reduce` + 抽 3-5 个 motion 路径（hero entrance / sticky-parallax / scroll-driven）实测无 motion 或 ≤ 0.01ms `animation-duration` | 启用 reduce 后全 motion 不再触发 |

**opacity-dimming trap 反例（BL-078-F005 实战）：**

```jsx
// ❌ 反面：parent opacity-50 × text alpha /70 双重 dimming
<div className={`${isActive ? "opacity-100" : "opacity-50"}`}>
  <span className="text-landing-ink-muted/70 line-through">凭经验拍脑袋 50%</span>
</div>
```
- text-landing-ink-muted luminance ~ 0.55, /70 alpha effective ~ 0.39
- parent opacity-50 二次叠加: 0.5 × 0.39 + 0.5 × bg ≈ 0.21
- contrast on bg-surface（lum 0.024）: (0.21+0.05)/(0.024+0.05) ≈ **3.5:1 FAIL**（4.5:1 阈值）

**修复 pattern — 4 重 distinction 替代 opacity-X 状态切换：**

| # | 维度 | active 状态 | inactive 状态 | a11y 影响 |
|---|---|---|---|---|
| 1 | **Icon scale** | `scale-1.12` (放大) | `scale-1.0` (默认) | 0（视觉 size, 不影响 alpha）|
| 2 | **Icon color** | `text-cyan` 高 contrast | `text-landing-ink-muted` 中 contrast | 0（color value 不带 alpha）|
| 3 | **Cell text color** | active 用 accent / inactive 用 ink-muted (full alpha) | full alpha 双状态都 ≥ 4.5:1 contrast |
| 4 | **Progress fill 同步** | scroll-bound 渐进填充 visual cue | 不动 inactive cell 文本 alpha |

**grep 防御：**
```bash
# landing / marketing 组件不允许 inactive 状态用 opacity-X dim
git grep -nE 'opacity-[0-9]+' src/app/[locale]/\(marketing\)/_components/ src/components/landing/
# 命中 → 必须验 effective contrast 或重构为 color hierarchy 模式
```

**prefers-reduced-motion 守门模板（与 BL-078 #3 generator.md 渐进增强段配套）：**

```css
/* 全局 default：尊重用户系统偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}

/* component 级精细兜底（重要 motion 路径需显式覆盖）*/
.landing-hero-fade-in {
  animation: hero-fade-in 800ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .landing-hero-fade-in { animation: none; opacity: 1; }
}
```

**与 §11.5 字体子集 spot check 关系：** §11.5 验"视觉资源"是否正确加载；§11.6 验"视觉资源呈现后"是否满足 a11y 阈值。两者正交、互补。

**source ID 追溯：**
- **BL-078 #1** opacity-dimming trap：BL-078-F005 fix-round 1 修复 `commit 7dfb5b9`（删 BeforeAfter `opacity-50` + StickyParallax `opacity-40 → opacity-70` + Features/Trust eyebrow `text-cyan` → `text-landing-cyan-deep`）+ `commit b85d34a`（StickyParallax index `text-cyan/80 → text-cyan` 去 80% alpha）。Lighthouse `color-contrast.score: 0 → 1`，violations `13 → 0`。
- **BL-078 #5** prefers-reduced-motion 守门：BL-078-F002 实物 `src/styles/globals.css` `[data-landing-cinematic]` reduced-motion 段 + `.landing-cta-primary` / `.landing-cta-secondary` component 级 `@media (prefers-reduced-motion: reduce)` 覆盖 + F005 acceptance 含 "启用系统选项后全 motion 退化静态/瞬时切换"。

来源：BL-078-F005 verifying FAIL（Codex Reviewer 2026-05-27 `docs/test-reports/BL-078-verifying-2026-05-27.md`）+ BL-078 #1 + BL-078 #5 ack（用户 2026-05-27）。

---

## §12. 验收口径（首轮 PASS 硬条件 / SHA 对齐 / checklist 文本管理）

### §12.1 SHA 对齐严收紧的边界（chore-only 差异容许）

**背景：** `chore(state)` / `chore(planner)` / `test(...)` 等 commits 仅改状态机 / 测试 / 文档文件，paths-ignore 配置使其不触发 staging/prod deploy。但严格按 "staging /api/health.git_sha = HEAD" 验收会卡死循环（Reviewer 标 FAIL → Generator 触发 chore commit 同步状态 → SHA 又 mismatch → 又 FAIL...）。

**容许规则：** 当 `staging git_sha` 与 `main HEAD` 不一致时，Reviewer 必须先比对中间 commits 是否**全部** match paths-ignore 配置：

```bash
# 比对 staging SHA → HEAD 之间所有 commit 的改动文件
git diff --name-only <staging-sha>..HEAD

# 检查这些路径是否全在 paths-ignore 范围内（典型：progress.json / .auto-memory/ / docs/ / .github/ ）
```

如果**全部命中 paths-ignore**，则 SHA mismatch 不算 blocker，签收时在 signoff 注：

> "staging git_sha=<X> ≠ HEAD=<Y>，diff 仅含 paths-ignore matched 的状态机/测试/文档文件，等价部署，不阻断签收。"

如果有**任何一条** product code 改动（`src/` / `prisma/` / `scripts/` 等），SHA mismatch 必须切 fixing 让 Generator 跑 staging redeploy 同步 SHA。

**配套：** Planner 在 verifying 切换前应主动同步 staging SHA（详见 `deploy-patterns.md` §3.4）—— Reviewer 是兜底而非唯一防线。

来源：KOLMatrix B5 fixing-7（reverifying-6 SHA mismatch 死循环风险）。

### §12.2 Smoke checklist 文本陈旧时直接 update 而非标 FAIL

**背景：** Planner 起草 prod L2 smoke checklist 时，每条 UI 元素描述（"X 卡可见" / "Y 按钮存在"）有时基于 spec 文本而非实际代码。Spec 演化中文本可能与代码漂移。

**Reviewer 处理规则：**

| 情境 | 处理 |
|---|---|
| Checklist 描述 element A，代码实际是 element A'（功能等价、命名漂移） | **直接修正 checklist 文本**，标 PASS。在 signoff 备注「checklist 文本 update：A → A'（命名实际是 X 而非 Y）」|
| Checklist 描述 element A，代码完全无该元素 / 功能 | 标 **FAIL**，按 acceptance 走 fixing |
| Checklist 描述 N 个元素，代码有 N+1 个（多出一个） | 不算 FAIL，但 signoff 注「实际多出元素 Z，建议下次更新 checklist」|

来源：KOLMatrix MVP-internal-demo-prep fixing-1（C-03 /database 三卡名 spec 写 "Market Intel/Campaign Timing/Budget Benchmark" 但实际代码是 "AI Intelligence/Coverage Gap/Engagement"）。Reviewer 标 FAIL 触发 fixing 浪费 1 轮；正解是直接 update checklist 文本。

**Planner 配套防御：** verifying 前 grep 实际代码验证 checklist 元素存在性（详见 `planner-checklists.md §"verifying 前 checklist 起草必须 grep 实际代码验证"`，BL-071 F003 拆分后位置）。

### §12.3 首轮 verifying PASS（fix_rounds=0）的硬条件

**背景：** BIx-mvp-polish-pass + BL-025-asset-library 两个连续批次首轮验收即 PASS（fix_rounds=0），跳过 fixing/reverifying 直接切 done。验证两次后形成可复用判据。

**首轮 PASS 必须同时满足 3 条：**

| 条件 | 说明 |
|---|---|
| (a) **Acceptance 全代码层 PASS** | spec § acceptance 列出的所有 hard items 全部实装且符合，包括硬性测试文件（`tests/integration/*` `tests/e2e/*` 等）必须存在且 ≥ spec 要求 case 数 |
| (b) **L1 + L2 全 PASS** | L1（lint / tsc / unit + integration test / build / coverage）+ L2（staging 浏览器走查 / 视觉一致性 / SHA 对齐 / 安全头 / 数据抽样）全部 PASS |
| (c) **所有 Soft-watch 项有明文兜底机制** | 每条 soft-watch 必须在 progress.json / spec / signoff 中明文写兜底（如 "7-day follow-up agent" / "BL-025-followup mini-batch deferred" / "Planner 已声明的 acceptance soft-watch"），不能"反正有问题再说" |

**只要 (c) 中有任何一条 soft-watch 没明文兜底 → 不能切 done，必须切 fixing 让 Generator 把兜底机制写进 progress.json 或 spec。** 即便代码层全 PASS，soft-watch 没兜底 = 验收不闭环。

**反例（不算首轮 PASS）：**
- 代码 100% 实装，但 spec 写"perf 目标 ≥X" 没工具可测，标 soft-watch 但没说"何时何处补测"→ FAIL
- 视觉 baseline 有 4 项 deferred，没说 deferred 到哪个批次 → FAIL

**Reviewer 决策路径：**
1. 跑 L1 → 全 PASS
2. 跑 L2 → 全 PASS
3. 列出本轮所有 soft-watch（acceptance 偏离 / 已知妥协 / 数字层无证据 / etc）
4. 对每条 soft-watch 检查 progress.json / spec / signoff §6 是否有明文兜底
5. 缺任一兜底 → 标 FAIL，回 Generator 补；全有 → 切 done

来源：BIx-mvp-polish-pass signoff（2026-05-02）+ BL-025-asset-library signoff（2026-05-03）。

---

## §13. 测试设计（v0.9.22 #2 + #12+BL-070 #21 合并 + BL-069 #15 沉淀）

### §13.1 量化 verifying gate criterion 设计（v0.9.22 #2）

verifying gate 量化 criterion 必须**锚定语义信号**而非**字面数字**。Acceptance 文字写"快"/"少"/"几乎无"等定性词时，Evaluator 必须要求 Planner 修订为可量化 threshold；同时**预判 dataset 真实形态**避免落入"字面陷阱"。

**字面陷阱反面案例：** BL-066 F007 spec 写「top-15 内 max-min ≥ 5」criterion，staging recompute 后 top-15 全 clamp 100，criterion 字面失败但 BL-048 mega-nano 不再同 100 的**语义**已达成。用户 ack 选项 (i) data-driven 修订 criterion 为 (a') 全 dataset spread + (b') top-15 最小 follower threshold，而非调 formula。

**data-form-aware 设计 checklist：**
- [ ] 预跑 staging recompute 一次看真实 dataset 形态（是否含 clamp / NULL / outlier）
- [ ] 设计 criterion 时锚定语义（如「mega-nano 区分度」）而非字面数字（如「max-min ≥ 5」）
- [ ] 数字层 criterion 必伴 fallback：若字面 fail，是否能改 data-driven 修订（无需 fix formula）

**应用：** 所有数字层 acceptance criterion（perf / size / coverage / 量化质量）必经"语义 vs 字面"自检 + dataset 形态预跑。

来源：BL-066 F007 staging recompute 实战 + v0.9.22 #2（用户 2026-05-15 ack）。

### §13.2 mock 不可用三件套：always-skip + unit pure function + staging dogfood（v0.9.22 #12 + BL-070 #21 合并段，两 source）

**Server-action 类测试 mock infeasible** 时的三件套规约。

**触发场景（两 source 实战）：**

- **(v0.9.22 #12 source)** BL-068 e2e refine-action 测试因 Next.js server action mock 在 vitest/playwright 环境**不可行**（需要真实 Next.js runtime + Redis + Postgres），强行 mock 引入大量 fragility
- **(BL-070 #21 source)** BL-070 F006 4 个 refine e2e case 在 mock fired 后 toast 永远 timeout，根因 = Playwright `page.route.fulfill({body: JSON.stringify(...)})` 返 plain JSON **不满足 Next.js RSC wire format** → client deserialise throw → catch 走 network toast。任何 body shape filter 都救不了

**三件套规约：**

| 件 | 内容 | 适用 |
|---|---|---|
| 1️⃣ **always-skip in CI** | `test.skip(true, SKIP_*_REASON)` 在 spec 文件顶部 always-skip server-action e2e | CI 不可达路径 |
| 2️⃣ **unit pure function** | 抽 server-action 内部纯函数（validation / dedupe / transform）写 vitest 单测覆盖 | Unit-testable 逻辑 |
| 3️⃣ **staging dogfood** | spec acceptance 文档化"该路径由 staging dogfood + audit_log 实测覆盖"+ dogfood checklist 含此路径 | 端到端真实验证 |

**Skip 模板：**
```typescript
// tests/e2e/feature-name.spec.ts
import { test, expect } from "@playwright/test";

const SKIP_SERVER_ACTION_REASON =
  "Next.js server action 在 e2e 不可 mock（RSC wire format 不可由 route.fulfill 满足）。" +
  "本路径由 staging dogfood + audit_log 覆盖 — 见 docs/specs/<batch>-spec.md §6 dogfood checklist。";

test.describe("Feature X", () => {
  test.skip(true, SKIP_SERVER_ACTION_REASON);
  // test cases skeleton kept for documentation
});
```

**反例：** 不应该 `test.skip` 简化 CI 红 — 必须有 dogfood 替代覆盖才能 skip，否则等于无验收。Reviewer 审 spec 时验：每个 always-skip server-action e2e 是否在 spec dogfood checklist 列入对应路径。

**适用判断 checklist：**
- [ ] 测试 mock 复杂度 > 测试价值？ → skip + dogfood
- [ ] 测试 mock 是否可由 `vi.fn()` / `route.fulfill` 简单覆盖？ → 优先 mock
- [ ] CI 跑测试是否需要真实 Next.js runtime + Redis + Postgres？ → 无法 mock，必 skip + dogfood

来源（双 source）：
- BL-067 §8 + BL-068-F006 实战（v0.9.22 #12，用户 2026-05-17 ack）
- BL-070 F006 RSC wire format 不可 mock 实证（v0.9.23 #21，用户 2026-05-25 ack）
- 两条同主题 inline-merge 为 §13.2 单段（per D7 强制合并）

### §13.3 staging-only env flag + runbook 让 Reviewer 可执行受控 chaos test（BL-069 #15）

**Chaos test 模式：** 所有"chaos / edge case 实测"类 acceptance（cap 满 / network error / 5xx mock）应有 staging-only env flag + runbook 入 spec acceptance，避免 Reviewer L2 卡壳烧真钱。

**模式核心（BL-069 fix-round 1 B2 case）：**

1. **专用 staging-only env flag**（如 `BRIEF_FORCE_CAP_EXHAUSTED=true`）严格 `=== 'true'` 防 typo
2. **audit 加 `forced=true` 字段**让 dashboard 监控可区分真 cap 满 vs 模拟
3. **runbook 5 步：** 备份 .env → 加 flag tee → pm2 reload → UX 验 → 清理（restore .env + reload）
4. **2 单测保护：** (a) 启用 enable case / (b) `'yes'` / 其他字符串非严格 regression guard

**对比 BL-067 §6 chaos test 模式（改 .env.staging API key）：**

| 维度 | BL-067 §6 模式 | BL-069 #15 staging flag 模式 |
|---|---|---|
| 影响范围 | 整 API key 失效 | 仅当前路径 short-circuit |
| 防 typo | ❌ key 改错全 CI 红 | ✅ 严格 `=== 'true'` |
| Audit 可区分 | ❌ | ✅ `forced=true` 字段 |
| 复杂度 | 简单（改 .env 即可） | 中（需写 flag + runbook + 单测） |

**flag 命名规范：** `<FEATURE>_FORCE_<SCENARIO>=true`（如 `BRIEF_FORCE_CAP_EXHAUSTED` / `KOL_FORCE_FETCH_ERROR` / `AI_FORCE_RATE_LIMIT`）。

**runbook 5 步模板：** 见 `docs/dev/bl069-cap-exhausted-simulation-runbook.md`（备份 + tee + pm2 reload + UX 验 + 清理）。

**应用：** spec 起草凡列 "chaos test / edge case 实测" 类 acceptance，必含 staging-only flag + runbook + 单测三组件，避免 Reviewer L2 时发现无入口卡壳。

来源：BL-069 fix-round 1 B2 + v0.9.23 #15（用户 2026-05-18 ack）。

### §13.4 advisory test 三件套模式 — outbound / 消费侧 / 三向闭环（v0.9.24 合并段 #3 + #7 + #9）

测试基建对 outbound / 消费侧 / 三向闭环的 advisory 防御 — IA refactor / 路由删除 / i18n ns 改动 / Material Symbols 加 icon 类批次回归守门标配。三 sub-section 按时间序展示 v1 → v2 → STRICT_MODE 渐进升级路径。

#### §13.4.1 v1 三件套基础（v0.9.24 #3 / BL-072 #3，BL-072-F007 落实物）

3 个 advisory unit test 覆盖 outbound 一致性 / 消费侧 wiring / 三向闭环：

| Test 文件 | 覆盖维度 | 探测 pattern |
|---|---|---|
| `tests/unit/link-target-audit.test.ts` | 路由 outbound 链接命中实际路由树 | 扫 `src/` 中 `href="/<path>"` + `router.push("/<path>")` 字面 → 抽 path prefix → 比对路由树 + `IA_REDIRECT_RULES` |
| `tests/unit/material-symbols-coverage-unit.test.ts` | Material Symbols 三向断言 | src JSX 中 `material-symbols-outlined` ligature ⊆ manifest（git-tracked）⊆ woff2 实际 glyph |
| `tests/unit/i18n-page-side-consumption.test.ts` v1 | i18n page-side raw English literal sweep | 扫 `page.tsx` + `*Client/*Panel/*Bar` 主组件 JSX text/attr，命中 raw English 即 advisory warning |

**第一版全 advisory（warning 不 fail）**：避免 false-positive 拦截合法 PR（如 brand 词、unicode 模糊匹配 false-hit）。三测试落地后稳定 1-2 周观察 noise rate，再逐维度 flip 见 §13.4.3。

来源：BL-072-F007 实物落 3 advisory test 文件 + v0.9.24 #3 用户 2026-05-26 ack。

#### §13.4.2 v2 升级：key existence 检测（v0.9.24 #7 / BL-073 #7，BL-073-F005 实战）

v1 `i18n-page-side-consumption.test.ts` **仅** grep raw English literal 在 JSX text/attr，**不验** page.tsx 调用 `t("<key>")` 时该 key 在 messages JSON 实际 exist。

**反例（BL-073 issue #4A）：** `match.emptyState.body` 5 locale 全 MISSING 但 page.tsx 调 `t("body")` → next-intl prod fallback 返字面 key 字符串显示给用户，CI/lint/v1 advisory 全过。

**v2 增量探测：**

```typescript
// tests/unit/i18n-page-side-consumption.test.ts v2 增量
function extractNamespaceFromFile(filePath: string): string | null {
  const src = readFileSync(filePath, "utf-8");
  // useTranslations("<ns>") / getTranslations({ namespace: "<ns>" })
  const m = src.match(/useTranslations\("([^"]+)"\)|getTranslations\(\s*\{\s*namespace:\s*"([^"]+)"/);
  return m ? (m[1] ?? m[2]) : null;
}

function extractTCalls(filePath: string): string[] {
  const src = readFileSync(filePath, "utf-8");
  // t("<key>") - greedy 抓所有 t("...") 调用
  const matches = [...src.matchAll(/\bt\("([^"]+)"\)/g)];
  return matches.map((m) => m[1]);
}

// 主循环：每个 page.tsx + 主组件
for (const file of glob.sync("src/app/**/page.tsx")) {
  const ns = extractNamespaceFromFile(file);
  if (!ns) continue;
  const keys = extractTCalls(file);
  for (const key of keys) {
    const fullKey = `${ns}.${key}`;
    if (!hasKeyInMessages(enJson, fullKey)) {
      results.push({ file, fullKey, severity: STRICT_I18N ? "fail" : "warn" });
    }
  }
}
```

**关键设计：**
- 扫 `page.tsx` + `*Client/*Panel/*Bar` 主组件（其他低风险组件可豁免）
- namespace 解析支持 `useTranslations` 和 `getTranslations({ namespace })` 两种形态
- 拼 `${ns}.${key}` 后查 `messages/en.json` 是否 exist
- 第一版 advisory（`STRICT_I18N=false`），稳定后 flip strict（详 §13.4.3）

来源：BL-073-F005 实物落 i18n-page-side-consumption.test.ts v2 + v0.9.24 #7 用户 2026-05-26 ack。

#### §13.4.3 STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip（v0.9.24 #9 / BL-073 #9，BL-073-F007 实战）

**模式核心：** 三件套首版全 advisory（`STRICT_MODE=false`，warning 不 fail）避免 false-positive 拦合法 PR。**渐进 flip 路径**：稳定 1-2 周 + 0 false-positive 漂移后逐维度 flip strict。

**当前维度状态（BL-073-F007 实战）：**

| Strict 维度 flag | 当前状态 | 触发 flip 条件 | 拦未追例 |
|---|---|---|---|
| `STRICT_MS_ICONS=true` | ✅ 已 strict | Material Symbols subset script + manifest 防御稳定 1 周（BL-072-F005 后） | CI fail 拦未追 manifest 的 icon ligature |
| `STRICT_I18N=false` | ⏸️ 仍 advisory | v2 key existence 实战稳定 1-2 周 + i18n ns refactor 批次频次降低 | 未来 flip 拦未拼齐 5 locale 的 key |
| `STRICT_LINK_TARGET=false` | ⏸️ 仍 advisory | IA refactor / 路由删除批次频次降低 + IA_REDIRECT_RULES 稳定 | 未来 flip 拦 href 指向不存在路由 |

**Flip 标准模板（每次 flip 1 个维度）：**

1. **CHANGELOG marker：** `vX.Y.Z (YYYY-MM-DD): STRICT_<DIM>=true 启用 — 拦未追 <X> 类问题`
2. **planner-checklists.md 强制要求：** 加"未来 X 类 feature 必须 Y"行（如"加新 ligature 必更 manifest + 重跑 subset"）
3. **spec acceptance 模板更新：** 相关 feature 起草自动列 `STRICT_<DIM>=true → CI 必绿`
4. **观察 1 周 noise rate：** flip 后 CI 红率 > 5% → 暂退回 advisory，先修 false-positive

**flag 拆分原因：** 避免单 `STRICT_MODE=true` 一刀切（不同维度成熟度不同），按维度独立 flag 允许"Material Symbols 已 strict + i18n + link-target 仍 advisory"混合状态。

来源：BL-073-F007 实物落 STRICT_MS_ICONS flip + v0.9.24 #9 用户 2026-05-26 ack。

#### 配套 (advisory test 三件套外延)：

- spec acceptance 起草端：详 `framework/harness/planner-checklists.md` §"IA refactor / 路由删除批次 outbound 一致性扫描清单"（v0.9.24 #1）
- 路由删除 self-check：详 `framework/harness/generator.md` §11 J「删 X 前 grep callers 矩阵」（v0.9.24 #4 扩展 H i18n ns）

**合并段来源（per D7 强制合并 3 同主题候选）：** BL-072-F007 v1 三件套 + BL-073-F005 v2 key existence + BL-073-F007 STRICT_MODE 渐进 = v0.9.24 #3 + #7 + #9 三 sub-section 合并入 §13.4，避免开 §14/§15/§16 三独立段。

### §13.5 含交互 client/SSR 页面 L2 必跑 headless 点击 + 严禁 force-click（铁律级，BL-108-F004 fix-round 1+2）

**铁律：** 验收含交互的 `'use client'` / SSR 页面，L2 必须用 headless 浏览器**真点**关键控件并断言：
1. **console 无 React #418/#425 水合错误**（#418 = 文本节点失配会废掉整个 hydration root 交互，详 generator.md §15.3 子坑 A）
2. **点击产生预期 onClick 效果**（state 切换 / toast / 跳转）

**测法铁律（关键）：** 必须用标准 `locator.click()`（Playwright 自动等 actionability/enabled）**或**先 `await [data-ready=true]` 再点。**严禁 `force: true` / `dispatchEvent` / `evaluate(el => el.click())`** —— 这些跳过 enabled 检查，会点在水合时序窗口内未绑事件的按钮上（详 generator.md §15.3 子坑 B），**稳定复现"假 bug"**（BL-108 Codex 两轮 reverify 即因落此窗口误判开关失效）。

**反例：** RTL `render()` 是纯客户端渲染从不经 SSR+hydrate，单测全绿 ≠ 真实浏览器无水合问题；含交互 SSR 页面不能只靠 jsdom 单测签收。

来源：BL-108-F004 fix-round 1（#418 水合失配）+ fix-round 2（force-click 落时序窗口误判）+ 用户 2026-06-10 ack。配套 Generator 端见 `framework/harness/generator.md §15.3`。

